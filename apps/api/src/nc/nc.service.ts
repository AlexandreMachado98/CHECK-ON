import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { itemAsAnswered, withAnsweredItem } from '../checklist/answer-snapshot';
import { ACTIVE_NC_STATUSES, canTransitionNc, vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';

@Injectable()
export class NcService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const ncs = await this.prisma.nonConformity.findMany({
      include: {
        vehicle: true,
        item: true,
        answer: {
          include: {
            item: true,
            checklist: {
              include: { vehicle: true, driver: true }
            }
          }
        },
        _count: { select: { recurrences: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    // A NC mostra a pergunta como estava quando foi aberta.
    return ncs.map((nc) => ({
      ...nc,
      item: itemAsAnswered(nc.item, nc.answer),
      answer: nc.answer ? withAnsweredItem(nc.answer) : nc.answer,
    }));
  }

  async update(id: string, updateNcDto: UpdateNcDto) {
    const record = await this.prisma.nonConformity.findUnique({
      where: { id },
      include: { answer: { include: { checklist: { select: { vehicleId: true } } } } },
    });
    if (!record) throw new NotFoundException('NC não encontrada');

    if (updateNcDto.status && !canTransitionNc(record.status, updateNcDto.status)) {
      throw new ConflictException('Esta NC já foi encerrada e não pode ser reaberta.');
    }

    const data: { status?: string; severity?: string; notes?: string; resolvedAt?: Date | null } = { ...updateNcDto };
    if (updateNcDto.status === 'RESOLVED' || updateNcDto.status === 'CLOSED') {
      data.resolvedAt = record.resolvedAt ?? new Date();
    } else if (updateNcDto.status && ACTIVE_NC_STATUSES.includes(updateNcDto.status)) {
      data.resolvedAt = null;
    }

    const vehicleId = record.vehicleId ?? record.answer?.checklist?.vehicleId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nonConformity.update({ where: { id }, data });

      // Mudou status ou severidade: o status do veículo passa a refletir as NCs ativas.
      if (vehicleId && (updateNcDto.status || updateNcDto.severity)) {
        const activeNcs = await tx.nonConformity.findMany({
          where: { vehicleId, status: { in: ACTIVE_NC_STATUSES } },
          select: { severity: true },
        });
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: vehicleStatusFromActiveNcs(activeNcs.map((nc) => nc.severity)) },
        });
      }

      return updated;
    });
  }
}

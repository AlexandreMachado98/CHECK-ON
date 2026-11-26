import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES, escalateVehicleStatus, vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';
import { effectiveVehicleStatus, emStatus, todayIso } from '../electromechanical/em-rules';
import { autoBlockCriticalNc } from '../company/company-settings';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ImportVehiclesDto } from './dto/import-vehicles.dto';
import { PLATE_PATTERN, normalizePlate } from './plate';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateVehicleDto) {
    await this.assertFleet(createDto.fleetId);
    await this.assertPlateAvailable(createDto.plate);
    return this.prisma.vehicle.create({ data: createDto as any });
  }

  /**
   * Importação por planilha. Confere todas as linhas antes de gravar: placa no formato certo e sem
   * repetir (na planilha e no cadastro), frota existente (pelo nome, sem diferenciar maiúsculas) e ano
   * válido. Com qualquer problema, não grava nada e devolve o motivo de cada linha; com dryRun, só
   * confere (é o que a prévia do portal usa). Sem problemas, grava tudo de uma vez.
   */
  async importVehicles(dto: ImportVehiclesDto) {
    const fleets = await this.prisma.fleet.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const byName = new Map<string, string[]>();
    for (const f of fleets) {
      const key = f.name.trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), f.id]);
    }
    const plates = dto.rows.map((r) => String(normalizePlate(r.plate ?? '')));
    const existing = new Set(
      (await this.prisma.vehicle.findMany({ where: { plate: { in: plates } }, select: { plate: true } })).map((v) => v.plate),
    );
    const seen = new Map<string, number>();
    const maxYear = new Date().getFullYear() + 1;
    const results = dto.rows.map((row, i) => {
      const line = i + 2; // linha 1 é o cabeçalho da planilha
      const plate = plates[i];
      const errors: string[] = [];
      if (!PLATE_PATTERN.test(plate)) errors.push('placa inválida (use ABC1234 ou ABC1D23)');
      else if (existing.has(plate)) errors.push('placa já cadastrada');
      else if (seen.has(plate)) errors.push(`placa repetida na linha ${seen.get(plate)}`);
      if (PLATE_PATTERN.test(plate) && !seen.has(plate)) seen.set(plate, line);
      const fleetIds = byName.get((row.fleet ?? '').trim().toLowerCase()) ?? [];
      if (!row.fleet?.trim()) errors.push('frota em branco');
      else if (fleetIds.length === 0) errors.push(`frota "${row.fleet.trim()}" não encontrada`);
      else if (fleetIds.length > 1) errors.push(`há mais de uma frota "${row.fleet.trim()}" (renomeie uma delas)`);
      let year: number | undefined;
      if (row.year?.trim()) {
        year = Number(row.year.trim());
        if (!Number.isInteger(year) || year < 1950 || year > maxYear) errors.push('ano inválido');
      }
      return {
        line,
        plate,
        ok: errors.length === 0,
        error: errors.join('; ') || undefined,
        data: {
          plate,
          fleetId: fleetIds[0],
          prefix: row.prefix?.trim() || null,
          brand: row.brand?.trim() || null,
          model: row.model?.trim() || null,
          year: year ?? null,
        },
      };
    });
    const invalid = results.filter((r) => !r.ok).length;
    const summary = results.map(({ line, plate, ok, error }) => ({ line, plate, ok, error }));
    if (dto.dryRun || invalid > 0 || results.length === 0) return { created: 0, invalid, results: summary };
    try {
      const { count } = await this.prisma.vehicle.createMany({ data: results.map((r) => r.data) as never });
      return { created: count, invalid: 0, results: summary };
    } catch (error) {
      // Placa cadastrada em outra frente (fora do que este usuário vê) ou gravada por outra pessoa agora.
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Alguma placa da planilha já está cadastrada na empresa (talvez em outra frente). Nada foi importado.');
      }
      throw error;
    }
  }

  async findAll() {
    const [vehicles, active] = await Promise.all([
      this.prisma.vehicle.findMany({
        orderBy: { createdAt: 'desc' },
        include: { fleet: { select: { id: true, name: true } } },
      }),
      // NCs ativas por veículo (`_count.ncs`), só desta empresa: o `_count` do Prisma agruparia as NCs
      // de todas as empresas a cada consulta.
      this.prisma.nonConformity.groupBy({
        by: ['vehicleId'],
        where: { status: { in: ACTIVE_NC_STATUSES } },
        _count: { _all: true },
      }),
    ]);
    const byVehicle = new Map(active.map((row) => [row.vehicleId, row._count._all]));
    const today = todayIso();
    return vehicles.map((vehicle) => {
      // Situação mostrada já considera a eletromecânica vencida (bloqueia por cima das NCs).
      const em = emStatus(vehicle.emExpiresAt, vehicle.emReleasedUntil, today);
      return {
        ...vehicle,
        status: effectiveVehicleStatus(vehicle.status, em),
        operationalStatus: vehicle.status,
        electromechanical: em,
        _count: { ncs: byVehicle.get(vehicle.id) ?? 0 },
      };
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateVehicleDto) {
    await this.findOne(id);
    if (updateDto.fleetId) await this.assertFleet(updateDto.fleetId);
    if (updateDto.plate) await this.assertPlateAvailable(updateDto.plate, id);

    if (updateDto.status && updateDto.status !== 'BLOQUEADO') {
      const current = await this.prisma.vehicle.findFirst({ where: { id }, select: { emExpiresAt: true, emReleasedUntil: true } });
      const em = emStatus(current?.emExpiresAt, current?.emReleasedUntil);
      if (em.state === 'VENCIDA') {
        throw new ConflictException('A inspeção eletromecânica deste veículo venceu. Registre a nova inspeção ou libere provisoriamente com justificativa.');
      }
    }
    if (updateDto.status) {
      const activeNcs = await this.prisma.nonConformity.findMany({
        where: { vehicleId: id, status: { in: ACTIVE_NC_STATUSES } },
        select: { severity: true },
      });
      const minimum = vehicleStatusFromActiveNcs(activeNcs.map((nc) => nc.severity), await autoBlockCriticalNc(this.prisma));
      if (escalateVehicleStatus(updateDto.status, minimum) !== updateDto.status) {
        throw new ConflictException(
          minimum === 'BLOQUEADO'
            ? 'Este veículo tem NC crítica ativa. Resolva a NC antes de liberá-lo.'
            : 'Este veículo tem NC ativa. Resolva as NCs antes de liberá-lo.',
        );
      }
    }

    return this.prisma.vehicle.update({ where: { id }, data: updateDto as any });
  }

  /** Placa é única por empresa. A extensão do Prisma limita a busca à empresa de quem está logado. */
  private async assertPlateAvailable(plate: string, exceptId?: string) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { plate, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`A placa ${plate} já está cadastrada.`);
  }

  /** A frota precisa existir na mesma empresa (o filtro de tenant é aplicado pelo Prisma). */
  private async assertFleet(fleetId: string) {
    const fleet = await this.prisma.fleet.findFirst({ where: { id: fleetId }, select: { id: true } });
    if (!fleet) throw new NotFoundException('Frota não encontrada.');
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.delete({ where: { id } });
  }
}

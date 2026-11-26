import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimiter } from '../common/rate-limit';
import { findPassengerVehicle } from '../driving/driving-rules';
import { HandleSuggestionDto, RateSuggestionDto, SubmitSuggestionDto } from './suggestion.dto';
import { ALLOWED_FROM, FOLLOW_TOKEN_PATTERN, SUGGESTION_CATEGORIES, SuggestionStatus, newProtocol, suggestionScore } from './suggestion-rules';

const IP_MAX = 30;
const IP_WINDOW_MS = 60 * 60 * 1000;
/** Sugestões por aparelho em 24 horas. */
const DEVICE_MAX_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type Actor = { id: string };
const categoryLabel = (key: string) => SUGGESTION_CATEGORIES[key as keyof typeof SUGGESTION_CATEGORIES] ?? key;

@Injectable()
export class SuggestionService {
  private readonly ipLimiter: RateLimiter;

  constructor(private readonly prisma: PrismaService) {
    this.ipLimiter = new RateLimiter(prisma, IP_MAX, IP_WINDOW_MS);
  }

  // ── Passageiro (sem login) ────────────────────────────────────────────────

  /** Grava a sugestão na frente em que a placa do QR está cadastrada e devolve o protocolo. */
  async submit(token: string, dto: SubmitSuggestionDto, ip: string | undefined) {
    const ipKey = `suggestion-ip:${ip ?? 'desconhecido'}`;
    if (await this.ipLimiter.isBlocked(ipKey)) {
      throw new HttpException('Muitas sugestões enviadas desta rede. Tente de novo mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const vehicle = await findPassengerVehicle(this.prisma, token);
    const deviceHash = dto.deviceId ? createHash('sha256').update(`${vehicle.tenantId}:${dto.deviceId}`).digest('hex') : null;
    if (deviceHash) {
      const today = await this.prisma.suggestion.count({ where: { tenantId: vehicle.tenantId, deviceHash, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
      if (today >= DEVICE_MAX_PER_DAY) {
        throw new HttpException('Você já enviou várias sugestões hoje. Obrigado! Novas sugestões ficam liberadas amanhã.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    await this.ipLimiter.hit(ipKey);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await this.prisma.suggestion.create({
          data: {
            tenantId: vehicle.tenantId,
            vehicleId: vehicle.id,
            unitId: vehicle.fleet.unitId,
            protocol: newProtocol(),
            followToken: randomBytes(24).toString('base64url'),
            category: dto.category,
            text: dto.text.trim(),
            contact: dto.contact?.trim() || null,
            deviceHash,
          },
          select: { protocol: true, followToken: true },
        });
        return created;
      } catch (error) {
        // Protocolo repetido na empresa (raro): sorteia outro.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    throw new ConflictException('Não foi possível gerar o protocolo. Tente de novo.');
  }

  /** Acompanhamento pelo link do protocolo: situação, resposta da empresa e se já pode dar nota. */
  async follow(followToken: string) {
    const s = await this.findByFollowToken(followToken);
    return {
      companyName: s.tenant.name,
      protocol: s.protocol,
      category: categoryLabel(s.category),
      text: s.text,
      createdAt: s.createdAt,
      status: s.status,
      priority: s.priority,
      dueDate: s.dueDate,
      response: s.response,
      resolvedAt: s.resolvedAt,
      rating: s.rating,
      ratingComment: s.ratingComment,
      canRate: s.status === 'RESOLVIDA' && s.rating === null,
      vehicle: { plate: s.vehicle.plate, prefix: s.vehicle.prefix },
    };
  }

  async rate(followToken: string, dto: RateSuggestionDto) {
    const s = await this.findByFollowToken(followToken);
    if (s.status !== 'RESOLVIDA') throw new BadRequestException('A nota fica liberada quando a empresa resolver a sugestão.');
    // Condição no próprio UPDATE: duas notas ao mesmo tempo não se sobrescrevem.
    const { count } = await this.prisma.suggestion.updateMany({
      where: { id: s.id, tenantId: s.tenantId, rating: null, status: 'RESOLVIDA' },
      data: { rating: dto.rating, ratingComment: dto.comment?.trim() || null, ratedAt: new Date() },
    });
    if (!count) throw new ConflictException('Esta sugestão já recebeu a sua nota. Obrigado!');
    return { ok: true };
  }

  // ── Gestão (portal) ───────────────────────────────────────────────────────

  async list(query: { days?: string; status?: string }) {
    const days = [30, 90, 180, 365].includes(Number(query.days)) ? Number(query.days) : 90;
    const period = { createdAt: { gte: new Date(Date.now() - days * DAY_MS) } };
    const status = (['RECEBIDA', 'PRIORIZADA', 'EM_ANDAMENTO', 'RESOLVIDA', 'ARQUIVADA'] as string[]).includes(query.status ?? '') ? query.status : undefined;
    const [items, counts, forScore] = await Promise.all([
      this.prisma.suggestion.findMany({
        where: { ...period, ...(status ? { status } : {}) },
        // Priorizadas primeiro pela prioridade e prazo; o resto do mais novo para o mais antigo.
        orderBy: [{ createdAt: 'desc' }],
        take: 300,
        include: { vehicle: { select: { id: true, plate: true, prefix: true } }, unit: { select: { id: true, name: true } } },
      }),
      this.prisma.suggestion.groupBy({ by: ['status'], where: period, _count: { _all: true } }),
      this.prisma.suggestion.findMany({ where: period, select: { status: true, prioritizedAt: true, dueDate: true, resolvedAt: true, rating: true } }),
    ]);
    const rank = { ALTA: 0, MEDIA: 1, BAIXA: 2 } as Record<string, number>;
    const sorted = [...items].sort((a, b) => {
      const pa = a.priority ? rank[a.priority] : 9;
      const pb = b.priority ? rank[b.priority] : 9;
      return pa - pb || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || b.createdAt.getTime() - a.createdAt.getTime();
    });
    return {
      days,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      score: suggestionScore(forScore),
      items: sorted.map(({ deviceHash: _hidden, followToken: _link, ...item }) => ({ ...item, categoryLabel: categoryLabel(item.category) })),
      categories: SUGGESTION_CATEGORIES,
    };
  }

  /** Para o painel: sugestões recebidas esperando o gestor priorizar ou arquivar. */
  async summary() {
    return { received: await this.prisma.suggestion.count({ where: { status: 'RECEBIDA' } }) };
  }

  async handle(id: string, dto: HandleSuggestionDto, actor: Actor) {
    const s = await this.prisma.suggestion.findFirst({ where: { id }, select: { id: true, status: true, prioritizedAt: true } });
    if (!s) throw new NotFoundException('Sugestão não encontrada.');
    if (!ALLOWED_FROM[dto.action].includes(s.status as SuggestionStatus)) {
      throw new BadRequestException(
        dto.action === 'RESOLVER' ? 'Priorize a sugestão antes de resolvê-la: só as priorizadas contam na nota da empresa.' : 'Esta ação não vale para a situação atual da sugestão.',
      );
    }
    const response = dto.response?.trim() || null;
    const author = await this.prisma.user.findFirst({ where: { id: actor.id }, select: { name: true } });
    const by = author?.name ?? null;
    let data: Record<string, unknown>;
    switch (dto.action) {
      case 'PRIORIZAR':
        if (!dto.priority) throw new BadRequestException('Escolha a prioridade.');
        data = {
          status: s.status === 'EM_ANDAMENTO' ? 'EM_ANDAMENTO' : 'PRIORIZADA',
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(`${dto.dueDate.slice(0, 10)}T00:00:00Z`) : null,
          prioritizedAt: s.prioritizedAt ?? new Date(),
          handledByName: by,
        };
        break;
      case 'INICIAR':
        data = { status: 'EM_ANDAMENTO', handledByName: by };
        break;
      case 'RESOLVER':
        if (!response || response.length < 10) throw new BadRequestException('Escreva a resposta para o passageiro: o que foi feito (pelo menos 10 caracteres).');
        data = { status: 'RESOLVIDA', response, resolvedAt: new Date(), handledByName: by };
        break;
      case 'ARQUIVAR':
        if (!response || response.length < 10) throw new BadRequestException('Explique ao passageiro por que a sugestão foi arquivada (pelo menos 10 caracteres).');
        // Arquivada sai da nota da empresa.
        data = { status: 'ARQUIVADA', response, priority: null, dueDate: null, prioritizedAt: null, handledByName: by };
        break;
      case 'REABRIR':
        data = { status: 'RECEBIDA', response: null, handledByName: by };
        break;
    }
    return this.prisma.suggestion.update({ where: { id }, data });
  }

  private async findByFollowToken(followToken: string) {
    if (!FOLLOW_TOKEN_PATTERN.test(followToken)) throw new NotFoundException('Protocolo não encontrado.');
    const s = await this.prisma.suggestion.findFirst({
      where: { followToken },
      include: { tenant: { select: { name: true } }, vehicle: { select: { plate: true, prefix: true } } },
    });
    if (!s) throw new NotFoundException('Protocolo não encontrado.');
    return s;
  }
}

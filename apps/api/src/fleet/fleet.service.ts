import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { currentUnitIds } from '../common/unit-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import { ImportFleetsDto } from './dto/import-fleets.dto';

const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateFleetDto) {
    const unitId = await this.resolveUnitId(createDto.unitId);
    const name = createDto.name.trim();
    await this.assertNameFree(name, unitId);
    return this.prisma.fleet.create({
      // O tenantId é preenchido pela extensão do Prisma.
      data: { name, description: createDto.description || null, unitId } as never,
    });
  }

  /**
   * Importação de frotas por planilha (implantação de cliente novo). Cada linha tem a frota e a
   * frente pelo nome. Frente que ainda não existe é criada junto, mas só por quem cadastra frentes
   * (administrador); o gestor importa só para as frentes dele. Confere tudo antes de gravar: com
   * qualquer problema não grava nada e devolve o motivo de cada linha.
   */
  async importFleets(dto: ImportFleetsDto, canCreateUnits: boolean) {
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new UnauthorizedException('Sessão sem empresa associada.');
    const [units, fleets] = await Promise.all([
      this.prisma.unit.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      this.prisma.fleet.findMany({ select: { unitId: true, name: true } }),
    ]);
    const unitsByName = new Map<string, string[]>();
    for (const u of units) unitsByName.set(plain(u.name), [...(unitsByName.get(plain(u.name)) ?? []), u.id]);
    const existing = new Set(fleets.map((f) => `${f.unitId}|${plain(f.name)}`));
    // Frentes novas da planilha (chave sem acento): nome como veio na primeira linha e o cliente.
    const newUnits = new Map<string, { name: string; client: string | null }>();
    const seen = new Map<string, number>();

    const results = dto.rows.map((row, i) => {
      const line = i + 2; // linha 1 é o cabeçalho
      const fleet = (row.fleet ?? '').trim().replace(/\s+/g, ' ');
      const unitName = (row.unit ?? '').trim().replace(/\s+/g, ' ');
      const errors: string[] = [];
      if (!fleet) errors.push('frota em branco');
      // Frente: pelo nome; em branco, a única frente da empresa.
      let unitKey: string | null = null;
      let newUnit = false;
      if (!unitName) {
        if (units.length === 1) unitKey = units[0].id;
        else errors.push(units.length ? 'frente em branco (a empresa tem mais de uma)' : 'frente em branco');
      } else {
        const ids = unitsByName.get(plain(unitName)) ?? [];
        if (ids.length === 1) unitKey = ids[0];
        else if (ids.length > 1) errors.push(`há mais de uma frente "${unitName}" (renomeie uma delas)`);
        else if (!canCreateUnits) errors.push(`frente "${unitName}" não está entre as suas frentes de trabalho (só o administrador cria frentes novas)`);
        else {
          newUnit = true;
          unitKey = `nova:${plain(unitName)}`;
          const current = newUnits.get(plain(unitName));
          newUnits.set(plain(unitName), { name: current?.name ?? unitName, client: current?.client ?? (row.client?.trim() || null) });
        }
      }
      if (fleet && unitKey) {
        const key = `${unitKey}|${plain(fleet)}`;
        if (existing.has(key)) errors.push(`já existe a frota "${fleet}" nesta frente`);
        else if (seen.has(key)) errors.push(`frota repetida na linha ${seen.get(key)}`);
        else seen.set(key, line);
      }
      return {
        line,
        fleet,
        unit: unitName || (units.length === 1 ? units[0].name : ''),
        newUnit,
        ok: errors.length === 0,
        error: errors.join('; ') || undefined,
        unitKey,
        description: row.description?.trim() || null,
      };
    });
    const invalid = results.filter((r) => !r.ok).length;
    const summary = results.map(({ line, fleet, unit, newUnit, ok, error }) => ({ line, fleet, unit, newUnit, ok, error }));
    const unitsToCreate = [...newUnits.values()].map((u) => u.name);
    if (dto.dryRun || invalid > 0 || results.length === 0) return { created: 0, unitsCreated: 0, newUnits: unitsToCreate, invalid, results: summary };

    return this.prisma.$transaction(async (tx) => {
      const unitIds = new Map<string, string>();
      for (const [key, u] of newUnits) {
        const created = await tx.unit.create({ data: { tenantId, name: u.name, client: u.client }, select: { id: true } });
        unitIds.set(`nova:${key}`, created.id);
      }
      const { count } = await tx.fleet.createMany({
        data: results.map((r) => ({ tenantId, name: r.fleet, description: r.description, unitId: unitIds.get(r.unitKey!) ?? r.unitKey! })),
      });
      return { created: count, unitsCreated: newUnits.size, newUnits: unitsToCreate, invalid: 0, results: summary };
    });
  }

  /**
   * Duas frotas com o mesmo nome na mesma frente confundem quem escolhe a frota (ao cadastrar
   * veículo, nos filtros e relatórios). Em frentes diferentes o mesmo nome é permitido.
   * Compara sem diferenciar maiúsculas e minúsculas.
   */
  private async assertNameFree(name: string, unitId: string, exceptId?: string) {
    const clash = await this.prisma.fleet.findFirst({
      where: { unitId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`Já existe a frota "${name}" nesta frente de trabalho. Use outro nome.`);
  }

  /**
   * Frente de trabalho da frota. Sem unitId: a única frente de quem cadastra (ou da empresa);
   * com mais de uma, é preciso escolher. Empresa sem frente nenhuma ganha a "Unidade principal".
   */
  private async resolveUnitId(unitId?: string): Promise<string> {
    if (unitId) {
      // A extensão do Prisma restringe a busca à empresa e às frentes de quem está logado.
      const unit = await this.prisma.unit.findFirst({ where: { id: unitId }, select: { id: true } });
      if (!unit) throw new NotFoundException('Frente de trabalho não encontrada.');
      return unit.id;
    }
    const scope = currentUnitIds();
    if (scope) {
      if (scope.length === 1) return scope[0];
      throw new BadRequestException('Escolha a frente de trabalho da frota.');
    }
    const active = await this.prisma.unit.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    if (active.length > 1) throw new BadRequestException('Escolha a frente de trabalho da frota.');
    if (active.length === 1) return active[0].id;
    const created = await this.prisma.unit.create({ data: { name: 'Unidade principal' } as never, select: { id: true } });
    return created.id;
  }

  async findAll() {
    return this.prisma.fleet.findMany({
      include: {
        vehicles: true,
        unit: { select: { id: true, name: true, client: true } },
        _count: { select: { vehicles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.fleet.findUnique({
      where: { id },
      include: {
        vehicles: true,
        unit: { select: { id: true, name: true, client: true } },
        _count: { select: { vehicles: true } },
      },
    });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateFleetDto) {
    const current = await this.findOne(id);
    const data: { name?: string; description?: string | null; unitId?: string; isActive?: boolean } = {};
    if (updateDto.name !== undefined) data.name = updateDto.name.trim();
    if (updateDto.description !== undefined) data.description = updateDto.description || null;
    if (updateDto.isActive !== undefined) data.isActive = updateDto.isActive;
    if (updateDto.unitId !== undefined) data.unitId = await this.resolveUnitId(updateDto.unitId);
    if (data.name !== undefined || data.unitId !== undefined) {
      await this.assertNameFree(data.name ?? current.name, data.unitId ?? current.unitId, id);
    }
    return this.prisma.fleet.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fleet.delete({ where: { id } });
  }
}

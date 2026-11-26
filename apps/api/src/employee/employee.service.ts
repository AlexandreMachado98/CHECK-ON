import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ImportEmployeesDto } from './dto/import-employees.dto';
import { resolveUnitAssignment, visibleUnitsInclude } from '../unit/unit-assignment';
import { currentUnitIds } from '../common/unit-scope';

const dateValue = (value?: string | null): Date | null | undefined =>
  value === undefined ? undefined : value === null || value === '' ? null : new Date(value);
/** Funções aceitas na planilha: a chave ou o nome da tela, sem acento e em qualquer caixa. */
const JOB_TITLES: Record<string, string> = {
  motorista: 'MOTORISTA',
  tecnico: 'TECNICO', 'tecnico de manutencao': 'TECNICO',
  operador: 'OPERADOR', 'operador de frota': 'OPERADOR',
  supervisor: 'SUPERVISOR', 'supervisor operacional': 'SUPERVISOR',
};
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Data da planilha (dd/mm/aaaa, como o Excel em português salva, ou aaaa-mm-dd); null se não for uma data real. */
export function sheetDate(text: string): Date | null {
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const [y, m, d] = br ? [+br[3], +br[2], +br[1]] : iso ? [+iso[1], +iso[2], +iso[3]] : [0, 0, 0];
  if (!y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}
const trainingData = (items: CreateEmployeeDto['trainings'] = []) =>
  items.map((training) => ({
    name: training.name.trim(),
    completedAt: new Date(training.completedAt),
    expiresAt: dateValue(training.expiresAt),
  }));

export interface PhotoUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(createDto: CreateEmployeeDto) {
    await this.assertSupervisor(createDto.supervisorId);
    await this.assertMatriculaAvailable(createDto.matricula);
    const { trainings, unitIds, ...employee } = createDto;
    const units = (await resolveUnitAssignment(this.prisma, unitIds, null)) ?? [];
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new UnauthorizedException('Sessão sem empresa associada.');
    return this.prisma.employee.create({
      data: {
        ...employee,
        tenantId,
        name: employee.name.trim(),
        matricula: employee.matricula?.trim() || null,
        admissionDate: dateValue(employee.admissionDate),
        companyIntegrationDate: dateValue(employee.companyIntegrationDate),
        companyIntegrationExpiresAt: dateValue(employee.companyIntegrationExpiresAt),
        clientIntegrationDate: dateValue(employee.clientIntegrationDate),
        clientIntegrationExpiresAt: dateValue(employee.clientIntegrationExpiresAt),
        badgeToken: randomBytes(32).toString('hex'),
        trainings: { create: trainingData(trainings) },
        units: { create: units.map((unitId) => ({ unitId })) },
      },
      include: {
        trainings: true,
        supervisor: { select: { id: true, name: true, jobTitle: true } },
        units: visibleUnitsInclude(),
      },
    });
  }

  /**
   * Importação por planilha. Confere todas as linhas antes de gravar; com qualquer problema não grava
   * nada e devolve o motivo de cada linha. Exige o mesmo que o cadastro da tela (nome, matrícula,
   * função e admissão). A matrícula é o login do app, então não pode repetir na empresa inteira
   * (inclusive em frentes que quem importa não vê) nem dentro da planilha.
   */
  async importEmployees(dto: ImportEmployeesDto) {
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new UnauthorizedException('Sessão sem empresa associada.');
    const units = await this.prisma.unit.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const unitsByName = new Map<string, string[]>();
    for (const u of units) unitsByName.set(plain(u.name), [...(unitsByName.get(plain(u.name)) ?? []), u.id]);
    const defaultUnits = (await resolveUnitAssignment(this.prisma, undefined, null)) ?? [];

    const matriculas = [...new Set(dto.rows.map((r) => r.matricula?.trim().toLowerCase()).filter((m): m is string => !!m))];
    const taken = new Map<string, string>();
    if (matriculas.length) {
      const found = await this.prisma.$queryRaw<{ matricula: string; name: string }[]>`
        SELECT "matricula", "name" FROM "Employee"
        WHERE "tenantId" = ${tenantId} AND lower("matricula") IN (${Prisma.join(matriculas)})`;
      for (const e of found) taken.set(e.matricula.toLowerCase(), e.name);
    }

    const seen = new Map<string, number>();
    const today = new Date();
    const results = dto.rows.map((row, i) => {
      const line = i + 2; // linha 1 é o cabeçalho da planilha
      const name = (row.name ?? '').trim().replace(/\s+/g, ' ');
      const matricula = row.matricula?.trim() || null;
      const errors: string[] = [];
      if (!name) errors.push('nome em branco');
      if (!matricula) errors.push('matrícula em branco');
      else {
        const key = matricula.toLowerCase();
        if (taken.has(key)) errors.push(`matrícula já pertence a ${taken.get(key)}`);
        else if (seen.has(key)) errors.push(`matrícula repetida na linha ${seen.get(key)}`);
        else seen.set(key, line);
      }
      let jobTitle: string | null = null;
      if (!row.jobTitle?.trim()) errors.push('função em branco');
      else {
        jobTitle = JOB_TITLES[plain(row.jobTitle)] ?? (Object.values(JOB_TITLES).includes(row.jobTitle.trim().toUpperCase()) ? row.jobTitle.trim().toUpperCase() : null);
        if (!jobTitle) errors.push(`função "${row.jobTitle.trim()}" não reconhecida (use Motorista, Técnico, Operador ou Supervisor)`);
      }
      let admissionDate: Date | null = null;
      if (!row.admissionDate?.trim()) errors.push('admissão em branco');
      else {
        admissionDate = sheetDate(row.admissionDate.trim());
        if (!admissionDate) errors.push('admissão inválida (use dd/mm/aaaa)');
        else if (admissionDate > today) errors.push('admissão no futuro');
      }
      let unitIds = defaultUnits;
      const unitNames = (row.units ?? '').split(/[,|]/).map((n) => n.trim()).filter(Boolean);
      if (unitNames.length) {
        unitIds = [];
        for (const n of unitNames) {
          const ids = unitsByName.get(plain(n)) ?? [];
          if (ids.length === 0) errors.push(`frente "${n}" não encontrada`);
          else if (ids.length > 1) errors.push(`há mais de uma frente "${n}" (renomeie uma delas)`);
          else if (!unitIds.includes(ids[0])) unitIds.push(ids[0]);
        }
      } else if (currentUnitIds() && defaultUnits.length === 0) {
        errors.push('informe a frente de trabalho');
      }
      return {
        line,
        name,
        ok: errors.length === 0,
        error: errors.join('; ') || undefined,
        unitIds,
        data: {
          id: randomUUID(),
          tenantId,
          name,
          matricula,
          jobTitle,
          departmentName: row.department?.trim() || null,
          admissionDate,
          badgeToken: randomBytes(32).toString('hex'),
        },
      };
    });
    const invalid = results.filter((r) => !r.ok).length;
    const summary = results.map(({ line, name, ok, error }) => ({ line, name, ok, error }));
    if (dto.dryRun || invalid > 0 || results.length === 0) return { created: 0, invalid, results: summary };

    const links = results.flatMap((r) => r.unitIds.map((unitId) => ({ employeeId: r.data.id, unitId })));
    const [created] = await this.prisma.$transaction([
      this.prisma.employee.createMany({ data: results.map((r) => r.data) }),
      this.prisma.employeeUnit.createMany({ data: links }),
    ]);
    return { created: created.count, invalid: 0, results: summary };
  }

  async findAll() {
    return this.prisma.employee.findMany({
      include: {
        tenant: { select: { name: true } },
        // Situação do acesso (aplicativo / portal) mostrada na tela Colaboradores.
        user: { select: { id: true, email: true, isActive: true, mustChangePassword: true, lockedUntil: true, role: { select: { name: true } } } },
        trainings: { orderBy: { expiresAt: 'asc' } },
        supervisor: { select: { id: true, name: true, jobTitle: true } },
        units: visibleUnitsInclude(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        trainings: { orderBy: { expiresAt: 'asc' } },
        supervisor: { select: { id: true, name: true, jobTitle: true } },
        units: visibleUnitsInclude(),
      },
    });
    if (!record) throw new NotFoundException('Colaborador não encontrado.');
    return record;
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    await this.findOne(id);
    await this.assertSupervisor(updateDto.supervisorId, id);
    if (updateDto.matricula !== undefined) await this.assertMatriculaAvailable(updateDto.matricula, id);
    const { trainings, unitIds, ...employee } = updateDto;
    const units = await resolveUnitAssignment(this.prisma, unitIds, await this.currentUnitIds(id));
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...employee,
        name: employee.name?.trim(),
        matricula: employee.matricula === undefined ? undefined : employee.matricula.trim() || null,
        admissionDate: dateValue(employee.admissionDate),
        companyIntegrationDate: dateValue(employee.companyIntegrationDate),
        companyIntegrationExpiresAt: dateValue(employee.companyIntegrationExpiresAt),
        clientIntegrationDate: dateValue(employee.clientIntegrationDate),
        clientIntegrationExpiresAt: dateValue(employee.clientIntegrationExpiresAt),
        trainings: trainings === undefined
          ? undefined
          : { deleteMany: {}, create: trainingData(trainings) },
        units: units === undefined ? undefined : { deleteMany: {}, create: units.map((unitId) => ({ unitId })) },
      },
      include: {
        trainings: { orderBy: { expiresAt: 'asc' } },
        supervisor: { select: { id: true, name: true, jobTitle: true } },
        units: visibleUnitsInclude(),
      },
    });
  }

  /** Todas as frentes do funcionário, inclusive as que quem edita não vê (para preservá-las). */
  private async currentUnitIds(employeeId: string): Promise<string[]> {
    const rows = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { units: { select: { unitId: true } } } });
    return rows?.units.map((row) => row.unitId) ?? [];
  }

  async uploadPhoto(id: string, file: PhotoUploadFile) {
    const employee = await this.findOne(id);
    const photoUrl = await this.storage.uploadFile(file.buffer, file.originalname, file.mimetype);
    let updated;
    try {
      updated = await this.prisma.employee.update({ where: { id }, data: { photoUrl } });
    } catch (error) {
      await this.storage.deleteFile(photoUrl);
      throw error;
    }
    if (employee.photoUrl) {
      try {
        await this.storage.deleteFile(employee.photoUrl);
      } catch {
        // The saved photo remains valid; a later storage cleanup can remove the orphaned file.
      }
    }
    return updated;
  }

  async rotateBadgeToken(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { badgeToken: randomBytes(32).toString('hex') },
      select: { id: true, badgeToken: true },
    });
  }

  async findPublicBadge(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const employee = await this.prisma.employee.findUnique({
      where: { badgeToken: token },
      include: {
        tenant: { select: { name: true } },
        supervisor: { select: { name: true, jobTitle: true } },
        trainings: { orderBy: [{ expiresAt: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!employee?.isActive) return null;

    return {
      name: employee.name,
      photoUrl: employee.photoUrl,
      jobTitle: employee.jobTitle,
      departmentName: employee.departmentName,
      admissionDate: employee.admissionDate,
      supervisor: employee.supervisor,
      companyName: employee.tenant.name,
      companyIntegrationDate: employee.companyIntegrationDate,
      companyIntegrationExpiresAt: employee.companyIntegrationExpiresAt,
      clientIntegrationDate: employee.clientIntegrationDate,
      clientIntegrationExpiresAt: employee.clientIntegrationExpiresAt,
      trainings: employee.trainings.map(({ name, completedAt, expiresAt }) => ({ name, completedAt, expiresAt })),
      verifiedAt: new Date().toISOString(),
    };
  }

  async remove(id: string) {
    const employee = await this.findOne(id);
    const removed = await this.prisma.employee.delete({ where: { id } });
    // A foto do crachá ia ficar na nuvem sem dono: apaga junto (falha aqui não desfaz a exclusão).
    if (employee.photoUrl) await this.storage.deleteFile(employee.photoUrl).catch(() => undefined);
    return removed;
  }

  /** Matrícula é única por empresa (vazia pode repetir). A extensão do Prisma limita à empresa logada. */
  private async assertMatriculaAvailable(matricula?: string | null, exceptId?: string) {
    const value = matricula?.trim();
    if (!value) return;
    const existing = await this.prisma.employee.findFirst({
      where: { matricula: { equals: value, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { name: true },
    });
    if (existing) throw new ConflictException(`A matrícula ${value} já pertence a ${existing.name}.`);
  }

  private async assertSupervisor(supervisorId?: string | null, employeeId?: string) {
    if (!supervisorId) return;
    if (supervisorId === employeeId) {
      throw new BadRequestException('O colaborador não pode ser seu próprio supervisor.');
    }
    const supervisor = await this.prisma.employee.findFirst({ where: { id: supervisorId, isActive: true } });
    if (!supervisor) {
      throw new BadRequestException('O supervisor precisa ser um colaborador ativo da mesma empresa.');
    }
  }
}

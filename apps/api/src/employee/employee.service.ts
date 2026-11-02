import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ClsServiceManager } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const dateValue = (value?: string | null): Date | null | undefined =>
  value === undefined ? undefined : value === null || value === '' ? null : new Date(value);
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
    const { trainings, ...employee } = createDto;
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
      },
      include: { trainings: true, supervisor: { select: { id: true, name: true, jobTitle: true } } },
    });
  }

  async findAll() {
    return this.prisma.employee.findMany({
      include: {
        tenant: { select: { name: true } },
        trainings: { orderBy: { expiresAt: 'asc' } },
        supervisor: { select: { id: true, name: true, jobTitle: true } },
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
      },
    });
    if (!record) throw new NotFoundException('Colaborador não encontrado.');
    return record;
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    await this.findOne(id);
    await this.assertSupervisor(updateDto.supervisorId, id);
    const { trainings, ...employee } = updateDto;
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
      },
      include: {
        trainings: { orderBy: { expiresAt: 'asc' } },
        supervisor: { select: { id: true, name: true, jobTitle: true } },
      },
    });
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
      matricula: employee.matricula,
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
    await this.findOne(id);
    return this.prisma.employee.delete({ where: { id } });
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

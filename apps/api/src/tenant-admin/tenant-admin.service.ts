import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    if (createTenantDto.cnpj) {
      const existing = await this.prisma.tenant.findUnique({ where: { cnpj: createTenantDto.cnpj } });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado em outra empresa');
      }
    }
    
    return this.prisma.tenant.create({
      data: createTenantDto,
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}

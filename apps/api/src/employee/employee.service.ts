import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateEmployeeDto) {
    return this.prisma.employee.create({ data: createDto as any });
  }

  async findAll() {
    return this.prisma.employee.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.employee.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({ where: { id }, data: updateDto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.delete({ where: { id } });
  }
}

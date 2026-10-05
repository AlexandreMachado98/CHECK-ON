import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // O Prisma automaticamente adiciona tenantId devido à extensão RLS.
    const existing = await this.prisma.user.findUnique({ where: { email: createUserDto.email } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const { password, ...data } = createUserDto;

    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
      } as any,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        tenantId: true,
      }
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

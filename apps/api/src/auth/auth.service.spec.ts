import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockJwt = {
    signAsync: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve rejeitar login se o usuário não for encontrado', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.login({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
  });

  it('deve rejeitar login se o usuário estiver inativo', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: false,
      tenant: { isActive: true },
      role: { name: 'Admin' }
    });

    await expect(authService.login({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
  });

  it('deve rejeitar login se a empresa (tenant) estiver inativa', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      tenant: { isActive: false },
      role: { name: 'Admin' }
    });

    await expect(authService.login({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
  });

  it('deve rejeitar login se a senha estiver incorreta', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      isActive: true,
      tenantId: 't1',
      passwordHash: 'hash',
      tenant: { isActive: true, name: 'Empresa' },
      role: { name: 'Admin', permissions: [] }
    });
    
    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

    await expect(authService.login({ email: 'x@x.com', password: 'wrong' }))
      .rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
  });

  it('deve retornar token e dados do usuário se o login for válido', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Carlos',
      email: 'x@x.com',
      isActive: true,
      tenantId: 't1',
      passwordHash: 'hash',
      tenant: { isActive: true, name: 'Empresa A' },
      role: { name: 'Motorista', permissions: ['vehicle:read'] }
    });

    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
    mockJwt.signAsync.mockResolvedValue('jwt_token');

    const result = await authService.login({ email: 'x@x.com', password: 'correct' });

    expect(result.access_token).toBe('jwt_token');
    expect(result.user.id).toBe('u1');
    expect(result.user.tenantId).toBe('t1');
  });
});

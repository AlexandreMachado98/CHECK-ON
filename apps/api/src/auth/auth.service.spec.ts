import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, REFRESH_REUSE_WINDOW_MS, hashRefreshToken } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Módulos ESM não aceitam vi.spyOn nas exportações; o mock precisa ser do módulo inteiro.
vi.mock('bcrypt', () => ({ compare: vi.fn() }));
const compareMock = bcrypt.compare as unknown as ReturnType<typeof vi.fn>;

const activeUser = {
  id: 'u1',
  name: 'Carlos',
  email: 'x@x.com',
  isActive: true,
  tenantId: 't1',
  employeeId: 'emp-1',
  passwordHash: 'hash',
  tenant: { isActive: true, name: 'Empresa A' },
  role: { name: 'MOTORISTA', permissions: ['vehicle:read'] },
};

function storedToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt-1',
    userId: 'u1',
    familyId: 'fam-1',
    tokenHash: hashRefreshToken('old-token'),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null as Date | null,
    user: activeUser,
    ...overrides,
  };
}

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
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
    mockJwt.signAsync.mockResolvedValue('jwt_token');
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('deve rejeitar login se o usuário não for encontrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login({ email: 'x@x.com', password: '123' }))
        .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
    });

    it('deve rejeitar login se o usuário estiver inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

      await expect(authService.login({ email: 'x@x.com', password: '123' }))
        .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
    });

    it('deve rejeitar login se a empresa (tenant) estiver inativa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, tenant: { isActive: false, name: 'X' } });

      await expect(authService.login({ email: 'x@x.com', password: '123' }))
        .rejects.toThrow(new UnauthorizedException('Credenciais inválidas ou conta inativa'));
    });

    it('deve rejeitar login se a senha estiver incorreta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      compareMock.mockResolvedValue(false);

      await expect(authService.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('deve retornar tokens e dados do usuário se o login for válido', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      compareMock.mockResolvedValue(true);

      const result = await authService.login({ email: 'x@x.com', password: 'correct' });

      expect(result.access_token).toBe('jwt_token');
      expect(result.refresh_token).toEqual(expect.any(String));
      expect(result.refresh_token.length).toBeGreaterThanOrEqual(64);
      expect(result.user).toMatchObject({ id: 'u1', tenantId: 't1', employeeId: 'emp-1', role: 'MOTORISTA' });

      // Só o hash vai para o banco, nunca o token em si.
      const saved = mockPrisma.refreshToken.create.mock.calls[0][0].data;
      expect(saved.tokenHash).toBe(hashRefreshToken(result.refresh_token));
      expect(saved.tokenHash).not.toBe(result.refresh_token);
      expect(saved.userId).toBe('u1');
      expect(new Date(result.refresh_token_expires_at).getTime()).toBe(saved.expiresAt.getTime());
    });
  });

  describe('refresh', () => {
    it('troca um token válido por um novo par e revoga o anterior', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken());

      const result = await authService.refresh('old-token');

      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashRefreshToken('old-token') } }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.access_token).toBe('jwt_token');
      expect(result.refresh_token).not.toBe('old-token');
      expect(mockPrisma.refreshToken.create.mock.calls[0][0].data.familyId).toBe('fam-1');
    });

    it('recusa token desconhecido', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(authService.refresh('nada')).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token expirado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(authService.refresh('old-token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('aceita reenvio logo após a troca (resposta perdida por falha de rede)', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken({ revokedAt: new Date(Date.now() - 5000) }));

      const result = await authService.refresh('old-token');

      expect(result.access_token).toBe('jwt_token');
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('reuso de token antigo derruba todas as sessões daquele login', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ revokedAt: new Date(Date.now() - REFRESH_REUSE_WINDOW_MS - 1000) }),
      );

      await expect(authService.refresh('old-token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('recusa e revoga quando o usuário foi desativado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken({ user: { ...activeUser, isActive: false } }));

      await expect(authService.refresh('old-token')).rejects.toThrow('Conta inativa');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { familyId: 'fam-1', revokedAt: null } }),
      );
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revoga o token pelo hash', async () => {
      await authService.logout('old-token');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashRefreshToken('old-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('me', () => {
    it('devolve o usuário com o funcionário vinculado', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...activeUser,
        employee: { id: 'emp-1', name: 'Carlos', matricula: '123', jobTitle: null, photoUrl: null, isActive: true },
      });

      const result = await authService.me('u1');

      expect(result).toMatchObject({ id: 'u1', role: 'MOTORISTA', employee: { id: 'emp-1' } });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('omite funcionário inativo', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...activeUser,
        employee: { id: 'emp-1', name: 'Carlos', matricula: null, jobTitle: null, photoUrl: null, isActive: false },
      });
      expect((await authService.me('u1')).employee).toBeNull();
    });

    it('falha se o usuário não existir mais', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(authService.me('u1')).rejects.toThrow(NotFoundException);
    });
  });
});

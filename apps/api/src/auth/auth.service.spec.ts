import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  refreshToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('logs in with valid credentials and returns tokens', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash, deletedAt: null });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const result = await service.login({ email: 'a@b.com', password: 'password123' });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash: '$2a$10$0123456789012345678902g4Aq7d1j4XkH8pVg9Q0aU4YSPbE6vK', deletedAt: null });

    await expect(service.login({ email: 'a@b.com', password: 'wrong-password' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired refresh tokens', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({ token: 'abc', expiresAt: new Date(Date.now() - 1000), revokedAt: null });

    await expect(service.refresh({ refreshToken: 'abc' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes refresh tokens on logout', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1' });
    mockPrisma.refreshToken.update.mockResolvedValue({});

    await expect(service.logout('user-1', 'abc')).resolves.toBeUndefined();
  });
});

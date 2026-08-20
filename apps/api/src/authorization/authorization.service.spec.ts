import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from './authorization.service';
import { PrismaService } from '../common/prisma.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  const prisma = {
    userTenantMembership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorizationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
    jest.clearAllMocks();
  });

  it('denies tenant access when no membership exists', async () => {
    prisma.userTenantMembership.findFirst.mockResolvedValue(null);
    await expect(service.canAccessTenant('user-1', 'tenant-b')).resolves.toBe(false);
  });

  it('denies permissions when the role does not include them', async () => {
    prisma.userTenantMembership.findMany.mockResolvedValue([]);
    await expect(service.getUserPermissions('user-1', 'tenant-a')).resolves.toEqual(new Set());
  });
});

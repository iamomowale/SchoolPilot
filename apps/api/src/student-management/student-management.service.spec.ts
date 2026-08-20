import { Test, TestingModule } from '@nestjs/testing';
import { StudentManagementService } from './student-management.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';

describe('StudentManagementService', () => {
  let service: StudentManagementService;
  const prisma = {
    studentProfile: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    guardianProfile: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    studentGuardian: { findFirst: jest.fn(), create: jest.fn() },
    studentEnrollment: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentManagementService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<StudentManagementService>(StudentManagementService);
    jest.clearAllMocks();
  });

  it('prevents duplicate admission numbers on create', async () => {
    prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
    await expect(service.createStudent('tenant-a', { admissionNumber: 'A100', firstName: 'Ada', lastName: 'Lovelace' })).rejects.toThrow('Student admission number already exists');
  });

  it('previews CSV import rows', async () => {
    const result = await service.previewCsvImport('tenant-a', [{ admissionNumber: 'A100', firstName: 'Ada', lastName: 'Lovelace' }]);
    expect(result.summary.totalRows).toBe(1);
    expect(result.preview[0]).toMatchObject({ status: 'pending' });
  });
});

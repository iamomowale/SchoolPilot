import { Test, TestingModule } from '@nestjs/testing';
import { SchoolConfigService } from './school-config.service';
import { PrismaService } from '../common/prisma.service';

describe('SchoolConfigService', () => {
  let service: SchoolConfigService;
  const prisma = {
    branch: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    academicSession: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    term: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    schoolClass: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    section: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    subject: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    teacherAssignment: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchoolConfigService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SchoolConfigService>(SchoolConfigService);
    jest.clearAllMocks();
  });

  it('returns only teacher-assigned classes for teachers', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([{ classId: 'class-1' }, { classId: 'class-2' }]);
    prisma.schoolClass.findMany.mockResolvedValue([{ id: 'class-1' }]);

    await service.listClasses('tenant-1', 'teacher-1', false);

    expect(prisma.schoolClass.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        deletedAt: null,
        id: { in: ['class-1', 'class-2'] },
      }),
    }));
  });

  it('returns only teacher-assigned subjects for teachers', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([{ subjectId: 'subject-1' }, { subjectId: 'subject-2' }]);
    prisma.subject.findMany.mockResolvedValue([{ id: 'subject-1' }]);

    await service.listSubjects('tenant-1', 'teacher-1', false);

    expect(prisma.subject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        deletedAt: null,
        id: { in: ['subject-1', 'subject-2'] },
      }),
    }));
  });
});

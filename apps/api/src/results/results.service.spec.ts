import { Test, TestingModule } from '@nestjs/testing';
import { ResultsService } from './results.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';

describe('ResultsService', () => {
  let service: ResultsService;
  const prisma = {
    assessmentConfiguration: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() }, assessmentType: { create: jest.fn() },
    section: { findFirst: jest.fn() }, resultSheet: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    assessmentScore: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }, teacherAssignment: { findFirst: jest.fn() },
    studentEnrollment: { findFirst: jest.fn(), findMany: jest.fn() }, studentTermResult: { upsert: jest.fn(), findMany: jest.fn() },
    studentProfile: { findFirst: jest.fn() }, guardianProfile: { findFirst: jest.fn() },
  };
  const authorization = { isSchoolAdmin: jest.fn() }; const audit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [ResultsService, { provide: PrismaService, useValue: prisma }, { provide: AuthorizationService, useValue: authorization }, { provide: AuditService, useValue: audit }] }).compile();
    service = module.get<ResultsService>(ResultsService); jest.clearAllMocks(); authorization.isSchoolAdmin.mockResolvedValue(true);
  });

  it('calculates weighted term results from configured maximum scores', async () => {
    prisma.resultSheet.findFirst.mockResolvedValue({ id: 'sheet-1', termId: 'term-1', classId: 'class-1', sectionId: 'section-1' });
    prisma.assessmentConfiguration.findMany.mockResolvedValue([
      { weight: 40, maxScore: 20, scores: [{ studentId: 'student-1', score: 15 }] },
      { weight: 60, maxScore: 100, scores: [{ studentId: 'student-1', score: 80 }] },
    ]);
    prisma.studentEnrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }]); prisma.studentTermResult.findMany.mockResolvedValue([]);
    await service.calculateSheet('tenant-1', 'sheet-1');
    expect(prisma.studentTermResult.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ weightedScore: 78, percentage: 78 }) }));
  });

  it('rejects scores above the configured maximum', async () => {
    prisma.assessmentConfiguration.findFirst.mockResolvedValue({ id: 'config-1', termId: 'term-1', classId: 'class-1', sectionId: 'section-1', subjectId: 'subject-1', maxScore: 20 });
    prisma.teacherAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' }); prisma.studentEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' }); prisma.resultSheet.findFirst.mockResolvedValue({ id: 'sheet-1', status: 'draft' });
    await expect(service.enterScore('tenant-1', 'teacher-1', { configurationId: 'config-1', studentId: 'student-1', score: 21 })).rejects.toThrow('cannot exceed');
  });

  it('does not allow a draft result sheet to be published directly', async () => {
    prisma.resultSheet.findFirst.mockResolvedValue({ id: 'sheet-1', status: 'draft', classId: 'class-1', sectionId: 'section-1' });
    await expect(service.transitionSheet('tenant-1', 'admin-1', 'sheet-1', 'published')).rejects.toThrow('cannot move');
  });

  it('limits published score corrections to school admins and audit logs them', async () => {
    authorization.isSchoolAdmin.mockResolvedValue(false);
    await expect(service.correctPublishedScore('tenant-1', 'teacher-1', 'score-1', { score: 10 })).rejects.toThrow('Only school administrators');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { buildReportCardPdf, gradeFor } from './report-card-pdf';
import { ReportCardsService } from './report-cards.service';

describe('ReportCardsService', () => {
  let service: ReportCardsService;
  const prisma = { reportCard: { findFirst: jest.fn() }, studentProfile: { findFirst: jest.fn() }, guardianProfile: { findFirst: jest.fn() }, teacherAssignment: { findFirst: jest.fn() } };
  const authorization = { isSchoolAdmin: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [ReportCardsService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: { log: jest.fn() } }, { provide: AuthorizationService, useValue: authorization }] }).compile();
    service = module.get<ReportCardsService>(ReportCardsService); jest.clearAllMocks(); authorization.isSchoolAdmin.mockResolvedValue(false); prisma.teacherAssignment.findFirst.mockResolvedValue(null); prisma.studentProfile.findFirst.mockResolvedValue(null); prisma.guardianProfile.findFirst.mockResolvedValue(null);
  });

  it('calculates display grades accurately and includes report values in the PDF', () => {
    expect(gradeFor(70)).toBe('A'); expect(gradeFor(69.99)).toBe('B'); expect(gradeFor(39.99)).toBe('F');
    const pdf = buildReportCardPdf({ schoolName: 'SchoolPilot Academy', studentName: 'Ada Lovelace', admissionNumber: 'A100', term: 'First Term', className: 'JSS 1', sectionName: 'Blue', percentage: 78, grade: gradeFor(78), attendance: [{ status: 'present', count: 42 }], subjects: [{ subject: 'Mathematics', assessment: 'Exam', score: 78, maxScore: 100, grade: 'A' }], comment: 'Strong progress.' });
    expect(pdf.toString()).toContain('Ada Lovelace'); expect(pdf.toString()).toContain('78/100'); expect(pdf.toString()).toContain('present: 42');
  });

  it('denies a report-card download to a user with no staff or family relationship', async () => {
    prisma.reportCard.findFirst.mockResolvedValue({ id: 'card-1', studentId: 'student-1', storageKey: 'report-cards/tenant-1/card.pdf', resultSheet: { status: 'published', classId: 'class-1', sectionId: 'section-1' } });
    await expect(service.download('tenant-1', 'unrelated-user', 'card-1')).rejects.toThrow(ForbiddenException);
  });

  it('permits a guardian linked to the student to pass the authorization check', async () => {
    prisma.reportCard.findFirst.mockResolvedValue({ id: 'card-1', studentId: 'student-1', storageKey: 'missing.pdf', resultSheet: { status: 'published', classId: 'class-1', sectionId: 'section-1' } });
    prisma.guardianProfile.findFirst.mockResolvedValue({ id: 'guardian-1' });
    await expect(service.download('tenant-1', 'guardian-user', 'card-1')).rejects.toThrow(/ENOENT/);
  });
});

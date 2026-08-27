import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  const prisma = {
    branch: { findFirst: jest.fn() },
    academicSession: { findFirst: jest.fn() },
    term: { findFirst: jest.fn() },
    schoolClass: { findFirst: jest.fn() },
    studentEnrollment: { findMany: jest.fn() },
    attendanceRecord: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
    studentTermResult: { findMany: jest.fn() },
    reportExport: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const authorization = { hasPermission: jest.fn() };
  const audit = { log: jest.fn() };
  let service: ReportingService;

  beforeEach(() => {
    service = new ReportingService(prisma as unknown as PrismaService, authorization as unknown as AuthorizationService, audit as unknown as AuditService);
    jest.clearAllMocks();
    prisma.studentEnrollment.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.studentTermResult.findMany.mockResolvedValue([]);
  });

  it('scopes enrollment data to the tenant and requested branch, session, and class', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.academicSession.findFirst.mockResolvedValue({ id: 'session-1' });
    prisma.schoolClass.findFirst.mockResolvedValue({ id: 'class-1', branchId: 'branch-1' });

    await service.report('tenant-1', 'user-1', 'enrollment', { branchId: 'branch-1', sessionId: 'session-1', classId: 'class-1' });

    expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', branchId: 'branch-1', sessionId: 'session-1', classId: 'class-1' }) }));
  });

  it('rejects a filter record outside the tenant before querying report data', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(service.report('tenant-1', 'user-1', 'attendance', { branchId: 'branch-from-another-tenant' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('requires finance.manage before running a payment report', async () => {
    authorization.hasPermission.mockResolvedValue(false);

    await expect(service.report('tenant-1', 'user-1', 'payments', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('returns RFC 4180-safe CSV for a small export', async () => {
    prisma.studentEnrollment.findMany.mockResolvedValue([{ branchId: 'branch-1', sessionId: 'session-1', classId: 'class-1', sectionId: 'section-1', createdAt: new Date('2026-01-02T00:00:00.000Z'), student: { admissionNumber: 'A-1', firstName: 'Ada', lastName: 'O\'Neil', status: 'active' } }]);

    const result = await service.requestExport('tenant-1', 'user-1', 'enrollment', { asyncThreshold: 10 });

    expect(result).toEqual(expect.objectContaining({ status: 'completed', rowCount: 1, csv: expect.stringContaining('"Ada O\'Neil"') }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'export', tenantId: 'tenant-1' }));
  });
});

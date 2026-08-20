import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  const prisma = {
    section: { findFirst: jest.fn() },
    teacherAssignment: { findFirst: jest.fn() },
    studentEnrollment: { findMany: jest.fn() },
    attendanceRecord: { findMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const authorization = { isSchoolAdmin: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [AttendanceService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }, { provide: AuthorizationService, useValue: authorization }] }).compile();
    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
    prisma.section.findFirst.mockResolvedValue({ id: 'section-1' });
    prisma.teacherAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    prisma.studentEnrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.createMany.mockResolvedValue({ count: 1 });
    authorization.isSchoolAdmin.mockResolvedValue(false);
  });

  it('records attendance for a teacher assigned to the class', async () => {
    await service.record('tenant-1', 'teacher-1', { classId: 'class-1', sectionId: 'section-1', date: '2026-08-10', records: [{ studentId: 'student-1', status: 'present' }] });
    expect(prisma.teacherAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'teacher-1', classId: 'class-1', sectionId: 'section-1' }) }));
    expect(prisma.attendanceRecord.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ status: 'present', recordedById: 'teacher-1' })] }));
  });

  it('rejects duplicate attendance for the same student and date', async () => {
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
    await expect(service.record('tenant-1', 'teacher-1', { classId: 'class-1', sectionId: 'section-1', date: '2026-08-10', records: [{ studentId: 'student-1', status: 'present' }] })).rejects.toThrow('Attendance already exists');
  });

  it('allows only school admins to correct attendance and logs the correction', async () => {
    authorization.isSchoolAdmin.mockResolvedValue(true);
    prisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'attendance-1', status: 'absent' });
    prisma.attendanceRecord.update.mockResolvedValue({ id: 'attendance-1', status: 'present' });
    await service.correct('tenant-1', 'admin-1', 'attendance-1', 'present');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'correct', entityId: 'attendance-1', userId: 'admin-1' }));
  });
});

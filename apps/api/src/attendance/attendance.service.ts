import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { AttendanceQueryDto, AttendanceStatusValue, RecordAttendanceDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly authorization: AuthorizationService) {}

  async record(tenantId: string, userId: string, dto: RecordAttendanceDto) {
    await this.assertCanRecord(tenantId, userId, dto.classId, dto.sectionId);
    const date = this.dateOnly(dto.date);
    const studentIds = dto.records.map((record) => record.studentId);
    if (new Set(studentIds).size !== studentIds.length) throw new ConflictException('Each student may appear only once in an attendance submission');

    const enrolled = await this.prisma.studentEnrollment.findMany({ where: { tenantId, classId: dto.classId, sectionId: dto.sectionId, studentId: { in: studentIds }, deletedAt: null }, select: { studentId: true } });
    if (enrolled.length !== studentIds.length) throw new ForbiddenException('Attendance can only be recorded for students enrolled in the selected class and section');

    const existing = await this.prisma.attendanceRecord.findMany({ where: { tenantId, studentId: { in: studentIds }, attendanceDate: date }, select: { studentId: true } });
    if (existing.length) throw new ConflictException(`Attendance already exists for ${existing.map((record) => record.studentId).join(', ')}`);

    await this.prisma.attendanceRecord.createMany({ data: dto.records.map((record) => ({ tenantId, studentId: record.studentId, classId: dto.classId, sectionId: dto.sectionId, attendanceDate: date, status: record.status, recordedById: userId })) });
    await this.audit.log({ tenantId, userId, action: 'record', entityType: 'attendance', details: `Recorded ${dto.records.length} attendance records for ${dto.classId}/${dto.sectionId} on ${dto.date}` });
    return this.list(tenantId, { classId: dto.classId, sectionId: dto.sectionId, startDate: dto.date, endDate: dto.date });
  }

  async correct(tenantId: string, userId: string, id: string, status: AttendanceStatusValue) {
    if (!(await this.authorization.isSchoolAdmin(userId, tenantId))) throw new ForbiddenException('Only school administrators can correct attendance');
    const attendance = await this.prisma.attendanceRecord.findFirst({ where: { id, tenantId } });
    if (!attendance) throw new NotFoundException('Attendance record not found');
    const corrected = await this.prisma.attendanceRecord.update({ where: { id }, data: { status } });
    await this.audit.log({ tenantId, userId, action: 'correct', entityType: 'attendance', entityId: id, details: `Corrected attendance status from ${attendance.status} to ${status}` });
    return corrected;
  }

  async list(tenantId: string, query: AttendanceQueryDto) {
    return this.prisma.attendanceRecord.findMany({ where: { tenantId, ...(query.studentId ? { studentId: query.studentId } : {}), ...(query.classId ? { classId: query.classId } : {}), ...(query.sectionId ? { sectionId: query.sectionId } : {}), ...this.dateFilter(query) }, include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } }, orderBy: [{ attendanceDate: 'desc' }, { student: { lastName: 'asc' } }] });
  }

  async summary(tenantId: string, query: AttendanceQueryDto) {
    const where = { tenantId, ...(query.studentId ? { studentId: query.studentId } : {}), ...(query.classId ? { classId: query.classId } : {}), ...(query.sectionId ? { sectionId: query.sectionId } : {}), ...this.dateFilter(query) };
    const [byStatus, byStudent, byClass, records] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['studentId', 'status'], where, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['classId', 'status'], where, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['attendanceDate', 'status'], where, _count: { _all: true } }),
    ]);
    return { byStatus, byStudent, byClass, byDate: records };
  }

  async mySummary(tenantId: string, userId: string) {
    const [student, guardian] = await Promise.all([
      this.prisma.studentProfile.findFirst({ where: { tenantId, userId, deletedAt: null }, select: { id: true } }),
      this.prisma.guardianProfile.findFirst({ where: { tenantId, userId, deletedAt: null }, include: { studentGuardians: { where: { deletedAt: null }, select: { studentId: true } } } }),
    ]);
    const studentIds = [...new Set([student?.id, ...(guardian?.studentGuardians.map((relation) => relation.studentId) ?? [])].filter(Boolean))] as string[];
    if (!studentIds.length) throw new ForbiddenException('You are not linked to a student attendance record');
    const byStatus = await this.prisma.attendanceRecord.groupBy({ by: ['studentId', 'status'], where: { tenantId, studentId: { in: studentIds } }, _count: { _all: true } });
    return { byStudent: byStatus };
  }

  private async assertCanRecord(tenantId: string, userId: string, classId: string, sectionId: string) {
    const section = await this.prisma.section.findFirst({ where: { id: sectionId, tenantId, classId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!section) throw new NotFoundException('Section not found in the selected class');
    if (await this.authorization.isSchoolAdmin(userId, tenantId)) return;
    const assignment = await this.prisma.teacherAssignment.findFirst({ where: { tenantId, userId, classId, sectionId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!assignment) throw new ForbiddenException('You are not assigned to this class and section');
  }

  private dateFilter(query: AttendanceQueryDto) {
    if (!query.startDate && !query.endDate) return {};
    return { attendanceDate: { ...(query.startDate ? { gte: this.dateOnly(query.startDate) } : {}), ...(query.endDate ? { lte: this.dateOnly(query.endDate) } : {}) } };
  }

  private dateOnly(value: string) { return new Date(`${value.slice(0, 10)}T00:00:00.000Z`); }
}

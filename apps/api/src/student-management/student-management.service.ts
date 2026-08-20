import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';

@Injectable()
export class StudentManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listStudents(tenantId: string) {
    return this.prisma.studentProfile.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createStudent(tenantId: string, data: { admissionNumber: string; firstName: string; lastName: string; email?: string; phone?: string; status?: string; dateOfBirth?: Date }) {
    const existing = await this.prisma.studentProfile.findFirst({ where: { tenantId, admissionNumber: data.admissionNumber, deletedAt: null } });
    if (existing) {
      throw new Error('Student admission number already exists');
    }
    const student = await this.prisma.studentProfile.create({ data: { tenantId, ...data } });
    await this.auditService.log({ tenantId, userId: undefined, action: 'create', entityType: 'student', entityId: student.id, details: `Created student ${student.admissionNumber}` });
    return student;
  }

  async updateStudent(tenantId: string, id: string, data: Partial<{ admissionNumber: string; firstName: string; lastName: string; email?: string; phone?: string; status: string; dateOfBirth: Date }>) {
    const student = await this.prisma.studentProfile.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');
    const updated = await this.prisma.studentProfile.update({ where: { id }, data });
    await this.auditService.log({ tenantId, action: 'update', entityType: 'student', entityId: updated.id, details: `Updated student ${updated.admissionNumber}` });
    return updated;
  }

  async deleteStudent(tenantId: string, id: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');
    const deleted = await this.prisma.studentProfile.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log({ tenantId, action: 'delete', entityType: 'student', entityId: deleted.id, details: `Deleted student ${deleted.admissionNumber}` });
    return deleted;
  }

  async listGuardians(tenantId: string) {
    return this.prisma.guardianProfile.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  async createGuardian(tenantId: string, data: { firstName: string; lastName: string; email?: string; phone?: string; relationship?: string }) {
    const duplicate = await this.prisma.guardianProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ email: data.email }, { phone: data.phone }],
      },
    });
    if (duplicate) throw new Error('Guardian contact details already exist');
    const guardian = await this.prisma.guardianProfile.create({ data: { tenantId, ...data } });
    await this.auditService.log({ tenantId, action: 'create', entityType: 'guardian', entityId: guardian.id, details: `Created guardian ${guardian.firstName}` });
    return guardian;
  }

  async updateGuardian(tenantId: string, id: string, data: Partial<{ firstName: string; lastName: string; email?: string; phone?: string; relationship: string }>) {
    const guardian = await this.prisma.guardianProfile.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guardian) throw new NotFoundException('Guardian not found');
    const updated = await this.prisma.guardianProfile.update({ where: { id }, data });
    await this.auditService.log({ tenantId, action: 'update', entityType: 'guardian', entityId: updated.id, details: `Updated guardian ${updated.firstName}` });
    return updated;
  }

  async deleteGuardian(tenantId: string, id: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guardian) throw new NotFoundException('Guardian not found');
    const deleted = await this.prisma.guardianProfile.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log({ tenantId, action: 'delete', entityType: 'guardian', entityId: deleted.id, details: `Deleted guardian ${deleted.firstName}` });
    return deleted;
  }

  async createRelationship(tenantId: string, data: { studentId: string; guardianId: string; relationship: string }) {
    const existing = await this.prisma.studentGuardian.findFirst({ where: { tenantId, studentId: data.studentId, guardianId: data.guardianId, deletedAt: null } });
    if (existing) return existing;
    const relationship = await this.prisma.studentGuardian.create({ data: { tenantId, ...data } });
    await this.auditService.log({ tenantId, action: 'create', entityType: 'student-guardian', entityId: relationship.id, details: `Linked student and guardian` });
    return relationship;
  }

  async enrollStudent(tenantId: string, data: { studentId: string; sessionId: string; branchId: string; classId: string; sectionId: string }) {
    const enrollment = await this.prisma.studentEnrollment.create({ data: { tenantId, ...data } });
    await this.auditService.log({ tenantId, action: 'create', entityType: 'enrollment', entityId: enrollment.id, details: 'Created enrollment' });
    return enrollment;
  }

  async previewCsvImport(tenantId: string, rows: Array<Record<string, string>>) {
    const preview = rows.map((row, index) => ({ index, row, status: 'pending' }));
    return { preview, summary: { totalRows: rows.length, validRows: preview.length } };
  }

  async importCsv(tenantId: string, rows: Array<Record<string, string>>, userId?: string) {
    const preview = [] as Array<Record<string, unknown>>;
    const errors = [] as Array<Record<string, unknown>>;
    for (const [index, row] of rows.entries()) {
      if (!row.admissionNumber || !row.firstName || !row.lastName) {
        errors.push({ index, row, error: 'Missing required student fields' });
        continue;
      }
      const exists = await this.prisma.studentProfile.findFirst({ where: { tenantId, admissionNumber: row.admissionNumber, deletedAt: null } });
      if (exists) {
        errors.push({ index, row, error: 'Duplicate admission number' });
        continue;
      }
      const student = await this.prisma.studentProfile.create({ data: { tenantId, admissionNumber: row.admissionNumber, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, status: row.status ?? 'active' } });
      preview.push({ index, studentId: student.id, status: 'imported' });
      await this.auditService.log({ tenantId, userId, action: 'import', entityType: 'student', entityId: student.id, details: `Imported student ${student.admissionNumber}` });
    }
    return { preview, errors, summary: { totalRows: rows.length, importedRows: preview.length, errorRows: errors.length } };
  }
}

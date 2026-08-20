import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SchoolConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches(tenantId: string, _userId?: string, _isAdmin = false) {
    return this.prisma.branch.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBranch(tenantId: string, data: { name: string; code: string }) {
    return this.prisma.branch.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
      },
    });
  }

  async updateBranch(tenantId: string, id: string, data: { name?: string; code?: string; isActive?: boolean }) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.prisma.branch.update({ where: { id }, data });
  }

  async deleteBranch(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listAcademicSessions(tenantId: string, _userId?: string, _isAdmin = false) {
    return this.prisma.academicSession.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAcademicSession(tenantId: string, data: { name: string; branchId?: string; startsAt: Date | string; endsAt: Date | string }) {
    return this.prisma.academicSession.create({
      data: {
        tenantId,
        name: data.name,
        branchId: data.branchId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
      },
    });
  }

  async updateAcademicSession(tenantId: string, id: string, data: { name?: string; branchId?: string; startsAt?: Date | string; endsAt?: Date | string; isActive?: boolean }) {
    const session = await this.prisma.academicSession.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!session) throw new NotFoundException('Academic session not found');
    const updateData: Record<string, unknown> = { ...data };
    if (typeof data.startsAt !== 'undefined') updateData.startsAt = new Date(data.startsAt);
    if (typeof data.endsAt !== 'undefined') updateData.endsAt = new Date(data.endsAt);
    return this.prisma.academicSession.update({ where: { id }, data: updateData });
  }

  async deleteAcademicSession(tenantId: string, id: string) {
    const session = await this.prisma.academicSession.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!session) throw new NotFoundException('Academic session not found');
    return this.prisma.academicSession.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listTerms(tenantId: string, _userId?: string, _isAdmin = false) {
    return this.prisma.term.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  async createTerm(tenantId: string, data: { name: string; branchId?: string; academicSessionId: string; startsAt: Date | string; endsAt: Date | string }) {
    return this.prisma.term.create({
      data: {
        tenantId,
        name: data.name,
        branchId: data.branchId,
        academicSessionId: data.academicSessionId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
      },
    });
  }

  async updateTerm(tenantId: string, id: string, data: { name?: string; branchId?: string; academicSessionId?: string; startsAt?: Date | string; endsAt?: Date | string; isActive?: boolean }) {
    const term = await this.prisma.term.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!term) throw new NotFoundException('Term not found');
    const updateData: Record<string, unknown> = { ...data };
    if (typeof data.startsAt !== 'undefined') updateData.startsAt = new Date(data.startsAt);
    if (typeof data.endsAt !== 'undefined') updateData.endsAt = new Date(data.endsAt);
    return this.prisma.term.update({ where: { id }, data: updateData });
  }

  async deleteTerm(tenantId: string, id: string) {
    const term = await this.prisma.term.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!term) throw new NotFoundException('Term not found');
    return this.prisma.term.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listClasses(tenantId: string, userId?: string, isAdmin = false) {
    if (!isAdmin && !userId) return [];
    const assignedClassIds = isAdmin ? [] : await this.getTeacherAssignedEntityIds(userId, tenantId, 'class');
    return this.prisma.schoolClass.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isAdmin ? {} : assignedClassIds.length > 0 ? { id: { in: assignedClassIds } } : { id: { in: [] } }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createClass(tenantId: string, data: { name: string; code: string; branchId?: string; academicSessionId?: string }) {
    return this.prisma.schoolClass.create({ data: { tenantId, ...data } });
  }

  async updateClass(tenantId: string, id: string, data: { name?: string; code?: string; branchId?: string; academicSessionId?: string; isActive?: boolean }) {
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!schoolClass) throw new NotFoundException('Class not found');
    return this.prisma.schoolClass.update({ where: { id }, data });
  }

  async deleteClass(tenantId: string, id: string) {
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!schoolClass) throw new NotFoundException('Class not found');
    return this.prisma.schoolClass.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listSections(tenantId: string, _userId?: string, _isAdmin = false) {
    return this.prisma.section.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSection(tenantId: string, data: { name: string; classId: string; capacity?: number }) {
    return this.prisma.section.create({ data: { tenantId, ...data } });
  }

  async updateSection(tenantId: string, id: string, data: { name?: string; classId?: string; capacity?: number; isActive?: boolean }) {
    const section = await this.prisma.section.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!section) throw new NotFoundException('Section not found');
    return this.prisma.section.update({ where: { id }, data });
  }

  async deleteSection(tenantId: string, id: string) {
    const section = await this.prisma.section.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!section) throw new NotFoundException('Section not found');
    return this.prisma.section.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listSubjects(tenantId: string, userId?: string, isAdmin = false) {
    if (!isAdmin && !userId) return [];
    const assignedSubjectIds = isAdmin ? [] : await this.getTeacherAssignedEntityIds(userId, tenantId, 'subject');
    return this.prisma.subject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isAdmin ? {} : assignedSubjectIds.length > 0 ? { id: { in: assignedSubjectIds } } : { id: { in: [] } }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSubject(tenantId: string, data: { name: string; code: string; branchId?: string }) {
    return this.prisma.subject.create({ data: { tenantId, ...data } });
  }

  async updateSubject(tenantId: string, id: string, data: { name?: string; code?: string; branchId?: string; isActive?: boolean }) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.subject.update({ where: { id }, data });
  }

  async deleteSubject(tenantId: string, id: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listTeacherAssignments(tenantId: string, userId?: string, isAdmin = false) {
    return this.prisma.teacherAssignment.findMany({
      where: { tenantId, deletedAt: null, ...(isAdmin ? {} : { userId: userId ?? '' }) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTeacherAssignment(tenantId: string, data: { userId: string; classId?: string; sectionId?: string; subjectId?: string; branchId?: string }) {
    return this.prisma.teacherAssignment.create({ data: { tenantId, ...data } });
  }

  async updateTeacherAssignment(tenantId: string, id: string, data: { userId?: string; classId?: string; sectionId?: string; subjectId?: string; branchId?: string; isActive?: boolean }) {
    const assignment = await this.prisma.teacherAssignment.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!assignment) throw new NotFoundException('Teacher assignment not found');
    return this.prisma.teacherAssignment.update({ where: { id }, data });
  }

  async deleteTeacherAssignment(tenantId: string, id: string) {
    const assignment = await this.prisma.teacherAssignment.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!assignment) throw new NotFoundException('Teacher assignment not found');
    return this.prisma.teacherAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async getTeacherAssignedEntityIds(userId: string | undefined, tenantId: string, entity: 'class' | 'subject') {
    if (!userId) return [];
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { tenantId, userId, deletedAt: null, isActive: true },
      select: { classId: true, subjectId: true },
    });
    if (entity === 'class') return assignments.map((item) => item.classId).filter((value): value is string => Boolean(value));
    return assignments.map((item) => item.subjectId).filter((value): value is string => Boolean(value));
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { GenerateReportCardDto } from './dto';
import { buildReportCardPdf, gradeFor, type ReportCardPdfData } from './report-card-pdf';

@Injectable()
export class ReportCardsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly authorization: AuthorizationService) {}

  async generate(tenantId: string, userId: string, sheetId: string, dto: GenerateReportCardDto) {
    const sheet = await this.prisma.resultSheet.findFirst({ where: { id: sheetId, tenantId }, include: { term: true, schoolClass: true, section: true } });
    if (!sheet) throw new NotFoundException('Result sheet not found');
    await this.assertStaffForSheet(tenantId, userId, sheet.classId, sheet.sectionId);
    if (sheet.status !== 'published') throw new ForbiddenException('Report cards can only be generated from published results');
    const result = await this.prisma.studentTermResult.findFirst({ where: { tenantId, resultSheetId: sheet.id, studentId: dto.studentId }, include: { student: true } });
    if (!result) throw new NotFoundException('Student result not found on this sheet');
    const existing = await this.prisma.reportCard.findFirst({ where: { resultSheetId: sheet.id, studentId: dto.studentId } });
    const card = existing ? await this.prisma.reportCard.update({ where: { id: existing.id }, data: { teacherComment: dto.teacherComment ?? existing.teacherComment, generatedById: userId } }) : await this.prisma.reportCard.create({ data: { tenantId, resultSheetId: sheet.id, studentId: dto.studentId, teacherComment: dto.teacherComment, generatedById: userId, storageKey: `report-cards/${tenantId}/${sheet.id}-${dto.studentId}.pdf` } });
    const pdf = buildReportCardPdf(await this.reportData(tenantId, sheet, result, card.teacherComment));
    await this.store(card.storageKey, pdf);
    await this.audit.log({ tenantId, userId, action: 'generate', entityType: 'report-card', entityId: card.id, details: `Generated report card for ${result.student.admissionNumber}` });
    return card;
  }

  async download(tenantId: string, userId: string, id: string) {
    const card = await this.prisma.reportCard.findFirst({ where: { id, tenantId }, include: { resultSheet: true } });
    if (!card) throw new NotFoundException('Report card not found');
    if (card.resultSheet.status !== 'published') throw new ForbiddenException('Only published report cards can be downloaded');
    await this.assertCanView(tenantId, userId, card.studentId, card.resultSheet.classId, card.resultSheet.sectionId);
    await this.audit.log({ tenantId, userId, action: 'download', entityType: 'report-card', entityId: card.id, details: 'Downloaded published report card' });
    return { card, buffer: await readFile(this.pathFor(card.storageKey)) };
  }

  private async reportData(tenantId: string, sheet: { termId: string; classId: string; sectionId: string; term: { name: string }; schoolClass: { name: string }; section: { name: string } }, result: { studentId: string; percentage: number; student: { firstName: string; lastName: string; admissionNumber: string } }, comment?: string | null): Promise<ReportCardPdfData> {
    const [configs, attendance] = await Promise.all([
      this.prisma.assessmentConfiguration.findMany({ where: { tenantId, termId: sheet.termId, classId: sheet.classId, sectionId: sheet.sectionId, deletedAt: null }, include: { subject: true, assessmentType: true, scores: { where: { studentId: result.studentId } } } }),
      this.prisma.attendanceRecord.groupBy({ by: ['status'], where: { tenantId, studentId: result.studentId, classId: sheet.classId, sectionId: sheet.sectionId }, _count: { _all: true } }),
    ]);
    return { schoolName: 'SchoolPilot Academy', studentName: `${result.student.firstName} ${result.student.lastName}`, admissionNumber: result.student.admissionNumber, term: sheet.term.name, className: sheet.schoolClass.name, sectionName: sheet.section.name, percentage: result.percentage, grade: gradeFor(result.percentage), attendance: attendance.map((item) => ({ status: item.status, count: item._count._all })), subjects: configs.map((config) => { const score = config.scores[0]?.score ?? 0; return { subject: config.subject.name, assessment: config.assessmentType.name, score, maxScore: config.maxScore, grade: gradeFor((score / config.maxScore) * 100) }; }), comment };
  }

  private async assertStaffForSheet(tenantId: string, userId: string, classId: string, sectionId: string) { if (await this.authorization.isSchoolAdmin(userId, tenantId)) return; const assignment = await this.prisma.teacherAssignment.findFirst({ where: { tenantId, userId, classId, sectionId, deletedAt: null, isActive: true } }); if (!assignment) throw new ForbiddenException('You are not assigned to this class and section'); }
  private async assertCanView(tenantId: string, userId: string, studentId: string, classId: string, sectionId: string) { try { await this.assertStaffForSheet(tenantId, userId, classId, sectionId); return; } catch (error) { if (!(error instanceof ForbiddenException)) throw error; } const [student, guardian] = await Promise.all([this.prisma.studentProfile.findFirst({ where: { id: studentId, tenantId, userId, deletedAt: null }, select: { id: true } }), this.prisma.guardianProfile.findFirst({ where: { tenantId, userId, deletedAt: null, studentGuardians: { some: { studentId, deletedAt: null } } }, select: { id: true } })]); if (!student && !guardian) throw new ForbiddenException('You can only download your own or linked student report card'); }
  private storageRoot() { return resolve(process.env.REPORT_CARD_STORAGE_DIR || join(process.cwd(), 'storage', 'report-cards')); }
  private pathFor(key: string) { const path = resolve(this.storageRoot(), key); if (!path.startsWith(this.storageRoot())) throw new ForbiddenException('Invalid storage key'); return path; }
  private async store(key: string, pdf: Buffer) { const path = this.pathFor(key); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, pdf, { mode: 0o600 }); }
}

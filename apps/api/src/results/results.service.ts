import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { ChangeScoreDto, CreateAssessmentConfigurationDto, CreateAssessmentTypeDto, CreateResultSheetDto, EnterScoreDto, PublishedResultsQueryDto, ResultStatusValue } from './dto';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly authorization: AuthorizationService) {}

  async createAssessmentType(tenantId: string, userId: string, dto: CreateAssessmentTypeDto) {
    await this.assertAdmin(tenantId, userId);
    return this.prisma.assessmentType.create({ data: { tenantId, ...dto } });
  }

  async createConfiguration(tenantId: string, userId: string, dto: CreateAssessmentConfigurationDto) {
    await this.assertAdmin(tenantId, userId);
    const section = await this.prisma.section.findFirst({ where: { id: dto.sectionId, classId: dto.classId, tenantId, deletedAt: null } });
    if (!section) throw new NotFoundException('Section not found in the selected class');
    return this.prisma.assessmentConfiguration.create({ data: { tenantId, ...dto } });
  }

  async createSheet(tenantId: string, userId: string, dto: CreateResultSheetDto) {
    await this.assertAdmin(tenantId, userId);
    return this.prisma.resultSheet.create({ data: { tenantId, ...dto } });
  }

  async enterScore(tenantId: string, userId: string, dto: EnterScoreDto) {
    const config = await this.configuration(tenantId, dto.configurationId);
    await this.assertTeacherAssignment(tenantId, userId, config.classId, config.sectionId, config.subjectId);
    await this.assertStudentEnrolled(tenantId, dto.studentId, config.classId, config.sectionId);
    const sheet = await this.sheetForConfig(tenantId, config);
    this.assertDraft(sheet.status);
    if (dto.score > config.maxScore) throw new ConflictException(`Score cannot exceed the configured maximum of ${config.maxScore}`);
    const existing = await this.prisma.assessmentScore.findFirst({ where: { configurationId: dto.configurationId, studentId: dto.studentId } });
    if (existing) throw new ConflictException('A score already exists for this student and assessment');
    const score = await this.prisma.assessmentScore.create({ data: { tenantId, ...dto, enteredById: userId } });
    await this.calculateSheet(tenantId, sheet.id);
    return score;
  }

  async updateScore(tenantId: string, userId: string, id: string, dto: ChangeScoreDto) {
    const score = await this.score(tenantId, id);
    await this.assertTeacherAssignment(tenantId, userId, score.configuration.classId, score.configuration.sectionId, score.configuration.subjectId);
    const sheet = await this.sheetForConfig(tenantId, score.configuration);
    this.assertDraft(sheet.status);
    if (dto.score > score.configuration.maxScore) throw new ConflictException(`Score cannot exceed the configured maximum of ${score.configuration.maxScore}`);
    const updated = await this.prisma.assessmentScore.update({ where: { id }, data: { score: dto.score } });
    await this.calculateSheet(tenantId, sheet.id);
    return updated;
  }

  async correctPublishedScore(tenantId: string, userId: string, id: string, dto: ChangeScoreDto) {
    await this.assertAdmin(tenantId, userId);
    const score = await this.score(tenantId, id);
    const sheet = await this.sheetForConfig(tenantId, score.configuration);
    if (sheet.status !== 'published') throw new ConflictException('Use normal score editing until the result sheet is published');
    if (dto.score > score.configuration.maxScore) throw new ConflictException(`Score cannot exceed the configured maximum of ${score.configuration.maxScore}`);
    const updated = await this.prisma.assessmentScore.update({ where: { id }, data: { score: dto.score } });
    await this.calculateSheet(tenantId, sheet.id);
    await this.audit.log({ tenantId, userId, action: 'correct', entityType: 'published-score', entityId: id, details: `Corrected published score from ${score.score} to ${dto.score}` });
    return updated;
  }

  async transitionSheet(tenantId: string, userId: string, id: string, status: ResultStatusValue) {
    const sheet = await this.prisma.resultSheet.findFirst({ where: { id, tenantId } });
    if (!sheet) throw new NotFoundException('Result sheet not found');
    if (status === 'submitted') await this.assertTeacherAssignment(tenantId, userId, sheet.classId, sheet.sectionId);
    else await this.assertAdmin(tenantId, userId);
    const allowed: Record<string, string> = { draft: 'submitted', submitted: 'approved', approved: 'published' };
    if (allowed[sheet.status] !== status) throw new ConflictException(`Result sheet cannot move from ${sheet.status} to ${status}`);
    if (status === 'submitted' || status === 'published') await this.calculateSheet(tenantId, sheet.id);
    const updated = await this.prisma.resultSheet.update({ where: { id }, data: { status } });
    await this.audit.log({ tenantId, userId, action: status, entityType: 'result-sheet', entityId: id, details: `Changed result sheet from ${sheet.status} to ${status}` });
    return updated;
  }

  async calculateSheet(tenantId: string, sheetId: string) {
    const sheet = await this.prisma.resultSheet.findFirst({ where: { id: sheetId, tenantId } });
    if (!sheet) throw new NotFoundException('Result sheet not found');
    const [configs, enrollments] = await Promise.all([
      this.prisma.assessmentConfiguration.findMany({ where: { tenantId, termId: sheet.termId, classId: sheet.classId, sectionId: sheet.sectionId, deletedAt: null }, include: { scores: true } }),
      this.prisma.studentEnrollment.findMany({ where: { tenantId, classId: sheet.classId, sectionId: sheet.sectionId, deletedAt: null }, select: { studentId: true } }),
    ]);
    const totalWeight = configs.reduce((sum, config) => sum + config.weight, 0);
    await Promise.all(enrollments.map((enrollment) => {
      const weightedScore = configs.reduce((sum, config) => sum + ((config.scores.find((score) => score.studentId === enrollment.studentId)?.score ?? 0) / config.maxScore) * config.weight, 0);
      return this.prisma.studentTermResult.upsert({ where: { resultSheetId_studentId: { resultSheetId: sheet.id, studentId: enrollment.studentId } }, update: { weightedScore, percentage: totalWeight ? (weightedScore / totalWeight) * 100 : 0 }, create: { tenantId, resultSheetId: sheet.id, studentId: enrollment.studentId, weightedScore, percentage: totalWeight ? (weightedScore / totalWeight) * 100 : 0 } });
    }));
    return this.prisma.studentTermResult.findMany({ where: { resultSheetId: sheet.id }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } });
  }

  async calculateForUser(tenantId: string, userId: string, sheetId: string) {
    const sheet = await this.prisma.resultSheet.findFirst({ where: { id: sheetId, tenantId } });
    if (!sheet) throw new NotFoundException('Result sheet not found');
    await this.assertTeacherAssignment(tenantId, userId, sheet.classId, sheet.sectionId);
    return this.calculateSheet(tenantId, sheetId);
  }

  async myPublishedResults(tenantId: string, userId: string, query: PublishedResultsQueryDto) {
    const [student, guardian] = await Promise.all([
      this.prisma.studentProfile.findFirst({ where: { tenantId, userId, deletedAt: null }, select: { id: true } }),
      this.prisma.guardianProfile.findFirst({ where: { tenantId, userId, deletedAt: null }, include: { studentGuardians: { where: { deletedAt: null }, select: { studentId: true } } } }),
    ]);
    const studentIds = [...new Set([student?.id, ...(guardian?.studentGuardians.map((relation) => relation.studentId) ?? [])].filter(Boolean))] as string[];
    if (!studentIds.length) throw new ForbiddenException('You are not linked to a student result');
    return this.prisma.studentTermResult.findMany({ where: { tenantId, studentId: { in: studentIds }, resultSheet: { status: 'published', ...(query.termId ? { termId: query.termId } : {}) } }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, resultSheet: { include: { term: { select: { name: true } } } } }, orderBy: { updatedAt: 'desc' } });
  }

  private async configuration(tenantId: string, id: string) { const config = await this.prisma.assessmentConfiguration.findFirst({ where: { id, tenantId, deletedAt: null } }); if (!config) throw new NotFoundException('Assessment configuration not found'); return config; }
  private async score(tenantId: string, id: string) { const score = await this.prisma.assessmentScore.findFirst({ where: { id, tenantId }, include: { configuration: true } }); if (!score) throw new NotFoundException('Assessment score not found'); return score; }
  private async sheetForConfig(tenantId: string, config: { termId: string; classId: string; sectionId: string }) { const sheet = await this.prisma.resultSheet.findFirst({ where: { tenantId, termId: config.termId, classId: config.classId, sectionId: config.sectionId } }); if (!sheet) throw new NotFoundException('Create a result sheet before entering scores'); return sheet; }
  private assertDraft(status: string) { if (status !== 'draft') throw new ConflictException('Scores are read-only once results are submitted'); }
  private async assertAdmin(tenantId: string, userId: string) { if (!(await this.authorization.isSchoolAdmin(userId, tenantId))) throw new ForbiddenException('Only school administrators can perform this action'); }
  private async assertTeacherAssignment(tenantId: string, userId: string, classId: string, sectionId: string, subjectId?: string) { if (await this.authorization.isSchoolAdmin(userId, tenantId)) return; const assignment = await this.prisma.teacherAssignment.findFirst({ where: { tenantId, userId, classId, sectionId, ...(subjectId ? { subjectId } : {}), deletedAt: null, isActive: true } }); if (!assignment) throw new ForbiddenException('You are not assigned to this class, section, and subject'); }
  private async assertStudentEnrolled(tenantId: string, studentId: string, classId: string, sectionId: string) { const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { tenantId, studentId, classId, sectionId, deletedAt: null } }); if (!enrollment) throw new ForbiddenException('Student is not enrolled in this class and section'); }
}

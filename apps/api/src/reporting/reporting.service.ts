import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportExportType } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PermissionKeys } from '../authorization/permissions';
import { PrismaService } from '../common/prisma.service';
import { ExportRequestDto, ReportFiltersDto, ReportType } from './dto';

type CsvReport = { headers: string[]; rows: Array<Record<string, string | number | null>> };

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  async report(tenantId: string, userId: string, type: ReportType, filters: ReportFiltersDto) {
    await this.assertFinancialPermission(tenantId, userId, type);
    return this.buildReport(tenantId, type, filters);
  }

  async requestExport(tenantId: string, userId: string, type: ReportType, dto: ExportRequestDto) {
    await this.assertFinancialPermission(tenantId, userId, type);
    const filters = this.cleanFilters(dto);
    const report = await this.buildReport(tenantId, type, filters);
    const threshold = dto.asyncThreshold ?? Number(process.env.REPORT_EXPORT_ASYNC_THRESHOLD || '1000');
    if (report.rows.length <= threshold) {
      await this.audit.log({ tenantId, userId, action: 'export', entityType: `report-${type}`, details: `Generated CSV export with ${report.rows.length} rows` });
      return { status: 'completed' as const, filename: this.filename(type), csv: this.toCsv(report), rowCount: report.rows.length };
    }
    const job = await this.prisma.reportExport.create({ data: { tenantId, requestedById: userId, type: type as ReportExportType, filters: filters as Prisma.InputJsonValue, rowCount: report.rows.length } });
    await this.audit.log({ tenantId, userId, action: 'queue-export', entityType: `report-${type}`, entityId: job.id, details: `Queued CSV export with ${report.rows.length} rows` });
    return job;
  }

  async exportStatus(tenantId: string, userId: string, id: string) {
    const job = await this.prisma.reportExport.findFirst({ where: { id, tenantId, requestedById: userId } });
    if (!job) throw new NotFoundException('Report export not found');
    await this.assertFinancialPermission(tenantId, userId, job.type as ReportType);
    return job;
  }

  async downloadExport(tenantId: string, userId: string, id: string) {
    const job = await this.exportStatus(tenantId, userId, id);
    if (job.status !== 'completed' || !job.storageKey) throw new ForbiddenException('Report export is not ready for download');
    await this.audit.log({ tenantId, userId, action: 'download-export', entityType: `report-${job.type}`, entityId: id, details: 'Downloaded completed CSV export' });
    return { filename: this.filename(job.type as ReportType), csv: (await readFile(this.pathFor(job.storageKey))).toString('utf8') };
  }

  async generateQueuedExport(id: string) {
    const job = await this.prisma.reportExport.findFirst({ where: { id } });
    if (!job || job.status === 'completed') return;
    await this.prisma.reportExport.update({ where: { id }, data: { status: 'processing', error: null } });
    try {
      const report = await this.buildReport(job.tenantId, job.type as ReportType, job.filters as unknown as ReportFiltersDto);
      const storageKey = `${job.tenantId}/${job.id}.csv`;
      await this.store(storageKey, this.toCsv(report));
      await this.prisma.reportExport.update({ where: { id }, data: { status: 'completed', rowCount: report.rows.length, storageKey, completedAt: new Date() } });
      await this.audit.log({ tenantId: job.tenantId, userId: job.requestedById, action: 'complete-export', entityType: `report-${job.type}`, entityId: id, details: `Completed CSV export with ${report.rows.length} rows` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export failure';
      await this.prisma.reportExport.update({ where: { id }, data: { status: 'failed', error: message } });
      await this.audit.log({ tenantId: job.tenantId, userId: job.requestedById, action: 'fail-export', entityType: `report-${job.type}`, entityId: id, details: message });
      throw error;
    }
  }

  private async buildReport(tenantId: string, type: ReportType, filters: ReportFiltersDto): Promise<CsvReport> {
    await this.validateFilters(tenantId, filters);
    if (type === 'enrollment') return this.enrollmentReport(tenantId, filters);
    if (type === 'attendance') return this.attendanceReport(tenantId, filters);
    if (type === 'outstanding_fees') return this.outstandingFeesReport(tenantId, filters);
    if (type === 'payments') return this.paymentsReport(tenantId, filters);
    return this.performanceReport(tenantId, filters);
  }

  private async enrollmentReport(tenantId: string, filters: ReportFiltersDto): Promise<CsvReport> {
    const records = await this.prisma.studentEnrollment.findMany({ where: { tenantId, deletedAt: null, ...(filters.branchId ? { branchId: filters.branchId } : {}), ...(filters.sessionId ? { sessionId: filters.sessionId } : {}), ...(filters.classId ? { classId: filters.classId } : {}), ...this.createdDateFilter(filters) }, include: { student: { select: { admissionNumber: true, firstName: true, lastName: true, status: true } } }, orderBy: { createdAt: 'desc' } });
    return { headers: ['admission_number', 'student_name', 'student_status', 'branch_id', 'session_id', 'class_id', 'section_id', 'enrolled_at'], rows: records.map((row) => ({ admission_number: row.student.admissionNumber, student_name: `${row.student.firstName} ${row.student.lastName}`, student_status: row.student.status, branch_id: row.branchId, session_id: row.sessionId, class_id: row.classId, section_id: row.sectionId, enrolled_at: row.createdAt.toISOString() })) };
  }

  private async attendanceReport(tenantId: string, filters: ReportFiltersDto): Promise<CsvReport> {
    const records = await this.prisma.attendanceRecord.findMany({ where: { tenantId, ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.branchId ? { schoolClass: { branchId: filters.branchId } } : {}), ...this.attendanceDateFilter(filters) }, include: { student: { select: { admissionNumber: true, firstName: true, lastName: true } } }, orderBy: { attendanceDate: 'desc' } });
    return { headers: ['attendance_date', 'admission_number', 'student_name', 'class_id', 'section_id', 'status'], rows: records.map((row) => ({ attendance_date: row.attendanceDate.toISOString().slice(0, 10), admission_number: row.student.admissionNumber, student_name: `${row.student.firstName} ${row.student.lastName}`, class_id: row.classId, section_id: row.sectionId, status: row.status })) };
  }

  private async outstandingFeesReport(tenantId: string, filters: ReportFiltersDto): Promise<CsvReport> {
    const records = await this.prisma.invoice.findMany({ where: { tenantId, status: { in: ['issued', 'partially_paid'] }, balance: { gt: 0 }, ...(filters.sessionId ? { sessionId: filters.sessionId } : {}), ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.branchId ? { schoolClass: { branchId: filters.branchId } } : {}), ...this.issuedDateFilter(filters) }, include: { student: { select: { admissionNumber: true, firstName: true, lastName: true } } }, orderBy: { issuedAt: 'desc' } });
    return { headers: ['invoice_id', 'admission_number', 'student_name', 'session_id', 'term_id', 'class_id', 'total', 'amount_paid', 'balance', 'status', 'issued_at'], rows: records.map((row) => ({ invoice_id: row.id, admission_number: row.student.admissionNumber, student_name: `${row.student.firstName} ${row.student.lastName}`, session_id: row.sessionId, term_id: row.termId, class_id: row.classId, total: row.total, amount_paid: row.amountPaid, balance: row.balance, status: row.status, issued_at: row.issuedAt?.toISOString() ?? null })) };
  }

  private async paymentsReport(tenantId: string, filters: ReportFiltersDto): Promise<CsvReport> {
    const records = await this.prisma.payment.findMany({ where: { tenantId, status: 'completed', ...this.paidDateFilter(filters), ...(filters.sessionId || filters.termId || filters.classId || filters.branchId ? { invoice: { ...(filters.sessionId ? { sessionId: filters.sessionId } : {}), ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.branchId ? { schoolClass: { branchId: filters.branchId } } : {}) } } : {}) }, include: { student: { select: { admissionNumber: true, firstName: true, lastName: true } }, invoice: { select: { sessionId: true, termId: true, classId: true } } }, orderBy: { paidAt: 'desc' } });
    return { headers: ['receipt_number', 'admission_number', 'student_name', 'invoice_session_id', 'invoice_term_id', 'invoice_class_id', 'method', 'amount', 'applied_amount', 'credit_amount', 'paid_at'], rows: records.map((row) => ({ receipt_number: row.receiptNumber, admission_number: row.student.admissionNumber, student_name: `${row.student.firstName} ${row.student.lastName}`, invoice_session_id: row.invoice?.sessionId ?? null, invoice_term_id: row.invoice?.termId ?? null, invoice_class_id: row.invoice?.classId ?? null, method: row.method, amount: row.amount, applied_amount: row.appliedAmount, credit_amount: row.creditAmount, paid_at: row.paidAt.toISOString() })) };
  }

  private async performanceReport(tenantId: string, filters: ReportFiltersDto): Promise<CsvReport> {
    const records = await this.prisma.studentTermResult.findMany({ where: { tenantId, resultSheet: { status: 'published', ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.branchId ? { schoolClass: { branchId: filters.branchId } } : {}), ...(filters.sessionId ? { term: { academicSessionId: filters.sessionId } } : {}) } }, include: { student: { select: { admissionNumber: true, firstName: true, lastName: true } }, resultSheet: { select: { termId: true, classId: true, sectionId: true } } }, orderBy: { percentage: 'desc' } });
    return { headers: ['admission_number', 'student_name', 'term_id', 'class_id', 'section_id', 'weighted_score', 'percentage'], rows: records.map((row) => ({ admission_number: row.student.admissionNumber, student_name: `${row.student.firstName} ${row.student.lastName}`, term_id: row.resultSheet.termId, class_id: row.resultSheet.classId, section_id: row.resultSheet.sectionId, weighted_score: row.weightedScore, percentage: row.percentage })) };
  }

  private async validateFilters(tenantId: string, filters: ReportFiltersDto) {
    const [branch, session, term, schoolClass] = await Promise.all([
      filters.branchId ? this.prisma.branch.findFirst({ where: { id: filters.branchId, tenantId, deletedAt: null }, select: { id: true } }) : true,
      filters.sessionId ? this.prisma.academicSession.findFirst({ where: { id: filters.sessionId, tenantId, deletedAt: null }, select: { id: true } }) : true,
      filters.termId ? this.prisma.term.findFirst({ where: { id: filters.termId, tenantId, deletedAt: null }, select: { id: true, academicSessionId: true } }) : true,
      filters.classId ? this.prisma.schoolClass.findFirst({ where: { id: filters.classId, tenantId, deletedAt: null }, select: { id: true, branchId: true } }) : true,
    ]);
    if (!branch || !session || !term || !schoolClass) throw new NotFoundException('One or more report filters do not belong to this tenant');
    if (filters.sessionId && term !== true && term.academicSessionId !== filters.sessionId) throw new ForbiddenException('The selected term does not belong to the selected session');
    if (filters.branchId && schoolClass !== true && schoolClass.branchId && schoolClass.branchId !== filters.branchId) throw new ForbiddenException('The selected class does not belong to the selected branch');
  }

  private async assertFinancialPermission(tenantId: string, userId: string, type: ReportType) {
    if (!['outstanding_fees', 'payments'].includes(type)) return;
    if (!(await this.authorization.hasPermission(userId, tenantId, PermissionKeys.FINANCE_MANAGE))) throw new ForbiddenException('Financial reports require finance.manage permission');
  }

  private cleanFilters(dto: ReportFiltersDto): ReportFiltersDto { const { branchId, sessionId, termId, classId, startDate, endDate } = dto; return { ...(branchId ? { branchId } : {}), ...(sessionId ? { sessionId } : {}), ...(termId ? { termId } : {}), ...(classId ? { classId } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }; }
  private createdDateFilter(filters: ReportFiltersDto) { return this.range('createdAt', filters, false); }
  private attendanceDateFilter(filters: ReportFiltersDto) { return this.range('attendanceDate', filters, false); }
  private issuedDateFilter(filters: ReportFiltersDto) { return this.range('issuedAt', filters, true); }
  private paidDateFilter(filters: ReportFiltersDto) { return this.range('paidAt', filters, true); }
  private range(field: string, filters: ReportFiltersDto, endOfDay: boolean) { if (!filters.startDate && !filters.endDate) return {}; return { [field]: { ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}), ...(filters.endDate ? { lte: new Date(`${filters.endDate}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`) } : {}) } }; }
  private toCsv(report: CsvReport) { const value = (item: string | number | null | undefined) => `"${String(item ?? '').replace(/"/g, '""')}"`; return [report.headers.join(','), ...report.rows.map((row) => report.headers.map((header) => value(row[header])).join(','))].join('\n'); }
  private filename(type: ReportType) { return `${type}-${new Date().toISOString().slice(0, 10)}.csv`; }
  private storageRoot() { return resolve(process.env.REPORT_EXPORT_STORAGE_DIR || join(process.cwd(), 'storage', 'report-exports')); }
  private pathFor(key: string) { const root = this.storageRoot(); const path = resolve(root, key); if (!path.startsWith(root)) throw new ForbiddenException('Invalid export storage key'); return path; }
  private async store(key: string, csv: string) { const path = this.pathFor(key); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, csv, { mode: 0o600 }); }
}

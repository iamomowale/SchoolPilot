import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { ApproveFeeAdjustmentDto, CreateFeeAdjustmentDto, CreateFeeCategoryDto, CreateFeeStructureDto, FinanceReportQueryDto, GenerateInvoiceDto, RecordPaymentDto, ReversePaymentDto } from './dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly authorization: AuthorizationService) {}

  listCategories(tenantId: string) { return this.prisma.feeCategory.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } }); }
  createCategory(tenantId: string, userId: string, dto: CreateFeeCategoryDto) { return this.prisma.feeCategory.create({ data: { tenantId, ...dto } }).then(async (category) => { await this.audit.log({ tenantId, userId, action: 'create', entityType: 'fee-category', entityId: category.id, details: `Created ${category.code}` }); return category; }); }
  async createStructure(tenantId: string, userId: string, dto: CreateFeeStructureDto) {
    const [session, term, schoolClass, category] = await Promise.all([this.prisma.academicSession.findFirst({ where: { id: dto.sessionId, tenantId, deletedAt: null } }), this.prisma.term.findFirst({ where: { id: dto.termId, tenantId, academicSessionId: dto.sessionId, deletedAt: null } }), this.prisma.schoolClass.findFirst({ where: { id: dto.classId, tenantId, deletedAt: null } }), this.prisma.feeCategory.findFirst({ where: { id: dto.categoryId, tenantId, deletedAt: null, isActive: true } })]);
    if (!session || !term || !schoolClass || !category) throw new NotFoundException('Fee structure references a record outside this tenant or an invalid session, term, class, or category');
    const structure = await this.prisma.feeStructure.create({ data: { tenantId, ...dto } }); await this.audit.log({ tenantId, userId, action: 'create', entityType: 'fee-structure', entityId: structure.id, details: `Configured fee amount ${structure.amount}` }); return structure;
  }

  async requestAdjustment(tenantId: string, userId: string, dto: CreateFeeAdjustmentDto) {
    const structure = await this.prisma.feeStructure.findFirst({ where: { id: dto.feeStructureId, tenantId, deletedAt: null, isActive: true } });
    if (!structure) throw new NotFoundException('Fee structure not found');
    if (dto.amount > structure.amount) throw new ConflictException('An adjustment cannot exceed the configured fee amount');
    const adjustment = await this.prisma.studentFeeAdjustment.create({ data: { tenantId, ...dto, createdById: userId } });
    await this.audit.log({ tenantId, userId, action: 'request', entityType: 'fee-adjustment', entityId: adjustment.id, details: `${dto.type} requested: ${dto.reason}` });
    return adjustment;
  }

  async approveAdjustment(tenantId: string, userId: string, id: string, dto: ApproveFeeAdjustmentDto) {
    await this.assertAdmin(tenantId, userId);
    const adjustment = await this.prisma.studentFeeAdjustment.findFirst({ where: { id, tenantId }, include: { feeStructure: true } });
    if (!adjustment) throw new NotFoundException('Fee adjustment not found');
    if (adjustment.status !== 'pending') throw new ConflictException('Only pending adjustments can be approved or rejected');
    if (dto.status === 'approved') { const approved = await this.prisma.studentFeeAdjustment.findMany({ where: { tenantId, feeStructureId: adjustment.feeStructureId, studentId: adjustment.studentId, status: 'approved' }, select: { amount: true } }); if (approved.reduce((sum, item) => sum + item.amount, adjustment.amount) > adjustment.feeStructure.amount) throw new ConflictException('Approved adjustments cannot exceed the fee amount'); }
    const updated = await this.prisma.studentFeeAdjustment.update({ where: { id }, data: { status: dto.status, approvedById: userId, approvedAt: new Date() } });
    await this.audit.log({ tenantId, userId, action: dto.status, entityType: 'fee-adjustment', entityId: id, details: `${dto.status} ${adjustment.type} adjustment` });
    return updated;
  }

  async generateInvoice(tenantId: string, userId: string, dto: GenerateInvoiceDto) {
    const existing = await this.prisma.invoice.findFirst({ where: { tenantId, studentId: dto.studentId, sessionId: dto.sessionId, termId: dto.termId, classId: dto.classId } });
    if (existing) throw new ConflictException('An invoice already exists for this student, session, term, and class');
    const [student, enrollment, structures] = await Promise.all([this.prisma.studentProfile.findFirst({ where: { id: dto.studentId, tenantId, deletedAt: null } }), this.prisma.studentEnrollment.findFirst({ where: { tenantId, studentId: dto.studentId, sessionId: dto.sessionId, classId: dto.classId, deletedAt: null } }), this.prisma.feeStructure.findMany({ where: { tenantId, sessionId: dto.sessionId, termId: dto.termId, classId: dto.classId, deletedAt: null, isActive: true }, include: { category: true, adjustments: { where: { studentId: dto.studentId, status: 'approved' } } } })]);
    if (!student || !enrollment) throw new NotFoundException('Student is not enrolled in the selected session and class'); if (!structures.length) throw new NotFoundException('No active fee structures found for the selected session, term, and class');
    const lines = structures.map((structure) => { const discountAmount = structure.adjustments.filter((item) => item.type === 'discount').reduce((sum, item) => sum + item.amount, 0); const waiverAmount = structure.adjustments.filter((item) => item.type === 'waiver').reduce((sum, item) => sum + item.amount, 0); const netAmount = Math.max(0, structure.amount - discountAmount - waiverAmount); return { tenantId, feeStructureId: structure.id, categoryId: structure.categoryId, description: structure.category.name, amount: structure.amount, discountAmount, waiverAmount, netAmount }; });
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0); const discounts = lines.reduce((sum, line) => sum + line.discountAmount, 0); const waivers = lines.reduce((sum, line) => sum + line.waiverAmount, 0); const total = lines.reduce((sum, line) => sum + line.netAmount, 0); const status = total === 0 ? 'paid' : 'issued';
    const invoice = await this.prisma.invoice.create({ data: { tenantId, ...dto, status, subtotal, discounts, waivers, total, amountPaid: 0, balance: total, generatedById: userId, issuedAt: new Date(), lineItems: { create: lines } }, include: { lineItems: true } });
    await this.audit.log({ tenantId, userId, action: 'generate', entityType: 'invoice', entityId: invoice.id, details: `Generated invoice with balance ${invoice.balance}` });
    return invoice;
  }

  async getInvoice(tenantId: string, id: string) { const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId }, include: { lineItems: { include: { category: true } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } } }); if (!invoice) throw new NotFoundException('Invoice not found'); return invoice; }

  async recordPayment(tenantId: string, userId: string, dto: RecordPaymentDto) {
    return this.prisma.$transaction((tx) => this.recordPaymentInTransaction(tx, tenantId, userId, dto));
  }

  async recordPaymentInTransaction(tx: Prisma.TransactionClient, tenantId: string, userId: string, dto: RecordPaymentDto) {
      const student = await tx.studentProfile.findFirst({ where: { id: dto.studentId, tenantId, deletedAt: null }, select: { id: true } });
      if (!student) throw new NotFoundException('Student not found');
      const invoice = dto.invoiceId ? await tx.invoice.findFirst({ where: { id: dto.invoiceId, tenantId, studentId: dto.studentId } }) : null;
      if (dto.invoiceId && !invoice) throw new NotFoundException('Invoice not found for this student');
      if (invoice?.status === 'void') throw new ConflictException('Payments cannot be recorded against a void invoice');
      const now = new Date(); const start = new Date(now); start.setUTCHours(0, 0, 0, 0); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
      const dailyCount = await tx.payment.count({ where: { tenantId, paidAt: { gte: start, lt: end } } });
      const receiptNumber = `RCP-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(dailyCount + 1).padStart(6, '0')}`;
      const appliedAmount = invoice ? Math.min(dto.amount, invoice.balance) : 0; const creditAmount = dto.amount - appliedAmount;
      const payment = await tx.payment.create({ data: { tenantId, studentId: dto.studentId, invoiceId: invoice?.id, receiptNumber, method: dto.method, reference: dto.reference, amount: dto.amount, appliedAmount, creditAmount, recordedById: userId } });
      if (creditAmount > 0) await tx.studentAccountCredit.create({ data: { tenantId, studentId: dto.studentId, paymentId: payment.id, originalAmount: creditAmount, balance: creditAmount } });
      let updatedInvoice = null;
      if (invoice) updatedInvoice = await this.recalculateInvoiceInTransaction(tx, tenantId, invoice.id);
      await tx.auditLog.create({ data: { tenantId, userId, action: 'record', entityType: 'payment', entityId: payment.id, details: `Recorded ${dto.amount} via ${dto.method}; receipt ${receiptNumber}` } });
      return { payment, invoice: updatedInvoice, receipt: { number: receiptNumber, amount: dto.amount, appliedAmount, creditAmount } };
  }

  async reversePayment(tenantId: string, userId: string, id: string, dto: ReversePaymentDto) {
    await this.assertAdmin(tenantId, userId);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id, tenantId } });
      if (!payment) throw new NotFoundException('Payment not found'); if (payment.status === 'reversed') throw new ConflictException('Payment has already been reversed');
      const reversed = await tx.payment.update({ where: { id }, data: { status: 'reversed', reversedById: userId, reversalReason: dto.reason, reversedAt: new Date() } });
      if (payment.creditAmount > 0) await tx.studentAccountCredit.updateMany({ where: { tenantId, paymentId: payment.id, reversedAt: null }, data: { balance: 0, reversedById: userId, reversedAt: new Date() } });
      const invoice = payment.invoiceId ? await this.recalculateInvoiceInTransaction(tx, tenantId, payment.invoiceId) : null;
      await tx.auditLog.create({ data: { tenantId, userId, action: 'reverse', entityType: 'payment', entityId: id, details: `Reversed receipt ${payment.receiptNumber}: ${dto.reason}` } });
      return { payment: reversed, invoice };
    });
  }

  async studentStatement(tenantId: string, studentId: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { id: studentId, tenantId, deletedAt: null }, select: { firstName: true, lastName: true, admissionNumber: true } }); if (!student) throw new NotFoundException('Student not found');
    const [invoices, payments, credits] = await Promise.all([this.prisma.invoice.findMany({ where: { tenantId, studentId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, total: true, amountPaid: true, balance: true, createdAt: true } }), this.prisma.payment.findMany({ where: { tenantId, studentId }, orderBy: { paidAt: 'desc' }, select: { id: true, receiptNumber: true, method: true, amount: true, appliedAmount: true, creditAmount: true, status: true, paidAt: true, invoiceId: true } }), this.prisma.studentAccountCredit.findMany({ where: { tenantId, studentId, reversedAt: null }, select: { id: true, originalAmount: true, balance: true, createdAt: true } })]);
    return { student, invoices, payments, credits, outstandingBalance: invoices.filter((invoice) => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.balance, 0), availableCredit: credits.reduce((sum, credit) => sum + credit.balance, 0) };
  }

  async reports(tenantId: string, query: FinanceReportQueryDto) {
    const dateFilter = query.startDate || query.endDate ? { paidAt: { ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}), ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}) } } : {};
    const payments = await this.prisma.payment.findMany({ where: { tenantId, status: 'completed', ...(query.method ? { method: query.method as never } : {}), ...dateFilter, ...(query.classId || query.feeCategoryId ? { invoice: { ...(query.classId ? { classId: query.classId } : {}), ...(query.feeCategoryId ? { lineItems: { some: { categoryId: query.feeCategoryId } } } : {}) } } : {}) }, include: { invoice: { include: { lineItems: { include: { category: true } } } } } });
    const byMethod = payments.reduce<Record<string, number>>((result, payment) => ({ ...result, [payment.method]: (result[payment.method] || 0) + payment.amount }), {});
    const byClass = payments.reduce<Record<string, number>>((result, payment) => ({ ...result, [payment.invoice?.classId || 'unallocated']: (result[payment.invoice?.classId || 'unallocated'] || 0) + payment.appliedAmount }), {});
    const byFeeCategory: Record<string, number> = {};
    for (const payment of payments) for (const line of payment.invoice?.lineItems || []) { const allocated = payment.invoice?.total ? payment.appliedAmount * (line.netAmount / payment.invoice.total) : 0; byFeeCategory[line.category.name] = (byFeeCategory[line.category.name] || 0) + allocated; }
    return { totalReceived: payments.reduce((sum, payment) => sum + payment.amount, 0), totalApplied: payments.reduce((sum, payment) => sum + payment.appliedAmount, 0), totalCredits: payments.reduce((sum, payment) => sum + payment.creditAmount, 0), paymentCount: payments.length, byMethod, byClass, byFeeCategory };
  }

  private async recalculateInvoiceInTransaction(tx: Prisma.TransactionClient, tenantId: string, invoiceId: string) {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } }); if (!invoice) throw new NotFoundException('Invoice not found');
    const totals = await tx.payment.aggregate({ where: { tenantId, invoiceId, status: 'completed' }, _sum: { appliedAmount: true } }); const amountPaid = totals._sum.appliedAmount || 0; const balance = Math.max(0, invoice.total - amountPaid); const status = balance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'issued';
    return tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, balance, status } });
  }
  private async assertAdmin(tenantId: string, userId: string) { if (!(await this.authorization.isSchoolAdmin(userId, tenantId))) throw new ForbiddenException('Only school administrators can approve adjustments or reverse payments'); }
}

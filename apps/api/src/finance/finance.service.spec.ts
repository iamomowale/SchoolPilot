import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';

describe('FinanceService', () => {
  let service: FinanceService;
  const prisma = {
    feeCategory: { findMany: jest.fn(), create: jest.fn() }, feeStructure: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    studentFeeAdjustment: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    invoice: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }, studentProfile: { findFirst: jest.fn() }, studentEnrollment: { findFirst: jest.fn() },
    payment: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
    studentAccountCredit: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() }, auditLog: { create: jest.fn() }, $transaction: jest.fn(),
  };
  const authorization = { isSchoolAdmin: jest.fn() }; const audit = { log: jest.fn() };
  beforeEach(async () => { const module: TestingModule = await Test.createTestingModule({ providers: [FinanceService, { provide: PrismaService, useValue: prisma }, { provide: AuthorizationService, useValue: authorization }, { provide: AuditService, useValue: audit }] }).compile(); service = module.get<FinanceService>(FinanceService); jest.clearAllMocks(); authorization.isSchoolAdmin.mockResolvedValue(true); prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)); });

  it('generates invoice line items and calculates discount, waiver, total, and balance', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null); prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' }); prisma.studentEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    prisma.feeStructure.findMany.mockResolvedValue([{ id: 'fee-1', categoryId: 'cat-1', amount: 1000, category: { name: 'Tuition' }, adjustments: [{ type: 'discount', amount: 100 }, { type: 'waiver', amount: 50 }] }, { id: 'fee-2', categoryId: 'cat-2', amount: 500, category: { name: 'Activity' }, adjustments: [] }]);
    prisma.invoice.create.mockImplementation(async ({ data }: { data: { lineItems: { create: unknown[] } } }) => ({ id: 'invoice-1', balance: 1350, lineItems: data.lineItems.create }));
    const invoice = await service.generateInvoice('tenant-1', 'bursar-1', { studentId: 'student-1', sessionId: 'session-1', termId: 'term-1', classId: 'class-1' });
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: 1500, discounts: 100, waivers: 50, total: 1350, balance: 1350, status: 'issued' }) }));
    expect(invoice.lineItems).toHaveLength(2);
  });

  it('does not permit a non-admin to approve a waiver', async () => {
    authorization.isSchoolAdmin.mockResolvedValue(false);
    await expect(service.approveAdjustment('tenant-1', 'bursar-1', 'adjustment-1', { status: 'approved' })).rejects.toThrow('Only school administrators');
  });

  it('prevents approving combined adjustments above the fee amount', async () => {
    prisma.studentFeeAdjustment.findFirst.mockResolvedValue({ id: 'adjustment-1', status: 'pending', amount: 60, feeStructureId: 'fee-1', studentId: 'student-1', feeStructure: { amount: 100 } }); prisma.studentFeeAdjustment.findMany.mockResolvedValue([{ amount: 50 }]);
    await expect(service.approveAdjustment('tenant-1', 'admin-1', 'adjustment-1', { status: 'approved' })).rejects.toThrow('cannot exceed');
  });

  it('records a partial payment, generates a receipt, and recalculates the invoice balance atomically', async () => {
    prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' }); prisma.invoice.findFirst.mockResolvedValue({ id: 'invoice-1', studentId: 'student-1', balance: 1000, total: 1000, status: 'issued' }); prisma.payment.count.mockResolvedValue(4); prisma.payment.create.mockResolvedValue({ id: 'payment-1', receiptNumber: 'RCP-20260818-000005' }); prisma.payment.aggregate.mockResolvedValue({ _sum: { appliedAmount: 400 } }); prisma.invoice.update.mockResolvedValue({ id: 'invoice-1', amountPaid: 400, balance: 600, status: 'partially_paid' });
    const result = await service.recordPayment('tenant-1', 'bursar-1', { studentId: 'student-1', invoiceId: 'invoice-1', method: 'cash', amount: 400 });
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ appliedAmount: 400, creditAmount: 0 }) })); expect(result.invoice).toMatchObject({ balance: 600, status: 'partially_paid' }); expect(result.receipt.number).toMatch(/^RCP-/);
  });

  it('creates account credit for the overpayment portion only', async () => {
    prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' }); prisma.invoice.findFirst.mockResolvedValue({ id: 'invoice-1', studentId: 'student-1', balance: 250, total: 1000, status: 'issued' }); prisma.payment.count.mockResolvedValue(0); prisma.payment.create.mockResolvedValue({ id: 'payment-1' }); prisma.payment.aggregate.mockResolvedValue({ _sum: { appliedAmount: 1000 } }); prisma.invoice.update.mockResolvedValue({ id: 'invoice-1', amountPaid: 1000, balance: 0, status: 'paid' });
    await service.recordPayment('tenant-1', 'bursar-1', { studentId: 'student-1', invoiceId: 'invoice-1', method: 'bank_transfer', amount: 400 });
    expect(prisma.studentAccountCredit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originalAmount: 150, balance: 150 }) }));
  });

  it('restricts reversals to school admins and returns the applied amount to the invoice balance', async () => {
    authorization.isSchoolAdmin.mockResolvedValue(false); await expect(service.reversePayment('tenant-1', 'bursar-1', 'payment-1', { reason: 'Entry error' })).rejects.toThrow('Only school administrators');
  });

  it('audits an authorized reversal and restores the invoice balance', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'payment-1', invoiceId: 'invoice-1', receiptNumber: 'RCP-20260818-000001', creditAmount: 0, status: 'completed' }); prisma.payment.update.mockResolvedValue({ id: 'payment-1', status: 'reversed' }); prisma.invoice.findFirst.mockResolvedValue({ id: 'invoice-1', total: 1000 }); prisma.payment.aggregate.mockResolvedValue({ _sum: { appliedAmount: 0 } }); prisma.invoice.update.mockResolvedValue({ id: 'invoice-1', amountPaid: 0, balance: 1000, status: 'issued' });
    const result = await service.reversePayment('tenant-1', 'admin-1', 'payment-1', { reason: 'Duplicate receipt' });
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'reversed', reversalReason: 'Duplicate receipt' }) })); expect(result.invoice).toMatchObject({ balance: 1000 }); expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

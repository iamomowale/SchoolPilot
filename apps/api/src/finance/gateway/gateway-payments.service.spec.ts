import { Test, TestingModule } from '@nestjs/testing';
import { GatewayPaymentsService } from './gateway-payments.service';
import { PrismaService } from '../../common/prisma.service';
import { FinanceService } from '../finance.service';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import { WebhookFailureAlertService } from './webhook-failure-alert.service';

describe('GatewayPaymentsService', () => {
  let service: GatewayPaymentsService;
  const prisma = {
    invoice: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    gatewayPayment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    paymentWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const finance = { recordPaymentInTransaction: jest.fn() };
  const gateway = { provider: 'mock', initiatePayment: jest.fn(), verifyWebhook: jest.fn() };
  const gateways = { get: jest.fn() };
  const alerts = { notify: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [
      GatewayPaymentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: FinanceService, useValue: finance },
      { provide: PaymentGatewayRegistry, useValue: gateways },
      { provide: WebhookFailureAlertService, useValue: alerts },
    ] }).compile();
    service = module.get<GatewayPaymentsService>(GatewayPaymentsService);
    jest.clearAllMocks();
    gateways.get.mockReturnValue(gateway);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it('initiates a provider-neutral checkout from an outstanding tenant invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'invoice-1', balance: 2500, status: 'issued' });
    gateway.initiatePayment.mockResolvedValue({ providerPaymentId: 'mock-ref-1', checkoutUrl: 'https://sandbox.example/checkout?reference=mock-ref-1' });
    prisma.gatewayPayment.create.mockResolvedValue({ id: 'gateway-payment-1' });

    await service.initiate('tenant-1', 'user-1', 'invoice-1', {});

    expect(gateway.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', invoiceId: 'invoice-1', amount: 2500 }));
    expect(prisma.gatewayPayment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', initiatedById: 'user-1', provider: 'mock' }) }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('creates exactly one payment from a verified successful webhook', async () => {
    const payload = { eventId: 'event-1', providerPaymentId: 'mock-ref-1', status: 'succeeded' as const, amount: 2500, currency: 'NGN' };
    gateway.verifyWebhook.mockResolvedValue(true);
    prisma.gatewayPayment.findFirst.mockResolvedValue({ id: 'gateway-payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-1', initiatedById: 'user-1', provider: 'mock', providerPaymentId: 'mock-ref-1', amount: 2500, currency: 'NGN' });
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ studentId: 'student-1' });
    finance.recordPaymentInTransaction.mockResolvedValue({ payment: { id: 'payment-1' }, receipt: { number: 'RCP-1' } });

    const result = await service.handleWebhook('mock', payload, 'valid-signature');

    expect(finance.recordPaymentInTransaction).toHaveBeenCalledWith(prisma, 'tenant-1', 'user-1', expect.objectContaining({ invoiceId: 'invoice-1', studentId: 'student-1', method: 'card', amount: 2500 }));
    expect(prisma.gatewayPayment.update).toHaveBeenCalledWith({ where: { id: 'gateway-payment-1' }, data: { status: 'succeeded', paymentId: 'payment-1' } });
    expect(result).toEqual({ accepted: true, duplicate: false, receiptNumber: 'RCP-1' });
  });

  it('does not create another payment when the provider retries the same webhook event', async () => {
    const payload = { eventId: 'event-1', providerPaymentId: 'mock-ref-1', status: 'succeeded' as const, amount: 2500, currency: 'NGN' };
    gateway.verifyWebhook.mockResolvedValue(true);
    prisma.gatewayPayment.findFirst.mockResolvedValue({ id: 'gateway-payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-1', initiatedById: 'user-1', provider: 'mock', amount: 2500, currency: 'NGN' });
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue({ id: 'webhook-1' });

    await expect(service.handleWebhook('mock', payload, 'valid-signature')).resolves.toEqual({ accepted: true, duplicate: true });
    expect(finance.recordPaymentInTransaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before any payment is recorded and alerts operations', async () => {
    const payload = { eventId: 'event-invalid', providerPaymentId: 'mock-ref-1', status: 'succeeded' as const, amount: 2500, currency: 'NGN' };
    gateway.verifyWebhook.mockResolvedValue(false);

    await expect(service.handleWebhook('mock', payload, 'invalid-signature')).rejects.toThrow('Invalid payment webhook signature');
    expect(finance.recordPaymentInTransaction).not.toHaveBeenCalled();
    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-invalid' }));
  });
});

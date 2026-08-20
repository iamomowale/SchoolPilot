import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { FinanceService } from '../finance.service';
import { GatewayWebhookDto, InitiateGatewayPaymentDto } from '../dto';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import { WebhookFailureAlertService } from './webhook-failure-alert.service';

@Injectable()
export class GatewayPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly gateways: PaymentGatewayRegistry,
    private readonly alerts: WebhookFailureAlertService,
  ) {}

  async initiate(tenantId: string, userId: string, invoiceId: string, dto: InitiateGatewayPaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'void' || invoice.balance <= 0) throw new ConflictException('Payment can only be initiated for an outstanding invoice');

    const gateway = this.gateways.get(dto.provider);
    const currency = process.env.PAYMENT_GATEWAY_CURRENCY || 'NGN';
    const initiation = await gateway.initiatePayment({ tenantId, invoiceId: invoice.id, amount: invoice.balance, currency });
    const payment = await this.prisma.gatewayPayment.create({
      data: { tenantId, invoiceId: invoice.id, initiatedById: userId, provider: gateway.provider, providerPaymentId: initiation.providerPaymentId, checkoutUrl: initiation.checkoutUrl, amount: invoice.balance, currency },
    });
    await this.prisma.auditLog.create({ data: { tenantId, userId, action: 'initiate', entityType: 'gateway-payment', entityId: payment.id, details: `Initiated ${gateway.provider} payment for invoice ${invoice.id}` } });
    return payment;
  }

  async handleWebhook(provider: string, payload: GatewayWebhookDto, signature: string | undefined, rawBody?: Buffer) {
    const gateway = this.gateways.get(provider);
    const verified = await gateway.verifyWebhook(payload, signature, rawBody);
    if (!verified) {
      await this.alerts.notify({ provider, eventId: payload.eventId, reason: 'Webhook signature verification failed' });
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    const gatewayPayment = await this.prisma.gatewayPayment.findFirst({ where: { provider, providerPaymentId: payload.providerPaymentId } });
    if (!gatewayPayment) {
      await this.alerts.notify({ provider, eventId: payload.eventId, reason: 'Gateway payment reference was not found' });
      throw new NotFoundException('Gateway payment reference not found');
    }

    if (payload.amount !== gatewayPayment.amount || payload.currency !== gatewayPayment.currency) {
      await this.recordFailure(gatewayPayment.tenantId, provider, payload.eventId, payload, 'Webhook amount or currency does not match the initiated payment');
      throw new ConflictException('Webhook amount or currency does not match the initiated payment');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.paymentWebhookEvent.findUnique({ where: { provider_providerEventId: { provider, providerEventId: payload.eventId } } });
        if (duplicate) return { accepted: true, duplicate: true };

        if (payload.status === 'failed') {
          await tx.gatewayPayment.update({ where: { id: gatewayPayment.id }, data: { status: 'failed' } });
          await tx.paymentWebhookEvent.create({ data: { tenantId: gatewayPayment.tenantId, provider, providerEventId: payload.eventId, status: 'processed', payload: JSON.stringify(payload) } });
          await tx.auditLog.create({ data: { tenantId: gatewayPayment.tenantId, userId: gatewayPayment.initiatedById, action: 'failed', entityType: 'gateway-payment', entityId: gatewayPayment.id, details: `Provider ${provider} reported a failed payment` } });
          return { accepted: true, duplicate: false };
        }

        const paymentResult = await this.finance.recordPaymentInTransaction(tx, gatewayPayment.tenantId, gatewayPayment.initiatedById, {
          studentId: (await tx.invoice.findUniqueOrThrow({ where: { id: gatewayPayment.invoiceId }, select: { studentId: true } })).studentId,
          invoiceId: gatewayPayment.invoiceId,
          method: 'card',
          amount: gatewayPayment.amount,
          reference: gatewayPayment.providerPaymentId,
        });
        await tx.gatewayPayment.update({ where: { id: gatewayPayment.id }, data: { status: 'succeeded', paymentId: paymentResult.payment.id } });
        await tx.paymentWebhookEvent.create({ data: { tenantId: gatewayPayment.tenantId, provider, providerEventId: payload.eventId, status: 'processed', payload: JSON.stringify(payload) } });
        await tx.auditLog.create({ data: { tenantId: gatewayPayment.tenantId, userId: gatewayPayment.initiatedById, action: 'succeed', entityType: 'gateway-payment', entityId: gatewayPayment.id, details: `Processed verified ${provider} webhook` } });
        return { accepted: true, duplicate: false, receiptNumber: paymentResult.receipt.number };
      });
    } catch (error) {
      if (this.isUniqueEventError(error)) return { accepted: true, duplicate: true };
      await this.recordFailure(gatewayPayment.tenantId, provider, payload.eventId, payload, error instanceof Error ? error.message : 'Unknown webhook processing error');
      throw error;
    }
  }

  private async recordFailure(tenantId: string, provider: string, eventId: string, payload: GatewayWebhookDto, reason: string): Promise<void> {
    try {
      await this.prisma.paymentWebhookEvent.upsert({
        where: { provider_providerEventId: { provider, providerEventId: eventId } },
        update: { status: 'failed', failureReason: reason },
        create: { tenantId, provider, providerEventId: eventId, status: 'failed', payload: JSON.stringify(payload), failureReason: reason },
      });
      await this.prisma.auditLog.create({ data: { tenantId, action: 'webhook-failed', entityType: 'payment-webhook', entityId: eventId, details: `${provider}: ${reason}` } });
    } finally {
      await this.alerts.notify({ provider, eventId, reason });
    }
  }

  private isUniqueEventError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

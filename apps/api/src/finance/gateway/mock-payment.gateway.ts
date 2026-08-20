import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'crypto';
import { GatewayInitiation, GatewayPaymentRequest, GatewayWebhookPayload, PaymentGateway } from './payment-gateway.types';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly provider = 'mock';

  async initiatePayment(request: GatewayPaymentRequest): Promise<GatewayInitiation> {
    const baseUrl = process.env.PAYMENT_GATEWAY_SANDBOX_BASE_URL;
    if (!baseUrl) throw new ServiceUnavailableException('PAYMENT_GATEWAY_SANDBOX_BASE_URL must be configured for the mock gateway');
    const providerPaymentId = `mock_${crypto.randomUUID()}`;
    const query = new URLSearchParams({ reference: providerPaymentId, invoiceId: request.invoiceId, amount: String(request.amount), currency: request.currency });
    return { providerPaymentId, checkoutUrl: `${baseUrl.replace(/\/$/, '')}/checkout?${query.toString()}` };
  }

  async verifyWebhook(payload: GatewayWebhookPayload, signature: string | undefined, rawBody?: Buffer): Promise<boolean> {
    const secret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const source = rawBody ?? Buffer.from(JSON.stringify(payload));
    const expected = crypto.createHmac('sha256', secret).update(source).digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

import crypto from 'crypto';
import { MockPaymentGateway } from './mock-payment.gateway';

describe('MockPaymentGateway', () => {
  const gateway = new MockPaymentGateway();
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('returns a sandbox checkout URL and verifies an HMAC webhook signature', async () => {
    process.env.PAYMENT_GATEWAY_SANDBOX_BASE_URL = 'https://sandbox.example';
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = 'test-webhook-secret';
    const initiated = await gateway.initiatePayment({ tenantId: 'tenant-1', invoiceId: 'invoice-1', amount: 100, currency: 'NGN' });
    const payload = { eventId: 'event-1', providerPaymentId: initiated.providerPaymentId, status: 'succeeded' as const, amount: 100, currency: 'NGN' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

    await expect(gateway.verifyWebhook(payload, signature, rawBody)).resolves.toBe(true);
    await expect(gateway.verifyWebhook(payload, 'incorrect', rawBody)).resolves.toBe(false);
  });
});

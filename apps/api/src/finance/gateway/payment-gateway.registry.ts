import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentGateway } from './payment-gateway.types';

@Injectable()
export class PaymentGatewayRegistry {
  constructor(private readonly mockGateway: MockPaymentGateway) {}

  get(provider = process.env.PAYMENT_GATEWAY_PROVIDER || 'mock'): PaymentGateway {
    if (provider === this.mockGateway.provider) return this.mockGateway;
    throw new ServiceUnavailableException(`Payment provider "${provider}" is not configured`);
  }
}

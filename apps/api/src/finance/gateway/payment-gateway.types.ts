export type GatewayInitiation = {
  providerPaymentId: string;
  checkoutUrl: string;
};

export type GatewayPaymentRequest = {
  amount: number;
  currency: string;
  invoiceId: string;
  tenantId: string;
};

export type GatewayWebhookPayload = {
  eventId: string;
  providerPaymentId: string;
  status: 'succeeded' | 'failed';
  amount: number;
  currency: string;
};

export interface PaymentGateway {
  readonly provider: string;
  initiatePayment(request: GatewayPaymentRequest): Promise<GatewayInitiation>;
  verifyWebhook(payload: GatewayWebhookPayload, signature: string | undefined, rawBody?: Buffer): Promise<boolean>;
}

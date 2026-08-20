CREATE TYPE "GatewayPaymentStatus" AS ENUM ('initiated', 'succeeded', 'failed');
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('processed', 'failed');

CREATE TABLE "GatewayPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "checkoutUrl" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "GatewayPaymentStatus" NOT NULL DEFAULT 'initiated',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GatewayPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "status" "PaymentWebhookStatus" NOT NULL,
    "payload" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewayPayment_tenantId_provider_providerPaymentId_key" ON "GatewayPayment"("tenantId", "provider", "providerPaymentId");
CREATE UNIQUE INDEX "GatewayPayment_paymentId_key" ON "GatewayPayment"("paymentId");
CREATE INDEX "GatewayPayment_tenantId_invoiceId_status_idx" ON "GatewayPayment"("tenantId", "invoiceId", "status");
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_tenantId_provider_createdAt_idx" ON "PaymentWebhookEvent"("tenantId", "provider", "createdAt");

ALTER TABLE "GatewayPayment" ADD CONSTRAINT "GatewayPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatewayPayment" ADD CONSTRAINT "GatewayPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatewayPayment" ADD CONSTRAINT "GatewayPayment_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatewayPayment" ADD CONSTRAINT "GatewayPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

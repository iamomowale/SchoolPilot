CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank_transfer', 'card', 'cheque', 'other');
CREATE TYPE "PaymentStatus" AS ENUM ('completed', 'reversed');
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "invoiceId" TEXT,
  "receiptNumber" TEXT NOT NULL, "method" "PaymentMethod" NOT NULL, "reference" TEXT,
  "amount" DOUBLE PRECISION NOT NULL, "appliedAmount" DOUBLE PRECISION NOT NULL, "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "PaymentStatus" NOT NULL DEFAULT 'completed', "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL, "reversedById" TEXT, "reversalReason" TEXT, "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StudentAccountCredit" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
  "originalAmount" DOUBLE PRECISION NOT NULL, "balance" DOUBLE PRECISION NOT NULL, "reversedById" TEXT, "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAccountCredit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_tenantId_receiptNumber_key" ON "Payment"("tenantId", "receiptNumber");
CREATE INDEX "Payment_tenantId_studentId_paidAt_idx" ON "Payment"("tenantId", "studentId", "paidAt");
CREATE INDEX "Payment_tenantId_method_paidAt_idx" ON "Payment"("tenantId", "method", "paidAt");
CREATE UNIQUE INDEX "StudentAccountCredit_paymentId_key" ON "StudentAccountCredit"("paymentId");
CREATE INDEX "StudentAccountCredit_tenantId_studentId_idx" ON "StudentAccountCredit"("tenantId", "studentId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentAccountCredit" ADD CONSTRAINT "StudentAccountCredit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAccountCredit" ADD CONSTRAINT "StudentAccountCredit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAccountCredit" ADD CONSTRAINT "StudentAccountCredit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAccountCredit" ADD CONSTRAINT "StudentAccountCredit_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

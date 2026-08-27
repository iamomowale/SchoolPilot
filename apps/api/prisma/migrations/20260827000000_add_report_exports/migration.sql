-- Persist asynchronous tenant-scoped CSV export requests and their outcomes.
CREATE TYPE "ReportExportType" AS ENUM ('enrollment', 'attendance', 'outstanding_fees', 'payments', 'student_performance');
CREATE TYPE "ReportExportStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "type" "ReportExportType" NOT NULL,
    "filters" JSONB NOT NULL,
    "status" "ReportExportStatus" NOT NULL DEFAULT 'queued',
    "rowCount" INTEGER,
    "storageKey" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportExport_tenantId_requestedById_createdAt_idx" ON "ReportExport"("tenantId", "requestedById", "createdAt");
CREATE INDEX "ReportExport_tenantId_status_idx" ON "ReportExport"("tenantId", "status");
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

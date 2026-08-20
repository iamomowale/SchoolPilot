CREATE TABLE "ReportCard" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "resultSheetId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "teacherComment" TEXT, "storageKey" TEXT NOT NULL, "generatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportCard_resultSheetId_studentId_key" ON "ReportCard"("resultSheetId", "studentId");
CREATE INDEX "ReportCard_tenantId_studentId_idx" ON "ReportCard"("tenantId", "studentId");
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_resultSheetId_fkey" FOREIGN KEY ("resultSheetId") REFERENCES "ResultSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

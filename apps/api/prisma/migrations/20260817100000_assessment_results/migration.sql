CREATE TYPE "ResultStatus" AS ENUM ('draft', 'submitted', 'approved', 'published');

CREATE TABLE "AssessmentType" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL,
  "defaultWeight" DOUBLE PRECISION NOT NULL DEFAULT 0, "defaultMaxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "AssessmentType_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssessmentConfiguration" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "termId" TEXT NOT NULL, "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "assessmentTypeId" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL, "maxScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3), CONSTRAINT "AssessmentConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssessmentScore" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "configurationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL, "enteredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentScore_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResultSheet" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "termId" TEXT NOT NULL, "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL, "status" "ResultStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResultSheet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StudentTermResult" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "resultSheetId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "weightedScore" DOUBLE PRECISION NOT NULL, "percentage" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentTermResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentType_tenantId_code_key" ON "AssessmentType"("tenantId", "code");
CREATE INDEX "AssessmentType_tenantId_idx" ON "AssessmentType"("tenantId");
CREATE UNIQUE INDEX "AssessmentConfiguration_tenantId_termId_classId_sectionId_subjectId_assessmentTypeId_key" ON "AssessmentConfiguration"("tenantId", "termId", "classId", "sectionId", "subjectId", "assessmentTypeId");
CREATE INDEX "AssessmentConfiguration_tenantId_termId_classId_sectionId_idx" ON "AssessmentConfiguration"("tenantId", "termId", "classId", "sectionId");
CREATE UNIQUE INDEX "AssessmentScore_configurationId_studentId_key" ON "AssessmentScore"("configurationId", "studentId");
CREATE INDEX "AssessmentScore_tenantId_studentId_idx" ON "AssessmentScore"("tenantId", "studentId");
CREATE UNIQUE INDEX "ResultSheet_tenantId_termId_classId_sectionId_key" ON "ResultSheet"("tenantId", "termId", "classId", "sectionId");
CREATE INDEX "ResultSheet_tenantId_status_idx" ON "ResultSheet"("tenantId", "status");
CREATE UNIQUE INDEX "StudentTermResult_resultSheetId_studentId_key" ON "StudentTermResult"("resultSheetId", "studentId");
CREATE INDEX "StudentTermResult_tenantId_studentId_idx" ON "StudentTermResult"("tenantId", "studentId");

ALTER TABLE "AssessmentType" ADD CONSTRAINT "AssessmentType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfiguration" ADD CONSTRAINT "AssessmentConfiguration_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "AssessmentConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTermResult" ADD CONSTRAINT "StudentTermResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTermResult" ADD CONSTRAINT "StudentTermResult_resultSheetId_fkey" FOREIGN KEY ("resultSheetId") REFERENCES "ResultSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTermResult" ADD CONSTRAINT "StudentTermResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

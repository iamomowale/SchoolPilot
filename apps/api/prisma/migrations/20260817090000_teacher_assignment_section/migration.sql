-- Add an optional section to teacher assignments. Attendance recording requires
-- the teacher's assignment to match both its class and section.
ALTER TABLE "TeacherAssignment" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "TeacherAssignment_sectionId_idx" ON "TeacherAssignment"("sectionId");

ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

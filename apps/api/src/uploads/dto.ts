import { IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsIn(['student_document', 'school_document']) kind!: 'student_document' | 'school_document';
  @IsOptional() @IsString() studentId?: string;
}

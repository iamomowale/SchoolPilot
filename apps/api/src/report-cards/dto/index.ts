import { IsOptional, IsString } from 'class-validator';

export class GenerateReportCardDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() teacherComment?: string;
}

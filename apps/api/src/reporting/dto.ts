import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Min } from 'class-validator';

export const reportTypes = ['enrollment', 'attendance', 'outstanding_fees', 'payments', 'student_performance'] as const;
export type ReportType = (typeof reportTypes)[number];

export class ReportFiltersDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class ReportTypeParamsDto {
  @IsIn(reportTypes) type!: ReportType;
}

export class ExportRequestDto extends ReportFiltersDto {
  @IsOptional() @Type(() => Number) @Min(1) asyncThreshold?: number;
}

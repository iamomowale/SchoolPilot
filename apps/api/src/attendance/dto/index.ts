import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export const attendanceStatuses = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatusValue = (typeof attendanceStatuses)[number];

export class AttendanceEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsIn(attendanceStatuses)
  status!: AttendanceStatusValue;
}

export class RecordAttendanceDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  sectionId!: string;

  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}

export class CorrectAttendanceDto {
  @IsIn(attendanceStatuses)
  status!: AttendanceStatusValue;
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

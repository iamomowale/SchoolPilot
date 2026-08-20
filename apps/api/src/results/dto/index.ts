import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const resultStatuses = ['draft', 'submitted', 'approved', 'published'] as const;
export type ResultStatusValue = (typeof resultStatuses)[number];

export class CreateAssessmentTypeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() code!: string;
  @Type(() => Number) @IsNumber() @Min(0) defaultWeight!: number;
  @Type(() => Number) @IsNumber() @Min(0.01) defaultMaxScore!: number;
}

export class CreateAssessmentConfigurationDto {
  @IsString() @IsNotEmpty() termId!: string;
  @IsString() @IsNotEmpty() classId!: string;
  @IsString() @IsNotEmpty() sectionId!: string;
  @IsString() @IsNotEmpty() subjectId!: string;
  @IsString() @IsNotEmpty() assessmentTypeId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) weight!: number;
  @Type(() => Number) @IsNumber() @Min(0.01) maxScore!: number;
}

export class CreateResultSheetDto {
  @IsString() @IsNotEmpty() termId!: string;
  @IsString() @IsNotEmpty() classId!: string;
  @IsString() @IsNotEmpty() sectionId!: string;
}

export class EnterScoreDto {
  @IsString() @IsNotEmpty() configurationId!: string;
  @IsString() @IsNotEmpty() studentId!: string;
  @Type(() => Number) @IsNumber() @Min(0) score!: number;
}

export class ChangeScoreDto {
  @Type(() => Number) @IsNumber() @Min(0) score!: number;
}

export class TransitionResultSheetDto {
  @IsIn(resultStatuses) status!: ResultStatusValue;
}

export class PublishedResultsQueryDto {
  @IsOptional() @IsString() termId?: string;
}

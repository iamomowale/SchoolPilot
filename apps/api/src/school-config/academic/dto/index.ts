import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateAcademicSessionDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}

export class UpdateAcademicSessionDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

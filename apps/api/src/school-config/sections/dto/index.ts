import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() roleName?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
  @IsOptional() @IsArray() @IsIn(['in_app', 'email', 'sms'], { each: true }) channels?: Array<'in_app' | 'email' | 'sms'>;
}

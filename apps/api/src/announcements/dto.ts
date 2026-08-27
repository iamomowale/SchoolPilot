import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'School closes Friday' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'Collection is at noon.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ description: 'Target a branch within the tenant.' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Target a class within the tenant.' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Target members that hold this role name.' })
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiPropertyOptional({ description: 'Target specific users in the tenant.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Delivery channels to create in addition to the in-app notification.', enum: ['in_app', 'email', 'sms'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(['in_app', 'email', 'sms'], { each: true })
  channels?: Array<'in_app' | 'email' | 'sms'>;
}

export class CreateFeeCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateFeeStructureDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreateFeeAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  feeStructureId!: string;

  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsIn(['discount', 'waiver'])
  type!: 'discount' | 'waiver';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApproveFeeAdjustmentDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}

export class GenerateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;
}

export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other'])
  method!: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class ReversePaymentDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class FinanceReportQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  feeCategoryId?: string;

  @IsOptional()
  @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other'])
  method?: string;
}

export class InitiateGatewayPaymentDto {
  @IsOptional()
  @IsString()
  provider?: string;
}

export class GatewayWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  providerPaymentId!: string;

  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

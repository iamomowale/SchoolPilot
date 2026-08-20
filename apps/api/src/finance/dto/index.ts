import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFeeCategoryDto { @IsString() @IsNotEmpty() name!: string; @IsString() @IsNotEmpty() code!: string; @IsOptional() @IsString() description?: string; }
export class CreateFeeStructureDto { @IsString() @IsNotEmpty() sessionId!: string; @IsString() @IsNotEmpty() termId!: string; @IsString() @IsNotEmpty() classId!: string; @IsString() @IsNotEmpty() categoryId!: string; @Type(() => Number) @IsNumber() @Min(0.01) amount!: number; }
export class CreateFeeAdjustmentDto { @IsString() @IsNotEmpty() feeStructureId!: string; @IsString() @IsNotEmpty() studentId!: string; @IsIn(['discount', 'waiver']) type!: 'discount' | 'waiver'; @Type(() => Number) @IsNumber() @Min(0.01) amount!: number; @IsString() @IsNotEmpty() reason!: string; }
export class ApproveFeeAdjustmentDto { @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected'; }
export class GenerateInvoiceDto { @IsString() @IsNotEmpty() studentId!: string; @IsString() @IsNotEmpty() sessionId!: string; @IsString() @IsNotEmpty() termId!: string; @IsString() @IsNotEmpty() classId!: string; }
export class RecordPaymentDto { @IsString() @IsNotEmpty() studentId!: string; @IsOptional() @IsString() invoiceId?: string; @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other']) method!: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other'; @Type(() => Number) @IsNumber() @Min(0.01) amount!: number; @IsOptional() @IsString() reference?: string; }
export class ReversePaymentDto { @IsString() @IsNotEmpty() reason!: string; }
export class FinanceReportQueryDto { @IsOptional() @IsString() startDate?: string; @IsOptional() @IsString() endDate?: string; @IsOptional() @IsString() classId?: string; @IsOptional() @IsString() feeCategoryId?: string; @IsOptional() @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other']) method?: string; }
export class InitiateGatewayPaymentDto { @IsOptional() @IsString() provider?: string; }
export class GatewayWebhookDto {
  @IsString() @IsNotEmpty() eventId!: string;
  @IsString() @IsNotEmpty() providerPaymentId!: string;
  @IsIn(['succeeded', 'failed']) status!: 'succeeded' | 'failed';
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsNotEmpty() currency!: string;
}

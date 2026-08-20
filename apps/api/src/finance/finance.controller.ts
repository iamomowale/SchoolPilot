import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { ApproveFeeAdjustmentDto, CreateFeeAdjustmentDto, CreateFeeCategoryDto, CreateFeeStructureDto, FinanceReportQueryDto, GenerateInvoiceDto, InitiateGatewayPaymentDto, RecordPaymentDto, ReversePaymentDto } from './dto';
import { GatewayPaymentsService } from './gateway/gateway-payments.service';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller('finance')
@UseGuards(TenantGuard, PermissionGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly gatewayPayments: GatewayPaymentsService) {}
  @Get('fee-categories') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'List tenant fee categories' }) categories(@Req() req: Request) { return this.reply(this.finance.listCategories(this.tenant(req))); }
  @Post('fee-categories') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Create a fee category' }) category(@Req() req: Request, @Body() dto: CreateFeeCategoryDto) { return this.reply(this.finance.createCategory(this.tenant(req), this.user(req), dto)); }
  @Post('fee-structures') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Configure a fee by session, term, and class' }) structure(@Req() req: Request, @Body() dto: CreateFeeStructureDto) { return this.reply(this.finance.createStructure(this.tenant(req), this.user(req), dto)); }
  @Post('fee-adjustments') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Request a student discount or waiver' }) adjustment(@Req() req: Request, @Body() dto: CreateFeeAdjustmentDto) { return this.reply(this.finance.requestAdjustment(this.tenant(req), this.user(req), dto)); }
  @Patch('fee-adjustments/:id/approval') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Approve or reject a pending discount or waiver with audit logging' }) approve(@Req() req: Request, @Param('id') id: string, @Body() dto: ApproveFeeAdjustmentDto) { return this.reply(this.finance.approveAdjustment(this.tenant(req), this.user(req), id, dto)); }
  @Post('invoices/generate') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Generate an invoice and line items from configured fees and approved adjustments' }) @ApiResponse({ status: 409, description: 'Invoice already exists for the student, session, term, and class.' }) invoice(@Req() req: Request, @Body() dto: GenerateInvoiceDto) { return this.reply(this.finance.generateInvoice(this.tenant(req), this.user(req), dto)); }
  @Get('invoices/:id') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Get an invoice, line items, totals, status, and balance' }) getInvoice(@Req() req: Request, @Param('id') id: string) { return this.reply(this.finance.getInvoice(this.tenant(req), id)); }
  @Post('invoices/:id/gateway-payment') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Initiate a provider-agnostic gateway payment for an outstanding invoice' }) @ApiResponse({ status: 201, description: 'A checkout URL is returned. Payment completion is only accepted by a verified webhook.' }) initiateGatewayPayment(@Req() req: Request, @Param('id') id: string, @Body() dto: InitiateGatewayPaymentDto) { return this.reply(this.gatewayPayments.initiate(this.tenant(req), this.user(req), id, dto)); }
  @Post('payments') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Record a manual payment, receipt, invoice allocation, and any overpayment credit atomically' }) @ApiResponse({ status: 201, description: 'Payment and receipt recorded.' }) payment(@Req() req: Request, @Body() dto: RecordPaymentDto) { return this.reply(this.finance.recordPayment(this.tenant(req), this.user(req), dto)); }
  @Patch('payments/:id/reversal') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Audit and reverse a payment; only school admins can reverse' }) reversePayment(@Req() req: Request, @Param('id') id: string, @Body() dto: ReversePaymentDto) { return this.reply(this.finance.reversePayment(this.tenant(req), this.user(req), id, dto)); }
  @Get('students/:studentId/statement') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Get a student account statement with invoices, receipts, credit, and balance' }) statement(@Req() req: Request, @Param('studentId') studentId: string) { return this.reply(this.finance.studentStatement(this.tenant(req), studentId)); }
  @Get('reports/payments') @RequirePermission(PermissionKeys.FINANCE_MANAGE) @ApiOperation({ summary: 'Payment report by date range, class, fee category, and payment method' }) reports(@Req() req: Request, @Query() query: FinanceReportQueryDto) { return this.reply(this.finance.reports(this.tenant(req), query)); }
  private async reply<T>(value: Promise<T> | T) { return { success: true, data: await value }; }
  private tenant(req: Request) { const id = req.headers['x-tenant-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing tenant context'); return id; }
  private user(req: Request) { const userId = req.headers['x-user-id'] as string | undefined; if (!userId) throw new ForbiddenException('Missing user context'); return userId; }
}

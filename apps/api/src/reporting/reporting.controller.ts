import { Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { ExportRequestDto, ReportFiltersDto, ReportTypeParamsDto } from './dto';
import { ReportExportQueue } from './report-export.queue';
import { ReportingService } from './reporting.service';

@ApiTags('reporting')
@Controller('reports')
@UseGuards(TenantGuard, PermissionGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingService, private readonly exports: ReportExportQueue) {}

  @Get(':type')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiParam({ name: 'type', enum: ['enrollment', 'attendance', 'outstanding_fees', 'payments', 'student_performance'] })
  @ApiOperation({ summary: 'Run a tenant-scoped enrollment, attendance, fee, payment, or student performance report' })
  @ApiResponse({ status: 403, description: 'Financial reports also require finance.manage.' })
  async report(@Req() req: Request, @Param() params: ReportTypeParamsDto, @Query() filters: ReportFiltersDto) {
    return { success: true, data: await this.reporting.report(this.tenant(req), this.user(req), params.type, filters) };
  }

  @Post(':type/exports')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiParam({ name: 'type', enum: ['enrollment', 'attendance', 'outstanding_fees', 'payments', 'student_performance'] })
  @ApiOperation({ summary: 'Generate a CSV report immediately or queue a large tenant-scoped export through Redis' })
  @ApiResponse({ status: 201, description: 'A completed CSV payload or queued export job is returned.' })
  async createExport(@Req() req: Request, @Param() params: ReportTypeParamsDto, @Query() filters: ExportRequestDto) {
    const result = await this.reporting.requestExport(this.tenant(req), this.user(req), params.type, filters);
    if (result.status === 'queued') await this.exports.enqueue(result.id);
    return { success: true, data: result };
  }

  @Get('exports/:id')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiParam({ name: 'id', description: 'The export job identifier' })
  @ApiOperation({ summary: 'Get the status of an asynchronous CSV export requested by the current user' })
  async status(@Req() req: Request, @Param('id') id: string) { return { success: true, data: await this.reporting.exportStatus(this.tenant(req), this.user(req), id) }; }

  @Get('exports/:id/download')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiParam({ name: 'id', description: 'The completed export job identifier' })
  @ApiOperation({ summary: 'Retrieve the completed CSV content for the current user export job' })
  async download(@Req() req: Request, @Param('id') id: string) { return { success: true, data: await this.reporting.downloadExport(this.tenant(req), this.user(req), id) }; }

  private tenant(req: Request) { const id = req.headers['x-tenant-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing tenant context'); return id; }
  private user(req: Request) { const id = req.headers['x-user-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing user context'); return id; }
}

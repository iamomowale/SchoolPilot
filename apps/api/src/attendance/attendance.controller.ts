import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto, CorrectAttendanceDto, RecordAttendanceDto } from './dto';

@ApiTags('attendance')
@Controller('attendance')
@UseGuards(TenantGuard, PermissionGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('records')
  @RequirePermission(PermissionKeys.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Record attendance for an assigned class and section' })
  @ApiResponse({ status: 201, description: 'Attendance recorded. Duplicate student/date records are rejected.' })
  async record(@Req() req: Request, @Body() dto: RecordAttendanceDto) {
    return { success: true, data: await this.attendance.record(this.tenantId(req), this.userId(req), dto) };
  }

  @Patch('records/:id')
  @RequirePermission(PermissionKeys.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Correct an attendance record (school administrators only)' })
  @ApiResponse({ status: 200, description: 'Attendance corrected and audit logged.' })
  async correct(@Req() req: Request, @Param('id') id: string, @Body() dto: CorrectAttendanceDto) {
    return { success: true, data: await this.attendance.correct(this.tenantId(req), this.userId(req), id, dto.status) };
  }

  @Get('records')
  @RequirePermission(PermissionKeys.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'List attendance records by student, class, section, or date range' })
  async list(@Req() req: Request, @Query() query: AttendanceQueryDto) {
    return { success: true, data: await this.attendance.list(this.tenantId(req), query) };
  }

  @Get('summary')
  @RequirePermission(PermissionKeys.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Attendance summary by student, class, and date range' })
  @ApiResponse({ status: 200, description: 'Status counts grouped by student, class, and date.' })
  async summary(@Req() req: Request, @Query() query: AttendanceQueryDto) {
    return { success: true, data: await this.attendance.summary(this.tenantId(req), query) };
  }

  @Get('my-summary')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiOperation({ summary: 'Return attendance summaries only for the authenticated student or guardian-linked students' })
  async mySummary(@Req() req: Request) {
    return { success: true, data: await this.attendance.mySummary(this.tenantId(req), this.userId(req)) };
  }

  private tenantId(req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) throw new ForbiddenException('Missing tenant context');
    return tenantId;
  }
  private userId(req: Request) {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) throw new ForbiddenException('Missing user context');
    return userId;
  }
}

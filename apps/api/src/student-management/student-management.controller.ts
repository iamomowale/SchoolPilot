import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantGuard } from '../authorization/tenant.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PermissionKeys } from '../authorization/permissions';
import { StudentManagementService } from './student-management.service';
import { CreateStudentDto, UpdateStudentDto, CreateGuardianDto, UpdateGuardianDto, CreateRelationshipDto, CreateEnrollmentDto, CsvImportDto } from './dto';

@ApiTags('student-management')
@Controller('student-management')
@UseGuards(TenantGuard, PermissionGuard)
export class StudentManagementController {
  constructor(private readonly studentManagementService: StudentManagementService) {}

  @Get('students')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async listStudents(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.listStudents(tenantId) };
  }

  @Post('students')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createStudent(@Req() req: Request, @Body() dto: CreateStudentDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.createStudent(tenantId, dto) };
  }

  @Patch('students/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateStudent(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.updateStudent(tenantId, id, dto) };
  }

  @Delete('students/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteStudent(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.deleteStudent(tenantId, id) };
  }

  @Get('guardians')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async listGuardians(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.listGuardians(tenantId) };
  }

  @Post('guardians')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createGuardian(@Req() req: Request, @Body() dto: CreateGuardianDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.createGuardian(tenantId, dto) };
  }

  @Patch('guardians/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateGuardian(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.updateGuardian(tenantId, id, dto) };
  }

  @Delete('guardians/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteGuardian(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.deleteGuardian(tenantId, id) };
  }

  @Post('relationships')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createRelationship(@Req() req: Request, @Body() dto: CreateRelationshipDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.createRelationship(tenantId, dto) };
  }

  @Post('enrollments')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async enrollStudent(@Req() req: Request, @Body() dto: CreateEnrollmentDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.enrollStudent(tenantId, dto) };
  }

  @Post('import/csv/preview')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async previewCsvImport(@Req() req: Request, @Body() dto: CsvImportDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.previewCsvImport(tenantId, dto.rows) };
  }

  @Post('import/csv')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async importCsv(@Req() req: Request, @Body() dto: CsvImportDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.studentManagementService.importCsv(tenantId, dto.rows, this.getUserId(req)) };
  }

  private getTenantId(req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) throw new ForbiddenException('Missing tenant context');
    return tenantId;
  }

  private getUserId(req: Request) {
    return (req.headers['x-user-id'] as string | undefined);
  }
}

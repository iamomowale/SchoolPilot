import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantGuard } from '../authorization/tenant.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PermissionKeys } from '../authorization/permissions';
import { AuthorizationService } from '../authorization/authorization.service';
import { SchoolConfigService } from './school-config.service';
import { CreateBranchDto, UpdateBranchDto } from './branches/dto';
import { CreateAcademicSessionDto, UpdateAcademicSessionDto } from './academic/dto';
import { CreateTermDto, UpdateTermDto } from './terms/dto';
import { CreateClassDto, UpdateClassDto } from './classes/dto';
import { CreateSectionDto, UpdateSectionDto } from './sections/dto';
import { CreateSubjectDto, UpdateSubjectDto } from './subjects/dto';
import { CreateTeacherAssignmentDto, UpdateTeacherAssignmentDto } from './assignments/dto';

@ApiTags('school-config')
@Controller('school-config')
@UseGuards(TenantGuard, PermissionGuard)
export class SchoolConfigController {
  constructor(private readonly schoolConfigService: SchoolConfigService, private readonly authorization: AuthorizationService) {}

  @Get('branches')
  @ApiOperation({ summary: 'List branches' })
  @ApiResponse({ status: 200, description: 'Branches returned successfully' })
  async listBranches(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listBranches(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('branches')
  @RequirePermission(PermissionKeys.TENANT_MANAGE)
  @ApiOperation({ summary: 'Create a branch' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  async createBranch(@Req() req: Request, @Body() dto: CreateBranchDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createBranch(tenantId, dto) };
  }

  @Patch('branches/:id')
  @RequirePermission(PermissionKeys.TENANT_MANAGE)
  async updateBranch(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateBranch(tenantId, id, dto) };
  }

  @Delete('branches/:id')
  @RequirePermission(PermissionKeys.TENANT_MANAGE)
  async deleteBranch(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteBranch(tenantId, id) };
  }

  @Get('academic-sessions')
  async listAcademicSessions(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listAcademicSessions(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('academic-sessions')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createAcademicSession(@Req() req: Request, @Body() dto: CreateAcademicSessionDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createAcademicSession(tenantId, dto) };
  }

  @Patch('academic-sessions/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateAcademicSession(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAcademicSessionDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateAcademicSession(tenantId, id, dto) };
  }

  @Delete('academic-sessions/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteAcademicSession(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteAcademicSession(tenantId, id) };
  }

  @Get('terms')
  async listTerms(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listTerms(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('terms')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createTerm(@Req() req: Request, @Body() dto: CreateTermDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createTerm(tenantId, dto) };
  }

  @Patch('terms/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateTerm(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTermDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateTerm(tenantId, id, dto) };
  }

  @Delete('terms/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteTerm(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteTerm(tenantId, id) };
  }

  @Get('classes')
  async listClasses(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listClasses(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('classes')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createClass(@Req() req: Request, @Body() dto: CreateClassDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createClass(tenantId, dto) };
  }

  @Patch('classes/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateClass(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateClassDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateClass(tenantId, id, dto) };
  }

  @Delete('classes/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteClass(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteClass(tenantId, id) };
  }

  @Get('sections')
  async listSections(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listSections(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('sections')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createSection(@Req() req: Request, @Body() dto: CreateSectionDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createSection(tenantId, dto) };
  }

  @Patch('sections/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateSection(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateSection(tenantId, id, dto) };
  }

  @Delete('sections/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteSection(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteSection(tenantId, id) };
  }

  @Get('subjects')
  async listSubjects(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listSubjects(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('subjects')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createSubject(@Req() req: Request, @Body() dto: CreateSubjectDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createSubject(tenantId, dto) };
  }

  @Patch('subjects/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateSubject(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateSubject(tenantId, id, dto) };
  }

  @Delete('subjects/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteSubject(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteSubject(tenantId, id) };
  }

  @Get('teacher-assignments')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async listTeacherAssignments(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.listTeacherAssignments(tenantId, this.getUserId(req), await this.isAdmin(req)) };
  }

  @Post('teacher-assignments')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async createTeacherAssignment(@Req() req: Request, @Body() dto: CreateTeacherAssignmentDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.createTeacherAssignment(tenantId, dto) };
  }

  @Patch('teacher-assignments/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async updateTeacherAssignment(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTeacherAssignmentDto) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.updateTeacherAssignment(tenantId, id, dto) };
  }

  @Delete('teacher-assignments/:id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  async deleteTeacherAssignment(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return { success: true, data: await this.schoolConfigService.deleteTeacherAssignment(tenantId, id) };
  }

  private getTenantId(req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) throw new Error('Missing tenant context');
    return tenantId;
  }

  private getUserId(req: Request) {
    return (req.headers['x-user-id'] as string | undefined);
  }

  private async isAdmin(req: Request) {
    const userId = this.getUserId(req);
    return userId ? this.authorization.isSchoolAdmin(userId, this.getTenantId(req)) : false;
  }
}

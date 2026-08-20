import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { ChangeScoreDto, CreateAssessmentConfigurationDto, CreateAssessmentTypeDto, CreateResultSheetDto, EnterScoreDto, PublishedResultsQueryDto, TransitionResultSheetDto } from './dto';
import { ResultsService } from './results.service';

@ApiTags('assessment-results')
@Controller('results')
@UseGuards(TenantGuard, PermissionGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Post('assessment-types') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Create an assessment type with default weighting' })
  createType(@Req() req: Request, @Body() dto: CreateAssessmentTypeDto) { return this.reply(this.results.createAssessmentType(this.tenant(req), this.user(req), dto)); }

  @Post('assessment-configurations') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Configure a weighted assessment for a term, class, section, and subject' })
  createConfiguration(@Req() req: Request, @Body() dto: CreateAssessmentConfigurationDto) { return this.reply(this.results.createConfiguration(this.tenant(req), this.user(req), dto)); }

  @Post('sheets') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Create a draft result sheet for a term and section' })
  createSheet(@Req() req: Request, @Body() dto: CreateResultSheetDto) { return this.reply(this.results.createSheet(this.tenant(req), this.user(req), dto)); }

  @Post('scores') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Enter a score for an assigned class, section, and subject' })
  @ApiResponse({ status: 409, description: 'Duplicate score, score exceeds maximum, or sheet is not draft.' })
  enterScore(@Req() req: Request, @Body() dto: EnterScoreDto) { return this.reply(this.results.enterScore(this.tenant(req), this.user(req), dto)); }

  @Patch('scores/:id') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Update a score while its result sheet is draft' })
  updateScore(@Req() req: Request, @Param('id') id: string, @Body() dto: ChangeScoreDto) { return this.reply(this.results.updateScore(this.tenant(req), this.user(req), id, dto)); }

  @Patch('scores/:id/correction') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Audited school-admin correction to a published score' })
  correctScore(@Req() req: Request, @Param('id') id: string, @Body() dto: ChangeScoreDto) { return this.reply(this.results.correctPublishedScore(this.tenant(req), this.user(req), id, dto)); }

  @Patch('sheets/:id/status') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Move a result sheet through draft, submitted, approved, and published' })
  transition(@Req() req: Request, @Param('id') id: string, @Body() dto: TransitionResultSheetDto) { return this.reply(this.results.transitionSheet(this.tenant(req), this.user(req), id, dto.status)); }

  @Get('sheets/:id/calculation') @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Calculate weighted term results for a result sheet' })
  calculate(@Req() req: Request, @Param('id') id: string) { return this.reply(this.results.calculateForUser(this.tenant(req), this.user(req), id)); }

  @Get('published/me') @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiOperation({ summary: 'Return only the caller’s published student or guardian-linked results' })
  published(@Req() req: Request, @Query() query: PublishedResultsQueryDto) { return this.reply(this.results.myPublishedResults(this.tenant(req), this.user(req), query)); }

  private async reply<T>(request: Promise<T>) { return { success: true, data: await request }; }
  private tenant(req: Request) { const id = req.headers['x-tenant-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing tenant context'); return id; }
  private user(req: Request) { const id = req.headers['x-user-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing user context'); return id; }
}

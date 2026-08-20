import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { GenerateReportCardDto } from './dto';
import { ReportCardsService } from './report-cards.service';

@ApiTags('report-cards')
@Controller('report-cards')
@UseGuards(TenantGuard, PermissionGuard)
export class ReportCardsController {
  constructor(private readonly reportCards: ReportCardsService) {}

  @Post('sheets/:sheetId')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Generate and securely store a branded PDF report card from a published result sheet' })
  async generate(@Req() req: Request, @Param('sheetId') sheetId: string, @Body() dto: GenerateReportCardDto) { return { success: true, data: await this.reportCards.generate(this.tenant(req), this.user(req), sheetId, dto) }; }

  @Get(':id/download')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download an authorized student, guardian, teacher, or administrator report card' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF report card stream.' })
  async download(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Param('id') id: string) {
    const { card, buffer } = await this.reportCards.download(this.tenant(req), this.user(req), id);
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${card.studentId}.pdf"`);
    return new StreamableFile(buffer);
  }

  private tenant(req: Request) { const id = req.headers['x-tenant-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing tenant context'); return id; }
  private user(req: Request) { const id = req.headers['x-user-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing user context'); return id; }
}

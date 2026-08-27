import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { CreateAnnouncementDto } from './dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@Controller('announcements')
@UseGuards(TenantGuard, PermissionGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  @RequirePermission(PermissionKeys.ANNOUNCEMENT_MANAGE)
  @ApiOperation({ summary: 'Publish an announcement targeted by tenant, branch, class, role, or individual user' })
  @ApiResponse({ status: 201, description: 'Creates in-app notifications and queues any configured email or SMS deliveries.' })
  create(@Req() req: Request, @Body() dto: CreateAnnouncementDto) {
    return this.reply(this.announcements.create(this.tenant(req), this.user(req), dto));
  }

  @Get('notifications/me')
  @ApiOperation({ summary: 'List the authenticated user’s in-app notifications and delivery status' })
  @ApiResponse({ status: 200, description: 'Returns notifications for the current tenant member.' })
  mine(@Req() req: Request) {
    return this.reply(this.announcements.myNotifications(this.tenant(req), this.user(req)));
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark the authenticated user’s notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  read(@Req() req: Request, @Param('id') id: string) {
    return this.reply(this.announcements.markRead(this.tenant(req), this.user(req), id));
  }

  private async reply<T>(result: Promise<T>) {
    return { success: true, data: await result };
  }

  private tenant(req: Request) {
    const id = req.headers['x-tenant-id'] as string | undefined;
    if (!id) {
      throw new ForbiddenException('Missing tenant context');
    }

    return id;
  }

  private user(req: Request) {
    const id = req.headers['x-user-id'] as string | undefined;
    if (!id) {
      throw new ForbiddenException('Missing user context');
    }

    return id;
  }
}

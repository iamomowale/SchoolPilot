import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementQueueService } from './announcement-queue.service';
import { NotificationsService } from './notifications.service';
@Module({ imports: [AuthorizationModule], controllers: [AnnouncementsController], providers: [AnnouncementsService, AnnouncementQueueService, NotificationsService, PrismaService] })
export class AnnouncementsModule {}

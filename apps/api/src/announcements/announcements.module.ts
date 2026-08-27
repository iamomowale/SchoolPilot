import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { AnnouncementQueueService } from './announcement-queue.service';
import { MockEmailAdapter } from './adapters/mock-email.adapter';
import { MockSmsAdapter } from './adapters/mock-sms.adapter';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { NotificationDeliveryRegistry } from './notification-delivery.registry';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [AnnouncementsController],
  providers: [
    AnnouncementsService,
    AnnouncementQueueService,
    NotificationsService,
    NotificationDeliveryRegistry,
    MockEmailAdapter,
    MockSmsAdapter,
    PrismaService,
  ],
})
export class AnnouncementsModule {}

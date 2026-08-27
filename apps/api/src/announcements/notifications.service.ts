import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { PrismaService } from '../common/prisma.service';
import { NotificationDeliveryRegistry } from './notification-delivery.registry';
import { NotificationAdapterChannel, NotificationDeliveryChannel, NotificationDeliveryContext } from './notification-delivery.types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adapters: NotificationDeliveryRegistry,
  ) {}

  async processDelivery(deliveryId: string, attemptNumber = 1, maxAttempts = 3) {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: { id: deliveryId },
      include: {
        notification: {
          include: {
            announcement: true,
            user: true,
          },
        },
      },
    });

    if (!delivery) {
      return;
    }

    if (delivery.status === 'delivered') {
      return;
    }

    const channel = delivery.channel as NotificationDeliveryChannel;
    if (channel === 'in_app') {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: { increment: 1 },
          status: 'delivered',
          deliveredAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        },
      });
      return;
    }

    const adapterChannel = channel as NotificationAdapterChannel;
    const recipient = await this.resolveRecipient(delivery.notification.userId, adapterChannel);
    const context: NotificationDeliveryContext = {
      tenantId: delivery.tenantId,
      deliveryId: delivery.id,
      notificationId: delivery.notificationId,
      announcementId: delivery.notification.announcementId,
      channel: adapterChannel,
      title: delivery.notification.title,
      body: delivery.notification.body,
      recipient,
      attempts: delivery.attempts + 1,
    };

    try {
      await this.adapters.get(adapterChannel).send(context);
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: { increment: 1 },
          status: 'delivered',
          deliveredAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        },
      });
      await this.audit.log({
        tenantId: delivery.tenantId,
        action: 'delivery-succeeded',
        entityType: 'notification-delivery',
        entityId: delivery.id,
        details: `${channel} delivery succeeded on attempt ${context.attempts}`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Delivery failed';
      const finalAttempt = attemptNumber >= maxAttempts;
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: { increment: 1 },
          status: finalAttempt ? 'failed' : 'queued',
          lastError: reason,
          nextAttemptAt: finalAttempt ? null : this.nextRetryTime(attemptNumber),
        },
      });

      if (finalAttempt) {
        await this.audit.log({
          tenantId: delivery.tenantId,
          action: 'delivery-failed',
          entityType: 'notification-delivery',
          entityId: delivery.id,
          details: `${channel} delivery failed after ${attemptNumber} attempts: ${reason}`,
        });
      }

      throw error;
    }
  }

  async markFailed(id: string) {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: { id },
      select: { id: true, status: true, tenantId: true },
    });

    if (!delivery || delivery.status === 'delivered' || delivery.status === 'failed') {
      return;
    }

    await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'failed',
        nextAttemptAt: null,
      },
    });
  }

  private nextRetryTime(attemptNumber: number) {
    const baseDelay = Number(process.env.NOTIFICATION_QUEUE_BACKOFF_MS || '1000');
    const delay = baseDelay * Math.max(1, attemptNumber);
    return new Date(Date.now() + delay);
  }

  private async resolveRecipient(userId: string, channel: NotificationDeliveryChannel) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    if (channel === 'email') {
      return {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      };
    }

    const [student, guardian] = await Promise.all([
      this.prisma.studentProfile.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { phone: true },
      }),
      this.prisma.guardianProfile.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { phone: true },
      }),
    ]);

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      phone: student?.phone || guardian?.phone || null,
    };
  }
}

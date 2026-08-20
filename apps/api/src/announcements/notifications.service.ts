import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}
  async processDelivery(id: string) {
    const delivery = await this.prisma.notificationDelivery.findFirst({ where: { id, status: 'queued' }, include: { notification: { include: { user: true } } } });
    if (!delivery) return;
    try {
      if (delivery.channel === 'email' && !delivery.notification.user.email) throw new Error('Recipient has no email address');
      if (delivery.channel === 'sms') throw new Error('SMS adapter is not configured for this pilot');
      await this.prisma.notificationDelivery.update({ where: { id }, data: { status: 'delivered', attempts: { increment: 1 }, deliveredAt: new Date(), lastError: null } });
    } catch (error) {
      await this.prisma.notificationDelivery.update({ where: { id }, data: { attempts: { increment: 1 }, lastError: error instanceof Error ? error.message : 'Delivery failed' } });
      throw error;
    }
  }
  async markFailed(id: string) { await this.prisma.notificationDelivery.update({ where: { id }, data: { status: 'failed' } }); }
}

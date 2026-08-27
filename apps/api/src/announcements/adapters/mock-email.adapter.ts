import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NotificationDeliveryAdapter, NotificationDeliveryContext } from '../notification-delivery.types';

@Injectable()
export class MockEmailAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'email' as const;

  async send(context: NotificationDeliveryContext): Promise<void> {
    const from = process.env.NOTIFICATION_EMAIL_FROM || 'no-reply@schoolpilot.local';
    if (!context.recipient.email) {
      throw new ServiceUnavailableException('Recipient has no email address');
    }

    const payload = {
      from,
      to: context.recipient.email,
      subject: context.title,
      body: context.body,
      tenantId: context.tenantId,
      announcementId: context.announcementId,
      notificationId: context.notificationId,
      deliveryId: context.deliveryId,
      attempts: context.attempts,
    };

    const webhookUrl = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      console.info(`[notification-email] ${from} -> ${context.recipient.email}: ${context.title}`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Email sandbox rejected delivery with status ${response.status}`);
    }
  }
}

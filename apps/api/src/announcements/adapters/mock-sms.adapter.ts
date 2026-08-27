import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NotificationDeliveryAdapter, NotificationDeliveryContext } from '../notification-delivery.types';

@Injectable()
export class MockSmsAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'sms' as const;

  async send(context: NotificationDeliveryContext): Promise<void> {
    if (!context.recipient.phone) {
      throw new ServiceUnavailableException('Recipient has no phone number');
    }

    const sender = process.env.NOTIFICATION_SMS_SENDER || 'SchoolPilot';
    const payload = {
      sender,
      to: context.recipient.phone,
      message: `${context.title}\n\n${context.body}`,
      tenantId: context.tenantId,
      announcementId: context.announcementId,
      notificationId: context.notificationId,
      deliveryId: context.deliveryId,
      attempts: context.attempts,
    };

    const webhookUrl = process.env.NOTIFICATION_SMS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.info(`[notification-sms] ${sender} -> ${context.recipient.phone}: ${context.title}`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`SMS sandbox rejected delivery with status ${response.status}`);
    }
  }
}

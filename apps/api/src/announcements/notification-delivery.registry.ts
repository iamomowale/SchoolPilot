import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MockEmailAdapter } from './adapters/mock-email.adapter';
import { MockSmsAdapter } from './adapters/mock-sms.adapter';
import { NotificationAdapterChannel, NotificationDeliveryAdapter } from './notification-delivery.types';

@Injectable()
export class NotificationDeliveryRegistry {
  constructor(
    private readonly emailAdapter: MockEmailAdapter,
    private readonly smsAdapter: MockSmsAdapter,
  ) {}

  get(channel: NotificationAdapterChannel): NotificationDeliveryAdapter {
    switch (channel) {
      case 'email':
        if ((process.env.NOTIFICATION_EMAIL_PROVIDER || 'mock') !== 'mock') {
          throw new ServiceUnavailableException(`Email provider "${process.env.NOTIFICATION_EMAIL_PROVIDER}" is not configured`);
        }
        return this.emailAdapter;
      case 'sms':
        if ((process.env.NOTIFICATION_SMS_PROVIDER || 'mock') !== 'mock') {
          throw new ServiceUnavailableException(`SMS provider "${process.env.NOTIFICATION_SMS_PROVIDER}" is not configured`);
        }
        return this.smsAdapter;
      default:
        throw new ServiceUnavailableException(`Unsupported notification channel "${channel}"`);
    }
  }
}

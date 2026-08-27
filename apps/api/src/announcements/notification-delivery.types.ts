export type NotificationDeliveryChannel = 'in_app' | 'email' | 'sms';

export type NotificationAdapterChannel = 'email' | 'sms';

export type NotificationDeliveryRecipient = {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type NotificationDeliveryContext = {
  tenantId: string;
  deliveryId: string;
  notificationId: string;
  announcementId: string | null;
  channel: NotificationAdapterChannel;
  title: string;
  body: string;
  recipient: NotificationDeliveryRecipient;
  attempts: number;
};

export interface NotificationDeliveryAdapter {
  readonly channel: NotificationAdapterChannel;
  send(context: NotificationDeliveryContext): Promise<void>;
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookFailureAlertService {
  async notify(context: { provider: string; eventId: string; reason: string }): Promise<void> {
    const message = `[payment-webhook-alert] provider=${context.provider} event=${context.eventId} reason=${context.reason}`;
    console.error(message);

    const alertUrl = process.env.PAYMENT_WEBHOOK_ALERT_URL;
    if (!alertUrl) return;
    try {
      await fetch(alertUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context) });
    } catch (error) {
      console.error(`[payment-webhook-alert] delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

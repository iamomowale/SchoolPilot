import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationsService } from './notifications.service';

@Injectable()
export class AnnouncementQueueService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<{ deliveryId: string }>;
  private worker?: Worker<{ deliveryId: string }>;
  private connection?: IORedis;
  constructor(private readonly notifications: NotificationsService) {}
  onModuleInit() {
    this.connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.queue = new Queue('notification-delivery', { connection: this.connection });
    this.worker = new Worker('notification-delivery', async (job: Job<{ deliveryId: string }>) => this.notifications.processDelivery(job.data.deliveryId), { connection: this.connection });
    this.worker.on('failed', (job) => { if (job && job.attemptsMade >= (job.opts.attempts || 1)) void this.notifications.markFailed(job.data.deliveryId); });
  }
  async onModuleDestroy() { await this.worker?.close(); await this.queue?.close(); await this.connection?.quit(); }
  async enqueue(deliveryIds: string[]) { if (!this.queue) throw new Error('Notification queue is unavailable'); await Promise.all(deliveryIds.map((deliveryId) => this.queue?.add('deliver', { deliveryId }, { jobId: deliveryId, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true }))); }
}

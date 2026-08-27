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
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const concurrency = Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY || '4');

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue('notification-delivery', {
      connection: this.connection,
    });
    this.worker = new Worker(
      'notification-delivery',
      async (job: Job<{ deliveryId: string }>) => {
        await this.notifications.processDelivery(job.data.deliveryId, job.attemptsMade + 1, job.opts.attempts ?? 3);
      },
      {
        connection: this.connection,
        concurrency,
      },
    );
    this.worker.on('failed', (job) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        void this.notifications.markFailed(job.data.deliveryId);
      }
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueue(deliveryIds: string[]) {
    if (!deliveryIds.length) {
      return;
    }

    const queue = this.queue;
    if (!queue) {
      throw new Error('Notification queue is unavailable');
    }

    const attempts = Number(process.env.NOTIFICATION_QUEUE_ATTEMPTS || '3');
    const backoffDelay = Number(process.env.NOTIFICATION_QUEUE_BACKOFF_MS || '1000');

    await Promise.all(
      deliveryIds.map((deliveryId) =>
        queue.add(
          'deliver',
          { deliveryId },
          {
            jobId: deliveryId,
            attempts,
            backoff: {
              type: 'exponential',
              delay: backoffDelay,
            },
            removeOnComplete: true,
          },
        ),
      ),
    );
  }
}

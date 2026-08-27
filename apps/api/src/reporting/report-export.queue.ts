import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ReportExportProcessor } from './report-export.processor';

@Injectable()
export class ReportExportQueue implements OnModuleInit, OnModuleDestroy {
  private connection?: IORedis;
  private queue?: Queue<{ exportId: string }>;
  private worker?: Worker<{ exportId: string }>;

  constructor(private readonly processor: ReportExportProcessor) {}

  onModuleInit() {
    this.connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.queue = new Queue('report-export', { connection: this.connection });
    this.worker = new Worker('report-export', (job: Job<{ exportId: string }>) => this.processor.process(job.data.exportId), {
      connection: this.connection,
      concurrency: Number(process.env.REPORT_EXPORT_QUEUE_CONCURRENCY || '2'),
    });
  }

  async enqueue(exportId: string) {
    if (!this.queue) throw new Error('Report export queue is unavailable');
    await this.queue.add('generate', { exportId }, {
      jobId: exportId,
      attempts: Number(process.env.REPORT_EXPORT_QUEUE_ATTEMPTS || '3'),
      backoff: { type: 'exponential', delay: Number(process.env.REPORT_EXPORT_QUEUE_BACKOFF_MS || '1000') },
      removeOnComplete: true,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}

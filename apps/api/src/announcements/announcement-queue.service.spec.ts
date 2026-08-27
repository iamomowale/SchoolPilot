import { AnnouncementQueueService } from './announcement-queue.service';
import { NotificationsService } from './notifications.service';

describe('AnnouncementQueueService', () => {
  it('enqueues each queued delivery with retry metadata', async () => {
    const notifications = { processDelivery: jest.fn(), markFailed: jest.fn() } as unknown as NotificationsService;
    const service = new AnnouncementQueueService(notifications);
    const queueAdd = jest.fn().mockResolvedValue(undefined);

    (service as unknown as { queue: { add: typeof queueAdd } }).queue = { add: queueAdd };

    await service.enqueue(['delivery-1', 'delivery-2']);

    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd).toHaveBeenCalledWith(
      'deliver',
      { deliveryId: 'delivery-1' },
      expect.objectContaining({
        jobId: 'delivery-1',
        attempts: 3,
        backoff: expect.objectContaining({ type: 'exponential', delay: 1000 }),
        removeOnComplete: true,
      }),
    );
  });
});

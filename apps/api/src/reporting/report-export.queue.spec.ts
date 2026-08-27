import { ReportExportProcessor } from './report-export.processor';
import { ReportExportQueue } from './report-export.queue';

describe('ReportExportQueue', () => {
  it('enqueues a persisted export job with retry metadata', async () => {
    const service = new ReportExportQueue({ process: jest.fn() } as unknown as ReportExportProcessor);
    const add = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { queue: { add: typeof add } }).queue = { add };

    await service.enqueue('export-1');

    expect(add).toHaveBeenCalledWith('generate', { exportId: 'export-1' }, expect.objectContaining({ jobId: 'export-1', attempts: 3, backoff: { type: 'exponential', delay: 1000 } }));
  });
});

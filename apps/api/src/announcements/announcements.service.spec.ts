import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../authorization/audit.service';
import { AnnouncementQueueService } from './announcement-queue.service';

describe('AnnouncementsService', () => {
  it('creates tenant-scoped in-app notifications and queues their delivery', async () => {
    const prisma = {
      userTenantMembership: { findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]), findFirst: jest.fn() },
      announcement: { create: jest.fn().mockResolvedValue({ id: 'announcement-1' }) },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1', deliveries: [{ id: 'delivery-1' }] }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    const audit = { log: jest.fn() };
    const queue = { enqueue: jest.fn() };
    const service = new AnnouncementsService(prisma as unknown as PrismaService, audit as unknown as AuditService, queue as unknown as AnnouncementQueueService);

    await service.create('tenant-1', 'admin-1', { title: 'School closes Friday', body: 'Collection is at noon.' });

    expect(prisma.announcement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }));
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', announcementId: 'announcement-1' }) }));
    expect(queue.enqueue).toHaveBeenCalledWith(['delivery-1']);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish', tenantId: 'tenant-1' }));
  });
});

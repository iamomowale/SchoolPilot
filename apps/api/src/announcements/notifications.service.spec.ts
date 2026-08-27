import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../authorization/audit.service';
import { PrismaService } from '../common/prisma.service';
import { NotificationDeliveryRegistry } from './notification-delivery.registry';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    notificationDelivery: { findFirst: jest.fn(), update: jest.fn() },
    user: { findFirst: jest.fn() },
    studentProfile: { findFirst: jest.fn() },
    guardianProfile: { findFirst: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const adapters = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationDeliveryRegistry, useValue: adapters },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('delivers a queued email notification and marks it delivered', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      tenantId: 'tenant-1',
      notificationId: 'notification-1',
      channel: 'email',
      status: 'queued',
      attempts: 0,
      notification: {
        announcementId: 'announcement-1',
        title: 'Assembly reminder',
        body: 'Please assemble by 8am.',
        userId: 'user-1',
        user: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });
    adapters.get.mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) });
    prisma.notificationDelivery.update.mockResolvedValue({ id: 'delivery-1' });

    await service.processDelivery('delivery-1', 1, 3);

    expect(adapters.get).toHaveBeenCalledWith('email');
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'delivery-1' }, data: expect.objectContaining({ status: 'delivered', deliveredAt: expect.any(Date) }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delivery-succeeded', entityType: 'notification-delivery' }));
  });

  it('queues a retry when delivery fails before the final attempt', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-2',
      tenantId: 'tenant-1',
      notificationId: 'notification-2',
      channel: 'sms',
      status: 'queued',
      attempts: 0,
      notification: {
        announcementId: 'announcement-2',
        title: 'Fees reminder',
        body: 'Please pay before Friday.',
        userId: 'user-2',
        user: { id: 'user-2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' });
    prisma.studentProfile.findFirst.mockResolvedValue({ phone: '+2348000000000' });
    adapters.get.mockReturnValue({ send: jest.fn().mockRejectedValue(new Error('Gateway timeout')) });
    prisma.notificationDelivery.update.mockResolvedValue({ id: 'delivery-2' });

    await expect(service.processDelivery('delivery-2', 1, 3)).rejects.toThrow('Gateway timeout');
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'delivery-2' }, data: expect.objectContaining({ status: 'queued', lastError: 'Gateway timeout', nextAttemptAt: expect.any(Date) }) }));
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'delivery-failed' }));
  });

  it('marks delivery failed on the final attempt', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-3',
      tenantId: 'tenant-1',
      notificationId: 'notification-3',
      channel: 'sms',
      status: 'queued',
      attempts: 2,
      notification: {
        announcementId: 'announcement-3',
        title: 'Fees reminder',
        body: 'Please pay before Friday.',
        userId: 'user-3',
        user: { id: 'user-3', firstName: 'Katherine', lastName: 'Johnson', email: 'kj@example.com' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-3', firstName: 'Katherine', lastName: 'Johnson', email: 'kj@example.com' });
    prisma.guardianProfile.findFirst.mockResolvedValue({ phone: '+2348111111111' });
    adapters.get.mockReturnValue({ send: jest.fn().mockRejectedValue(new Error('Gateway timeout')) });
    prisma.notificationDelivery.update.mockResolvedValue({ id: 'delivery-3' });

    await expect(service.processDelivery('delivery-3', 3, 3)).rejects.toThrow('Gateway timeout');
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'delivery-3' }, data: expect.objectContaining({ status: 'failed', lastError: 'Gateway timeout', nextAttemptAt: null }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delivery-failed' }));
  });
});

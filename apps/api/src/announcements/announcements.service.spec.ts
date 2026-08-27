import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../authorization/audit.service';
import { PrismaService } from '../common/prisma.service';
import { AnnouncementQueueService } from './announcement-queue.service';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  const prisma = {
    branch: { findFirst: jest.fn() },
    schoolClass: { findFirst: jest.fn() },
    userTenantMembership: { findMany: jest.fn(), findFirst: jest.fn() },
    teacherAssignment: { findMany: jest.fn() },
    studentEnrollment: { findMany: jest.fn() },
    announcement: { create: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    notificationDelivery: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const queue = { enqueue: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: AnnouncementQueueService, useValue: queue },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it('creates tenant-scoped notifications and queues only non in-app deliveries', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.schoolClass.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.userTenantMembership.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    prisma.teacherAssignment.findMany.mockResolvedValue([{ userId: 'user-2' }]);
    prisma.studentEnrollment.findMany.mockResolvedValue([{ student: { userId: 'user-3' } }, { student: { userId: null } }]);
    prisma.userTenantMembership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.announcement.create.mockResolvedValue({ id: 'announcement-1' });
    prisma.notification.create.mockImplementation(async ({ data }: { data: { userId: string } }) => ({ id: `notification-${data.userId}`, userId: data.userId }));
    prisma.notificationDelivery.create.mockImplementation(async ({ data }: { data: { notification: { connect: { id: string } }; channel: string; status?: string } }) => ({
      id: `delivery-${data.notification.connect.id}-${data.channel}`,
      channel: data.channel,
      status: data.status,
    }));

    const result = await service.create('tenant-1', 'user-9', {
      title: 'Assembly reminder',
      body: 'Please assemble by 8am.',
      branchId: 'branch-1',
      classId: 'class-1',
      roleName: 'Bursar',
      userIds: ['user-3'],
      channels: ['in_app', 'email', 'sms'],
    });

    expect(prisma.announcement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', createdById: 'user-9' }) }));
    expect(prisma.notification.create).toHaveBeenCalledTimes(3);
    expect(queue.enqueue).toHaveBeenCalledWith([
      'delivery-notification-user-1-email',
      'delivery-notification-user-1-sms',
      'delivery-notification-user-2-email',
      'delivery-notification-user-2-sms',
      'delivery-notification-user-3-email',
      'delivery-notification-user-3-sms',
    ]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish', tenantId: 'tenant-1' }));
    expect(result.notifications).toHaveLength(3);
  });

  it('rejects a target user that is outside the tenant', async () => {
    prisma.userTenantMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.create('tenant-1', 'user-9', {
        title: 'Assembly reminder',
        body: 'Please assemble by 8am.',
        userIds: ['missing-user'],
      }),
    ).rejects.toThrow('Target user is not in this tenant');
  });
});

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { PrismaService } from '../common/prisma.service';
import { AnnouncementQueueService } from './announcement-queue.service';
import { CreateAnnouncementDto } from './dto';

type AnnouncementChannel = 'in_app' | 'email' | 'sms';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly queue: AnnouncementQueueService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateAnnouncementDto) {
    const recipients = await this.resolveRecipients(tenantId, dto);
    if (recipients.length === 0) {
      throw new NotFoundException('No recipients matched the selected target');
    }

    const channels: AnnouncementChannel[] = this.deliveryChannels(dto.channels);
    const queueableDeliveryIds: string[] = [];

    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          tenantId,
          title: dto.title,
          body: dto.body,
          createdById: userId,
          targets: {
            create: this.targets(tenantId, dto),
          },
        },
      });

      const notifications = [];
      for (const recipientId of recipients) {
        const notification = await tx.notification.create({
          data: {
            tenantId,
            userId: recipientId,
            announcementId: created.id,
            title: dto.title,
            body: dto.body,
          },
        });

        const deliveries = await Promise.all(
          channels.map((channel) => {
            const deliveredImmediately = channel === 'in_app';
            return tx.notificationDelivery.create({
              data: {
                tenant: { connect: { id: tenantId } },
                notification: { connect: { id: notification.id } },
                channel,
                status: deliveredImmediately ? 'delivered' : 'queued',
                attempts: deliveredImmediately ? 1 : 0,
                deliveredAt: deliveredImmediately ? new Date() : null,
                nextAttemptAt: deliveredImmediately ? null : new Date(),
              },
            });
          }),
        );

        queueableDeliveryIds.push(...deliveries.filter((delivery) => delivery.status === 'queued').map((delivery) => delivery.id));
        notifications.push({ ...notification, deliveries });
      }

      return { ...created, notifications };
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'publish',
      entityType: 'announcement',
      entityId: announcement.id,
      details: `Published to ${recipients.length} recipients using ${channels.join(', ')}`,
    });

    await this.queue.enqueue(queueableDeliveryIds);

    return announcement;
  }

  myNotifications(tenantId: string, userId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      include: {
        announcement: true,
        deliveries: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, tenantId, userId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  private deliveryChannels(channels?: Array<AnnouncementChannel>): AnnouncementChannel[] {
    const requested: AnnouncementChannel[] = channels?.length ? channels : ['in_app'];
    return [...new Set(requested)];
  }

  private targets(tenantId: string, dto: CreateAnnouncementDto) {
    const targets: Array<{ tenantId: string; type: 'tenant' | 'branch' | 'class' | 'role' | 'user'; targetId?: string | null }> = [];

    if (dto.branchId) {
      targets.push({ tenantId, type: 'branch', targetId: dto.branchId });
    }

    if (dto.classId) {
      targets.push({ tenantId, type: 'class', targetId: dto.classId });
    }

    if (dto.roleName) {
      targets.push({ tenantId, type: 'role', targetId: dto.roleName });
    }

    for (const id of dto.userIds || []) {
      targets.push({ tenantId, type: 'user', targetId: id });
    }

    return targets.length ? targets : [{ tenantId, type: 'tenant' as const }];
  }

  private async resolveRecipients(tenantId: string, dto: CreateAnnouncementDto): Promise<string[]> {
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId, deletedAt: null }, select: { id: true } });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    if (dto.classId) {
      const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: dto.classId, tenantId, deletedAt: null }, select: { id: true } });
      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }
    }

    const memberships = await this.prisma.userTenantMembership.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(dto.branchId ? { branchId: dto.branchId } : {}),
        ...(dto.roleName
          ? {
              userRoles: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  role: { name: dto.roleName },
                },
              },
            }
          : {}),
      },
      select: { userId: true },
    });

    const recipients = new Set(memberships.map((membership) => membership.userId));

    if (dto.classId) {
      const [teachers, enrollments] = await Promise.all([
        this.prisma.teacherAssignment.findMany({
          where: { tenantId, classId: dto.classId, deletedAt: null, isActive: true },
          select: { userId: true },
        }),
        this.prisma.studentEnrollment.findMany({
          where: { tenantId, classId: dto.classId, deletedAt: null },
          select: { student: { select: { userId: true } } },
        }),
      ]);

      teachers.forEach((teacher) => recipients.add(teacher.userId));
      enrollments.forEach((enrollment) => {
        if (enrollment.student.userId) {
          recipients.add(enrollment.student.userId);
        }
      });
    }

    for (const userId of dto.userIds || []) {
      const membership = await this.prisma.userTenantMembership.findFirst({
        where: { tenantId, userId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!membership) {
        throw new NotFoundException('Target user is not in this tenant');
      }
      recipients.add(userId);
    }

    return [...recipients];
  }
}

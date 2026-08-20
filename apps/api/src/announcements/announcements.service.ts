import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { PrismaService } from '../common/prisma.service';
import { AnnouncementQueueService } from './announcement-queue.service';
import { CreateAnnouncementDto } from './dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly queue: AnnouncementQueueService) {}
  async create(tenantId: string, userId: string, dto: CreateAnnouncementDto) {
    const targetIds = await this.resolveRecipients(tenantId, dto);
    const channels: Array<'in_app' | 'email' | 'sms'> = dto.channels?.length ? dto.channels : ['in_app'];
    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({ data: { tenantId, title: dto.title, body: dto.body, createdById: userId, targets: { create: this.targets(tenantId, dto) } } });
      const notifications = await Promise.all(targetIds.map((recipientId) => tx.notification.create({ data: { tenantId, userId: recipientId, announcementId: created.id, title: dto.title, body: dto.body, deliveries: { create: channels.map((channel) => ({ channel, tenant: { connect: { id: tenantId } } })) } }, include: { deliveries: true } })));
      return { ...created, notifications };
    });
    await this.audit.log({ tenantId, userId, action: 'publish', entityType: 'announcement', entityId: announcement.id, details: `Published to ${targetIds.length} recipients` });
    await this.queue.enqueue(announcement.notifications.flatMap((notification) => notification.deliveries.map((delivery) => delivery.id)));
    return announcement;
  }
  myNotifications(tenantId: string, userId: string) { return this.prisma.notification.findMany({ where: { tenantId, userId }, include: { deliveries: true }, orderBy: { createdAt: 'desc' } }); }
  async markRead(tenantId: string, userId: string, id: string) { const notification = await this.prisma.notification.findFirst({ where: { id, tenantId, userId } }); if (!notification) throw new NotFoundException('Notification not found'); return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }); }
  private targets(tenantId: string, dto: CreateAnnouncementDto) { const targets = []; if (dto.branchId) targets.push({ tenantId, type: 'branch' as const, targetId: dto.branchId }); if (dto.classId) targets.push({ tenantId, type: 'class' as const, targetId: dto.classId }); if (dto.roleName) targets.push({ tenantId, type: 'role' as const, targetId: dto.roleName }); for (const id of dto.userIds || []) targets.push({ tenantId, type: 'user' as const, targetId: id }); return targets.length ? targets : [{ tenantId, type: 'tenant' as const }]; }
  private async resolveRecipients(tenantId: string, dto: CreateAnnouncementDto): Promise<string[]> {
    if (dto.branchId) { const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId, deletedAt: null } }); if (!branch) throw new NotFoundException('Branch not found'); }
    if (dto.classId) { const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: dto.classId, tenantId, deletedAt: null } }); if (!schoolClass) throw new NotFoundException('Class not found'); }
    const memberships = await this.prisma.userTenantMembership.findMany({ where: { tenantId, deletedAt: null, isActive: true, ...(dto.branchId ? { branchId: dto.branchId } : {}), ...(dto.roleName ? { userRoles: { some: { role: { name: dto.roleName }, deletedAt: null, isActive: true } } } : {}) }, select: { userId: true } });
    const userIds = new Set(memberships.map((membership) => membership.userId));
    if (dto.classId) {
      const [teachers, enrollments] = await Promise.all([
        this.prisma.teacherAssignment.findMany({ where: { tenantId, classId: dto.classId, deletedAt: null, isActive: true }, select: { userId: true } }),
        this.prisma.studentEnrollment.findMany({ where: { tenantId, classId: dto.classId, deletedAt: null }, select: { student: { select: { userId: true } } } }),
      ]);
      teachers.forEach((teacher) => userIds.add(teacher.userId));
      enrollments.forEach((enrollment) => { if (enrollment.student.userId) userIds.add(enrollment.student.userId); });
    }
    for (const id of dto.userIds || []) { const allowed = await this.prisma.userTenantMembership.findFirst({ where: { tenantId, userId: id, deletedAt: null, isActive: true } }); if (!allowed) throw new NotFoundException('Target user is not in this tenant'); userIds.add(id); }
    return [...userIds];
  }
}

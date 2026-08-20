import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: { tenantId: string; userId?: string; action: string; entityType: string; entityId?: string; details?: string }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        details: event.details,
      },
    });
  }
}

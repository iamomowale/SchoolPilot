import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PermissionKeys, PermissionKey } from './permissions';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(userId: string, tenantId: string): Promise<Set<PermissionKey>> {
    const memberships = await this.prisma.userTenantMembership.findMany({
      where: { userId, tenantId, deletedAt: null, isActive: true },
      include: {
        userRoles: {
          where: { deletedAt: null, isActive: true },
          include: { role: { include: { permissions: { where: { deletedAt: null }, include: { permission: true } } } } },
        },
      },
    });

    const permissions = new Set<PermissionKey>();
    for (const membership of memberships) {
      for (const userRole of membership.userRoles) {
        for (const rolePermission of userRole.role.permissions) {
          permissions.add(rolePermission.permission.key as PermissionKey);
        }
      }
    }

    return permissions;
  }

  async canAccessTenant(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.userTenantMembership.findFirst({
      where: { userId, tenantId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return Boolean(membership);
  }

  async hasPermission(userId: string, tenantId: string, permission: PermissionKey): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions.has(permission);
  }

  async isSchoolAdmin(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.userTenantMembership.findFirst({
      where: { userId, tenantId, deletedAt: null, isActive: true },
      include: { userRoles: { where: { deletedAt: null, isActive: true }, include: { role: true } } },
    });
    return Boolean(membership?.userRoles.some((userRole) => ['School Admin', 'Super Admin'].includes(userRole.role.name)));
  }

  async assertTenantAccess(userId: string, tenantId: string): Promise<void> {
    const canAccess = await this.canAccessTenant(userId, tenantId);
    if (!canAccess) {
      throw new Error('Tenant access denied');
    }
  }

  async assertPermission(userId: string, tenantId: string, permission: PermissionKey): Promise<void> {
    const hasPermission = await this.hasPermission(userId, tenantId, permission);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }
  }

  getDefaultRoleMappings() {
    return {
      'Super Admin': [PermissionKeys.SUPER_ADMIN, PermissionKeys.TENANT_MANAGE, PermissionKeys.USER_MANAGE, PermissionKeys.ROLE_MANAGE, PermissionKeys.PERMISSION_MANAGE, PermissionKeys.ACADEMIC_MANAGE, PermissionKeys.FINANCE_MANAGE, PermissionKeys.ATTENDANCE_MANAGE, PermissionKeys.REPORT_VIEW, PermissionKeys.ANNOUNCEMENT_MANAGE],
      'School Admin': [PermissionKeys.TENANT_MANAGE, PermissionKeys.USER_MANAGE, PermissionKeys.ROLE_MANAGE, PermissionKeys.ACADEMIC_MANAGE, PermissionKeys.FINANCE_MANAGE, PermissionKeys.ATTENDANCE_MANAGE, PermissionKeys.REPORT_VIEW, PermissionKeys.ANNOUNCEMENT_MANAGE],
      Teacher: [PermissionKeys.ACADEMIC_MANAGE, PermissionKeys.ATTENDANCE_MANAGE, PermissionKeys.REPORT_VIEW],
      Bursar: [PermissionKeys.FINANCE_MANAGE, PermissionKeys.REPORT_VIEW],
      Parent: [PermissionKeys.REPORT_VIEW],
      Student: [PermissionKeys.REPORT_VIEW],
    };
  }
}

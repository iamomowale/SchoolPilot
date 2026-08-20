export const PermissionKeys = {
  SUPER_ADMIN: 'super.admin',
  TENANT_MANAGE: 'tenant.manage',
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
  PERMISSION_MANAGE: 'permission.manage',
  ACADEMIC_MANAGE: 'academic.manage',
  FINANCE_MANAGE: 'finance.manage',
  ATTENDANCE_MANAGE: 'attendance.manage',
  REPORT_VIEW: 'report.view',
  ANNOUNCEMENT_MANAGE: 'announcement.manage',
} as const;

export type PermissionKey = (typeof PermissionKeys)[keyof typeof PermissionKeys];

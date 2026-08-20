import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'schoolpilot-dev' },
    update: {},
    create: {
      slug: 'schoolpilot-dev',
      name: 'SchoolPilot Development',
      domain: 'localhost',
    },
  });

  const roleDefinitions = [
    { name: 'Super Admin', description: 'Full system access for the development tenant' },
    { name: 'School Admin', description: 'Administrative access for the school' },
    { name: 'Teacher', description: 'Instructional staff access' },
    { name: 'Bursar', description: 'Financial operations access' },
    { name: 'Parent', description: 'Parent portal access' },
    { name: 'Student', description: 'Student portal access' },
  ];

  const roles = await Promise.all(roleDefinitions.map((definition) => prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: definition.name } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: definition.name,
      description: definition.description,
    },
  })));

  const permissionKeys = [
    'super.admin',
    'tenant.manage',
    'user.manage',
    'role.manage',
    'permission.manage',
    'academic.manage',
    'finance.manage',
    'attendance.manage',
    'report.view',
    'announcement.manage',
  ];

  const permissions = await Promise.all(permissionKeys.map((key) => prisma.permission.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key } },
    update: {},
    create: {
      tenantId: tenant.id,
      key,
      description: key,
    },
  })));

  const permissionLookup = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const roleLookup = new Map(roles.map((role) => [role.name, role.id]));

  const mappings = {
    'Super Admin': ['super.admin', 'tenant.manage', 'user.manage', 'role.manage', 'permission.manage', 'academic.manage', 'finance.manage', 'attendance.manage', 'report.view', 'announcement.manage'],
    'School Admin': ['tenant.manage', 'user.manage', 'role.manage', 'academic.manage', 'finance.manage', 'attendance.manage', 'report.view', 'announcement.manage'],
    Teacher: ['academic.manage', 'attendance.manage', 'report.view'],
    Bursar: ['finance.manage', 'report.view'],
    Parent: ['report.view'],
    Student: ['report.view'],
  };

  for (const [roleName, permissionNames] of Object.entries(mappings)) {
    const roleId = roleLookup.get(roleName);
    if (!roleId) continue;
    for (const permissionName of permissionNames) {
      const permissionId = permissionLookup.get(permissionName);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const administrator = await prisma.user.upsert({
    where: { email: 'admin@schoolpilot.local' },
    update: {},
    create: {
      email: 'admin@schoolpilot.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
    },
  });

  let membership = await prisma.userTenantMembership.findFirst({
    where: {
      tenantId: tenant.id,
      userId: administrator.id,
    },
  });

  if (!membership) {
    membership = await prisma.userTenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: administrator.id,
        isActive: true,
      },
    });
  }

  const superAdminRoleId = roleLookup.get('Super Admin');
  if (superAdminRoleId) {
    await prisma.userRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: superAdminRoleId } },
      update: {},
      create: {
        membershipId: membership.id,
        roleId: superAdminRoleId,
        userId: administrator.id,
      },
    });
  }

  console.info('\nLocal web context (copy these values into apps/web/.env.local):');
  console.info(`NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`);
  console.info(`NEXT_PUBLIC_TENANT_ID=${tenant.id}`);
  console.info(`NEXT_PUBLIC_USER_ID=${administrator.id}`);
  console.info('NEXT_PUBLIC_USER_ROLE=school-admin\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

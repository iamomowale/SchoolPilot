import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';
import { TenantGuard } from './tenant.guard';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    AuditService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [AuthorizationService, AuditService],
})
export class AuthorizationModule {}

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from './authorization.service';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionKey } from './permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authorizationService: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionKey>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { id: string }; params?: { tenantId?: string } }>();
    const tenantId = request.headers['x-tenant-id'] ?? request.params?.tenantId;
    const userId = request.user?.id ?? request.headers['x-user-id'];

    if (!tenantId || !userId) {
      throw new ForbiddenException({ success: false, error: { code: 'AUTHORIZATION_REQUIRED', message: 'Missing tenant or user context' } });
    }

    const hasPermission = await this.authorizationService.hasPermission(userId, tenantId, requiredPermission);
    if (!hasPermission) {
      throw new ForbiddenException({ success: false, error: { code: 'PERMISSION_DENIED', message: 'You do not have access to this action' } });
    }

    return true;
  }
}

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { id: string }; params?: { tenantId?: string } }>();
    const tenantId = request.headers['x-tenant-id'] ?? request.params?.tenantId;
    const userId = request.user?.id ?? request.headers['x-user-id'];

    if (!tenantId || !userId) {
      throw new ForbiddenException({ success: false, error: { code: 'AUTHORIZATION_REQUIRED', message: 'Missing tenant or user context' } });
    }

    const canAccess = await this.authorizationService.canAccessTenant(userId, tenantId);
    if (!canAccess) {
      throw new ForbiddenException({ success: false, error: { code: 'TENANT_ACCESS_DENIED', message: 'You do not belong to this tenant' } });
    }

    return true;
  }
}

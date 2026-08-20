import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from './permissions';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission);

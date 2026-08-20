import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from './require-permission.decorator';
import { PermissionKeys } from './permissions';
import { TenantGuard } from './tenant.guard';
import { PermissionGuard } from './permission.guard';

@ApiTags('authorization')
@Controller('authorization')
@UseGuards(TenantGuard, PermissionGuard)
export class AuthorizationController {
  @Post('check')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiOperation({ summary: 'Check tenant and permission access' })
  @ApiResponse({ status: 200, description: 'Access granted' })
  check(@Body() body: { tenantId: string }) {
    return { success: true, data: { tenantId: body.tenantId, allowed: true } };
  }
}

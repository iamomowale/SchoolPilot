import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return { success: true, data: tokens };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({ status: 200, description: 'Returns a new token pair' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto);
    return { success: true, data: tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token and logout the current user' })
  @ApiResponse({ status: 200, description: 'Logout completed' })
  async logout(@Req() req: Request, @Body() body: { refreshToken?: string }) {
    const refreshToken = body.refreshToken ?? (req.headers['x-refresh-token'] as string | undefined);
    if (refreshToken) {
      const userId = req.headers['x-user-id'] as string | undefined;
      if (!userId) throw new ForbiddenException('Missing user context');
      await this.authService.logout(userId, refreshToken);
    }
    return { success: true, data: { revoked: true } };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email requested' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { success: true, data: { message: 'If an account exists, a reset link has been sent.' } };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset completed' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { success: true, data: { message: 'Password reset completed.' } };
  }
}

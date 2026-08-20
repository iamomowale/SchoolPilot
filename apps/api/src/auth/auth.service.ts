import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenPair } from './auth.types';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
    }

    return this.issueTokens(user.id);
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    const tokenRecord = await this.prisma.refreshToken.findFirst({ where: { token: dto.refreshToken, revokedAt: null } });
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({ success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' } });
    }

    const user = await this.prisma.user.findUnique({ where: { id: tokenRecord.userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({ success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' } });
    }

    await this.revokeRefreshToken(tokenRecord.id);
    return this.issueTokens(user.id);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenRecord = await this.prisma.refreshToken.findFirst({ where: { token: refreshToken, userId, revokedAt: null } });
    if (tokenRecord) {
      await this.revokeRefreshToken(tokenRecord.id);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user && !user.deletedAt) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });
      await this.sendPasswordResetEmail(user.email, token);
    }

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({ where: { token: dto.token } });
    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' } });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: tokenRecord.userId }, data: { passwordHash: hashedPassword } }),
      this.prisma.passwordResetToken.update({ where: { id: tokenRecord.id }, data: { revokedAt: new Date() } }),
    ]);

    return { success: true };
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = this.createSignedToken(userId, 60 * 15);
    const refreshTokenValue = crypto.randomBytes(32).toString('hex');
    const refreshTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenValue,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 60 * 15,
    };
  }

  private createSignedToken(userId: string, expiresInSeconds: number): string {
    const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const safeToken = token.slice(0, 8);
    // Development-safe adapter: log only a safe preview of the reset token.
    console.info(`[dev-mail] password reset requested for ${email}; token preview=${safeToken}`);
  }
}

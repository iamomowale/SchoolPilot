export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PasswordResetTokenPayload {
  sub: string;
  purpose: 'password-reset';
  exp: number;
}

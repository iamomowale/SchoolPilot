import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('returns a success envelope for login', async () => {
    authService.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });

    const result = await controller.login({ email: 'a@b.com', password: 'password123' });

    expect(result.success).toBe(true);
    expect(result.data.accessToken).toBe('a');
  });
});

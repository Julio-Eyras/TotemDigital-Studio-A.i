/**
 * Auth Routes Tests - Smart Signage v2.1
 * Testes de integração para rotas de autenticação
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth';

describe('Auth Routes', () => {
  let app: express.Application;
  let mockAuthService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Criar app Express
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Mock do AuthService
    mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      refreshToken: jest.fn(),
      getMe: jest.fn(),
    };

    (global as any).authServiceInstance = mockAuthService;
  });

  describe('POST /api/auth/login', () => {
    it('deve fazer login com credenciais válidas', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        token: 'test-jwt-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 1,
          username: 'testuser',
          role: 'admin',
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBe('test-jwt-token');
      expect(response.body.user.username).toBe('testuser');
      expect(mockAuthService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
    });

    it('deve retornar erro 400 com credenciais inválidas', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Credenciais inválidas',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Credenciais inválidas');
    });

    it('deve retornar erro 400 se dados estiverem faltando', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          // password faltando
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('deve solicitar recuperação de senha com email válido', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });

    it('deve retornar erro 400 se email for inválido', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('deve redefinir senha com token válido', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        success: true,
        message: 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token-64-characters-long-string-12345678901234567890',
          password: 'newpassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Senha redefinida com sucesso');
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token-64-characters-long-string-12345678901234567890',
        'newpassword123'
      );
    });

    it('deve retornar erro 400 se token for inválido', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        success: false,
        message: 'Token inválido ou expirado. Solicite uma nova recuperação de senha.',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos');
    });

    it('deve retornar erro 400 se senha for muito curta', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token-64-characters-long-string-12345678901234567890',
          password: '123', // Senha muito curta
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos');
    });
  });

  describe('POST /api/auth/register', () => {
    it('deve registrar novo usuário com dados válidos', async () => {
      mockAuthService.register.mockResolvedValue({
        success: true,
        token: 'test-jwt-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 1,
          username: 'newuser',
          role: 'operator',
        },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          role: 'operator',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.username).toBe('newuser');
      expect(mockAuthService.register).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        role: 'operator',
      });
    });

    it('deve retornar erro 400 se dados estiverem faltando', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          // email e password faltando
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos');
    });
  });
});


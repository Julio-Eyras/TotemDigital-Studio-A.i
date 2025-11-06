/**
 * Email Service Tests - Smart Signage v2.1
 * Testes unitários para EmailService
 */

import { EmailService } from '../../services/emailService';
import nodemailer from 'nodemailer';

// Mock do Nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock do transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Resetar variáveis de ambiente
    process.env.EMAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'test-password';
    process.env.SMTP_FROM = 'Test <test@example.com>';
    process.env.FRONTEND_URL = 'http://localhost:3001';
    process.env.NODE_ENV = 'test';

    emailService = new EmailService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('deve enviar email quando serviço está habilitado', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
          text: 'Test Text',
        })
      );
    });

    it('deve retornar erro quando serviço não está habilitado', async () => {
      process.env.EMAIL_ENABLED = 'false';
      process.env.SMTP_USER = '';
      process.env.SMTP_PASS = '';

      emailService = new EmailService();

      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('não está habilitado');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('deve lidar com erro de envio', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('deve enviar email de recuperação de senha', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-123',
        'testuser'
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toContain('Recuperação de Senha');
      expect(callArgs.html).toContain('testuser');
      expect(callArgs.html).toContain('reset-token-123');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('deve enviar email de boas-vindas', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await emailService.sendWelcomeEmail(
        'user@example.com',
        'testuser',
        'temp-password'
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toContain('Bem-vindo');
      expect(callArgs.html).toContain('testuser');
      expect(callArgs.html).toContain('temp-password');
    });
  });

  describe('sendNotificationEmail', () => {
    it('deve enviar email de notificação', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        {
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'info',
        }
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toContain('Test Notification');
      expect(callArgs.html).toContain('This is a test notification');
    });
  });

  describe('testConnection', () => {
    it('deve retornar true quando conexão é bem-sucedida', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await emailService.testConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('deve retornar false quando conexão falha', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await emailService.testConnection();

      expect(result).toBe(false);
    });
  });
});


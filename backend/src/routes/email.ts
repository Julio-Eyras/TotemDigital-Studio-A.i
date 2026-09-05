/**
 * Email Routes - Smart Signage v2.1
 * Rotas para testar e gerenciar envio de emails
 */

import { Router } from 'express';
import express from 'express';

import { body, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { emailService } from '../services/emailService';
import { logError, sanitizeForLogging } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de validação
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/email/status
 * @desc Verifica status do Email Service
 * @access Private (Admin)
 */
router.get('/status', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const isEnabled = emailService.isServiceEnabled();
    const isConnected = await emailService.testConnection();

    return res.json({
      success: true,
      data: {
        enabled: isEnabled,
        connected: isConnected,
        configured: isEnabled && isConnected
      }
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao verificar status do email', e.error, { route: '/api/email/status' });
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: e.message
  });
  }
});

/**
 * @route POST /api/email/test
 * @desc Envia email de teste
 * @access Private (Admin)
 */
router.post('/test',
  authorizeRole(['admin']),
  body('to').notEmpty().isEmail().withMessage('Email de destino é obrigatório e deve ser válido'),
  body('subject').optional({ nullable: true }).isString(),
  body('message').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { to, subject, message } = req.body;

      const result = await emailService.sendEmail({
        to,
        subject: subject || 'Teste de Email - Smart Signage Pro',
        html: message || `
          <h1>Teste de Email</h1>
          <p>Este é um email de teste do Smart Signage Pro.</p>
          <p>Se você recebeu este email, o sistema de envio está funcionando corretamente.</p>
          <p><strong>Enviado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        `,
        text: message || 'Este é um email de teste do Smart Signage Pro. Se você recebeu este email, o sistema de envio está funcionando corretamente.'
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Erro ao enviar email',
          message: result.error
        });
      }

      return res.json({
        success: true,
        message: 'Email de teste enviado com sucesso',
        data: {
          messageId: result.messageId
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      // Sanitizar dados antes de logar (email pode ser considerado sensível)
      const sanitizedBody = req.body ? sanitizeForLogging(req.body) : null;
      await logError('Erro ao enviar email de teste', e.error, { route: '/api/email/test', to: sanitizedBody?.to });
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: e.message
    });
    }
  }
);

export default router;


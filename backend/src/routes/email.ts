/**
 * Email Routes - Smart Signage v2.1
 * Rotas para testar e gerenciar envio de emails
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { emailService } from '../services/emailService';

const router = Router();

// Middleware de validação
const validateRequest = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/email/status
 * @desc Verifica status do Email Service
 * @access Private (Admin)
 */
router.get('/status', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const isEnabled = emailService.isServiceEnabled();
    const isConnected = await emailService.testConnection();

    res.json({
      success: true,
      data: {
        enabled: isEnabled,
        connected: isConnected,
        configured: isEnabled && isConnected
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao verificar status do email:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
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
  body('subject').optional().isString(),
  body('message').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
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

      res.json({
        success: true,
        message: 'Email de teste enviado com sucesso',
        data: {
          messageId: result.messageId
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao enviar email de teste:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
);

export default router;


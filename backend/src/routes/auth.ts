/**
 * Auth Routes - Smart Signage v2.0
 * Rotas de autenticação
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/authService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logInfo, logWarn, logError, sanitizeForLogging } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization - só criar quando necessário
function getAuthService(): AuthService {
  if (!(global as any).authServiceInstance) {
    (global as any).authServiceInstance = new AuthService();
  }
  return (global as any).authServiceInstance;
}

// =============================================
// VALIDATORS
// =============================================

const loginValidator = [
  body('username')
    .notEmpty()
    .withMessage('Nome de usuário é obrigatório')
    .isLength({ min: 3, max: 50 })
    .withMessage('Nome de usuário deve ter entre 3 e 50 caracteres'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
];

const registerValidator = [
  body('username')
    .notEmpty()
    .withMessage('Nome de usuário é obrigatório')
    .isLength({ min: 3, max: 50 })
    .withMessage('Nome de usuário deve ter entre 3 e 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Nome de usuário deve conter apenas letras, números e underscore'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email deve ser válido'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'operator', 'viewer', 'client'])
    .withMessage('Role deve ser válida'),
  body('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID deve ser um número inteiro positivo')
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .notEmpty()
    .withMessage('Nova senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
];

const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token é obrigatório')
];

const abandonPinValidator = [
  body('pin')
    .notEmpty()
    .withMessage('PIN é obrigatório')
    .isLength({ min: 4, max: 6 })
    .withMessage('PIN deve ter entre 4 e 6 dígitos')
    .isNumeric()
    .withMessage('PIN deve conter apenas números')
];

const forgotPasswordValidator = [
  body('email')
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email deve ser válido')
];

const resetPasswordValidator = [
  body('token')
    .notEmpty()
    .withMessage('Token é obrigatório')
    .isLength({ min: 64 })
    .withMessage('Token inválido'),
  body('password')
    .notEmpty()
    .withMessage('Nova senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
];

// =============================================
// ROUTES
// =============================================

/**
 * POST /api/auth/login
 * Autentica usuário
 */
router.post('/login', loginValidator, async (req: Request, res: Response) => {
  const username = req.body?.username;
  try {
    await logInfo('[Auth] POST /api/auth/login - Recebendo requisição', {
      username,
      ip: req.ip
    });

    await logInfo('[Auth] Payload recebido em /login', {
      username,
      hasPassword: Boolean(req.body?.password)
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await logWarn('[Auth] Erros de validação em /login', {
        username,
        errors: errors.array()
      });
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    await logInfo('[Auth] Chamando AuthService.login()', { username });
    const result = await getAuthService().login(req.body);
    await logInfo('[Auth] Resultado do login', {
      username,
      success: result.success
    });
    
    if (!result.success) {
      return res.status(401).json({
        error: result.error
      });
    }

    await logInfo('[Auth] Login bem-sucedido - retornando tokens', {
      username,
      userId: result.user?.id
    });
    res.json({
      message: 'Login realizado com sucesso',
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user
    });

  } catch (error: any) {
    await logError('Erro no endpoint /login', error, { username });
    res.status(500).json({
      error: `Erro interno do servidor: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/auth/register
 * Registra novo usuário
 */
router.post('/register', registerValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const result = await getAuthService().register(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user
    });

  } catch (error: any) {
    // Sanitizar dados antes de logar
    const sanitizedBody = req.body ? sanitizeForLogging(req.body) : null;
    await logError('Erro no registro', error, { username: sanitizedBody?.username });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Atualiza token de acesso
 */
router.post('/refresh', refreshTokenValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const result = await getAuthService().refreshToken(req.body.refreshToken);
    
    if (!result.success) {
      return res.status(401).json({
        error: result.error
      });
    }

    res.json({
      message: 'Token atualizado com sucesso',
      token: result.token,
      user: result.user
    });

  } catch (error: any) {
    await logError('Erro no refresh token', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado
 */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await getAuthService().getMe(req.user!.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    res.json({
      user
    });

  } catch (error: any) {
    await logError('Erro ao buscar dados do usuário autenticado', error, { userId: req.user?.id });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Altera senha do usuário
 */
router.post('/change-password', authMiddleware, changePasswordValidator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const result = await getAuthService().changePassword(req.user!.id, req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.json({
      message: 'Senha alterada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao alterar senha', error, { userId: req.user?.id });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout do usuário
 */
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getAuthService().logout(req.user!.id);
    
    if (!result.success) {
      return res.status(500).json({
        error: result.error
      });
    }

    res.json({
      message: 'Logout realizado com sucesso'
    });

  } catch (error: any) {
    await logError('Erro no logout', error, { userId: req.user?.id });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/verify-abandon-pin
 * Verifica PIN de abandono do player
 */
router.post('/verify-abandon-pin', abandonPinValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const isValid = await getAuthService().verifyAbandonPin(req.body.pin);
    
    if (!isValid) {
      return res.status(401).json({
        error: 'PIN incorreto'
      });
    }

    res.json({
      message: 'PIN verificado com sucesso',
      valid: true
    });

  } catch (error: any) {
    await logError('Erro na verificação do PIN de abandono', error, {
      hasPin: Boolean(req.body?.pin)
    });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/auth/default-credentials
 * Retorna credenciais padrão para primeira execução
 */
router.get('/default-credentials', async (_req: Request, res: Response) => {
  try {
    // Verificar se é primeira execução (sem usuários)
    const { getDatabase } = await import('../config/database');
    const db = getDatabase();
    
    const userCount = await db.findFirst(`
      SELECT COUNT(*) as count FROM users
    `);

    const isFirstRun = userCount.count === 0;

    res.json({
      isFirstRun,
      defaultCredentials: isFirstRun ? {
        username: 'admin',
        password: 'admin',
        message: 'Use estas credenciais para o primeiro acesso. Altere imediatamente após o login.'
      } : null
    });

  } catch (error: any) {
    await logError('Erro ao verificar credenciais padrão', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicita recuperação de senha
 */
router.post('/forgot-password', forgotPasswordValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { email } = req.body;
    const result = await getAuthService().forgotPassword(email);

    if (!result.success) {
      return res.status(400).json({
        error: result.message
      });
    }

    // Retornar resposta genérica por segurança (mesmo se email não existir)
    res.json({
      success: true,
      message: result.message,
      // Em desenvolvimento, retornar token para facilitar testes
      ...(process.env.NODE_ENV === 'development' && result.token ? { token: result.token } : {})
    });

  } catch (error: any) {
    // Sanitizar dados antes de logar (email pode ser considerado sensível)
    const sanitizedBody = req.body ? sanitizeForLogging(req.body) : null;
    await logError('Erro ao solicitar recuperação de senha', error, { email: sanitizedBody?.email });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Redefine senha usando token
 */
router.post('/reset-password', resetPasswordValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { token, password } = req.body;
    const result = await getAuthService().resetPassword(token, password);

    if (!result.success) {
      return res.status(400).json({
        error: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error: any) {
    await logError('Erro ao redefinir senha', error, {
      tokenLength: req.body?.token ? String(req.body.token).length : 0
    });
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

export default router;

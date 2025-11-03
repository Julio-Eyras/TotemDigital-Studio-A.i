import express, { Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { TotemService } from '../services/totemService';
import crypto from 'crypto';

const router = express.Router();

// Chave secreta para validação de totem (deve estar no .env em produção)
const TOTEM_SECRET_KEY = process.env.TOTEM_SECRET_KEY || 'smart-signage-totem-secret-key-2025-change-in-production';

/**
 * Gerar token de validação para totem
 */
function generateTotemToken(uin: string): string {
  const timestamp = Date.now();
  const data = `${uin}:${timestamp}`;
  const token = crypto
    .createHmac('sha256', TOTEM_SECRET_KEY)
    .update(data)
    .digest('hex');
  return `${timestamp}:${token}`;
}

/**
 * Validar token de totem
 */
function validateTotemToken(uin: string, token: string, maxAge: number = 3600000): boolean {
  try {
    const [timestamp, receivedToken] = token.split(':');
    if (!timestamp || !receivedToken) return false;

    const age = Date.now() - parseInt(timestamp);
    if (age > maxAge || age < 0) return false; // Token expirado ou inválido

    const expectedToken = crypto
      .createHmac('sha256', TOTEM_SECRET_KEY)
      .update(`${uin}:${timestamp}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedToken),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * @route GET /player/validate
 * @desc Validar totem por UIN e token
 * @access Public (mas requer validação)
 */
router.get('/validate',
  query('uin').isString().isLength({ min: 10, max: 50 }),
  query('token').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
      }

      const { uin, token } = req.query;

      // Validar token se fornecido
      if (token && typeof token === 'string') {
        if (!validateTotemToken(uin as string, token)) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(uin as string);

      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      if (!totem.active) {
        return res.status(403).json({ error: 'Totem inativo' });
      }

      // Gerar novo token para resposta
      const newToken = generateTotemToken(uin as string);

      res.json({
        valid: true,
        totem: {
          id: (totem as any).id,
          uin: uin,
          name: (totem as any).name || (totem as any).identifier,
          location: (totem as any).location || (totem as any).description,
          clientId: (totem as any).clientId,
          clientName: (totem as any).clientName,
        },
        token: newToken,
        expiresIn: 3600, // 1 hora
      });
    } catch (error: any) {
      console.error('❌ Erro ao validar totem:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /player/token
 * @desc Gerar token de validação para totem
 * @access Public
 */
router.get('/token',
  query('uin').isString().isLength({ min: 10, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'UIN inválido', details: errors.array() });
      }

      const { uin } = req.query;
      const token = generateTotemToken(uin as string);

      res.json({
        token,
        expiresIn: 3600, // 1 hora
      });
    } catch (error: any) {
      console.error('❌ Erro ao gerar token:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;


/**
 * Facial Recognition Routes - Smart Signage Pro v2.1
 * Rotas para reconhecimento facial
 */

import { Router, Response } from 'express';
import { getFacialRecognitionService } from '../services/facialRecognitionService';
import { AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Aplicar bloqueio de dados de clientes para OPERATOR (exceto rotas públicas de players)
router.use((req: AuthenticatedRequest, res, next) => {
  // Permitir rotas públicas de players (sem autenticação)
  if (req.path.includes('/match') && !req.headers.authorization) {
    return next();
  }
  return blockClientDataAccess(req as AuthenticatedRequest, res, next);
});

/**
 * @route POST /api/facial-recognition/match
 * @desc Faz match de características faciais (público para players)
 */
router.post('/match',
  body('features').notEmpty().withMessage('features é obrigatório'),
  body('totemId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { features, totemId } = req.body;
      const facialService = getFacialRecognitionService();
      const match = await facialService.matchFace({ features, totemId });

      if (match) {
        // Registrar interação
        if (totemId) {
          await facialService.logInteraction({
            totemId,
            personId: match.personId,
            contentId: match.contentId || undefined,
            features,
            confidence: match.confidence
          });
        }

        res.json({
          success: true,
          data: match
        });
      } else {
        res.json({
          success: true,
          data: null,
          message: 'Nenhuma pessoa reconhecida'
        });
      }
    } catch (error: any) {
      await logError('Erro ao fazer match facial', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao fazer match facial'
      });
    }
  }
);

/**
 * @route GET /api/facial-recognition/persons
 * @desc Lista pessoas reconhecidas
 * @access Private (Admin, Manager)
 */
router.get('/persons',
  query('isActive').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { isActive, limit } = req.query;
      const facialService = getFacialRecognitionService();
      const persons = await facialService.getAllPersons({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        data: persons
      });
    } catch (error: any) {
      await logError('Erro ao listar pessoas', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar pessoas'
      });
    }
  }
);

/**
 * @route POST /api/facial-recognition/persons
 * @desc Cria ou atualiza pessoa reconhecida
 * @access Private (Admin, Manager)
 */
router.post('/persons',
  body('personId').notEmpty().withMessage('personId é obrigatório'),
  body('name').optional().isString(),
  body('features').optional(),
  body('contentId').optional().isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { personId, name, features, contentId } = req.body;
      const facialService = getFacialRecognitionService();
      const person = await facialService.createOrUpdatePerson(personId, {
        name,
        features,
        contentId
      });

      res.json({
        success: true,
        message: 'Pessoa criada/atualizada com sucesso',
        data: person
      });
    } catch (error: any) {
      await logError('Erro ao criar/atualizar pessoa', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar/atualizar pessoa'
      });
    }
  }
);

export default router;


/**
 * Tags Routes - Smart Signage Pro v2.1
 * Rotas para gerenciar tags e suas associações
 */

import { Router, Response } from 'express';
import { getTagService } from '../services/tagService';
import { AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Aplicar bloqueio de dados de clientes para OPERATOR (exceto rotas públicas de players)
router.use((req: AuthenticatedRequest, res, next) => {
  // Permitir rotas públicas de players (sem autenticação)
  if (req.path.includes('/content') && !req.headers.authorization) {
    return next();
  }
  return blockClientDataAccess(req as AuthenticatedRequest, res, next);
});

/**
 * @route GET /api/tags/:tagId/content
 * @desc Obtém conteúdo associado a uma tag (público para players)
 */
router.get('/:tagId/content',
  param('tagId').notEmpty().withMessage('tagId é obrigatório'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tagId } = req.params;
      const tagService = getTagService();
      const { contentId, tag } = await tagService.getContentForTag(tagId);

      if (!tag) {
        return res.status(404).json({
          success: false,
          error: 'Tag não encontrada'
        });
      }

      return res.json({
        success: true,
        data: {
          contentId: contentId,
          tag: tag ? {
            id: tag.id,
            tagId: tag.tagId,
            tagType: tag.tagType,
            name: tag.name
          } : null
        }
      });
    } catch (error: any) {
      await logError('Erro ao obter conteúdo da tag', error, { tagId: req.params.tagId });
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter conteúdo da tag'
      });
    }
  }
);

/**
 * @route GET /api/tags
 * @desc Lista todas as tags
 * @access Private (Admin, Manager)
 */
router.get('/',
  query('tagType').optional().isIn(['rfid', 'nfc', 'qr_code', 'barcode']),
  query('isActive').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  authorizeRole(['admin', 'gerente_marketing', 'editoracao']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tagType, isActive, limit } = req.query;
      const tagService = getTagService();
      const tags = await tagService.getAllTags({
        tagType: tagType as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });

      return res.json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      await logError('Erro ao listar tags', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar tags'
      });
    }
  }
);

/**
 * @route POST /api/tags
 * @desc Cria ou atualiza uma tag
 * @access Private (Admin, Manager)
 */
router.post('/',
  body('tagId').notEmpty().withMessage('tagId é obrigatório'),
  body('tagType').isIn(['rfid', 'nfc', 'qr_code', 'barcode']).withMessage('tagType inválido'),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('contentId').optional().isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'gerente_marketing', 'editoracao']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tagId, tagType, name, description, contentId } = req.body;
      const tagService = getTagService();
      const tag = await tagService.createOrUpdateTag({
        tagId,
        tagType,
        name,
        description,
        contentId
      });

      return res.json({
        success: true,
        message: 'Tag criada/atualizada com sucesso',
        data: tag
      });
    } catch (error: any) {
      await logError('Erro ao criar/atualizar tag', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar/atualizar tag'
      });
    }
  }
);

/**
 * @route DELETE /api/tags/:tagId
 * @desc Desativa uma tag
 * @access Private (Admin, Manager)
 */
router.delete('/:tagId',
  param('tagId').notEmpty().withMessage('tagId é obrigatório'),
  validateRequest,
  authorizeRole(['admin', 'gerente_marketing', 'editoracao']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tagId } = req.params;
      const tagService = getTagService();
      await tagService.deactivateTag(tagId);

      return res.json({
        success: true,
        message: 'Tag desativada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao desativar tag', error, { tagId: req.params.tagId });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao desativar tag'
      });
    }
  }
);

export default router;


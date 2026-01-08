import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getContractService } from '../services/contractService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createContractValidator = [
  body('subscriber_id').optional().isInt({ min: 1 }).withMessage('Subscriber ID inválido'),
  body('contract_number').notEmpty().withMessage('Número do contrato é obrigatório'),
  body('contract_type').isIn(['advertising', 'subscription', 'partnership']).withMessage('Tipo de contrato inválido'),
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('start_date').isISO8601().withMessage('Data de início inválida'),
  body('end_date').optional().isISO8601().withMessage('Data de término inválida'),
  body('plan_id').optional().isInt({ min: 1 }),
  body('total_amount').optional().isFloat({ min: 0 }),
  body('currency').optional().isString(),
  body('status').optional().isIn(['draft', 'active', 'expired', 'terminated', 'cancelled']),
  body('publisherIds').optional().isArray(),
  body('created_before_subscriber').optional().isBoolean(),
  // Validação customizada: se subscriber_id não fornecido, created_before_subscriber deve ser true
  body().custom((value) => {
    if (!value.subscriber_id && !value.created_before_subscriber) {
      throw new Error('Se subscriber_id não for fornecido, created_before_subscriber deve ser true');
    }
    return true;
  }),
];

const updateContractValidator = [
  body('contract_number').optional().notEmpty(),
  body('contract_type').optional().isIn(['advertising', 'subscription', 'partnership']),
  body('title').optional().notEmpty(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('plan_id').optional().isInt({ min: 1 }),
  body('total_amount').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['draft', 'active', 'expired', 'terminated', 'cancelled']),
  body('publisherIds').optional().isArray(),
];

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

/**
 * @route GET /api/contracts
 * @desc Listar todos os contratos
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('subscriberId').optional().isInt({ min: 1 }),
  query('planId').optional().isInt({ min: 1 }),
  query('status').optional().isString(),
  query('contractType').optional().isString(),
  query('activeOnly').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 20, search, subscriberId, planId, status, contractType, activeOnly } = req.query;
      
      const result = await getContractService().getAllContracts({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        subscriberId: subscriberId ? parseInt(subscriberId as string) : undefined,
        planId: planId ? parseInt(planId as string) : undefined,
        status: status as string,
        contractType: contractType as string,
        activeOnly: activeOnly === 'true',
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      await logError('Erro ao listar contratos', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/contracts/:id
 * @desc Obter contrato por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const contract = await getContractService().getContractById(parseInt(id));
      
      if (!contract) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
      }

      return res.json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao obter contrato', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/contracts/:id/publishers
 * @desc Obter publishers associados a um contrato
 */
router.get('/:id/publishers',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const publishers = await getContractService().getContractPublishers(parseInt(id));

      return res.json({ success: true, data: publishers });
    } catch (error: any) {
      await logError('Erro ao obter publishers do contrato', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/contracts
 * @desc Criar novo contrato
 */
router.post('/',
  createContractValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      const contract = await getContractService().createContract(req.body);
      return res.status(201).json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao criar contrato', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/contracts/:id
 * @desc Atualizar contrato
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  updateContractValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const contract = await getContractService().updateContract(parseInt(id), req.body);
      return res.json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao atualizar contrato', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/contracts/:id
 * @desc Excluir contrato (soft delete)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento']),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await getContractService().deleteContract(parseInt(id));
      return res.json({ success: true, message: 'Contrato excluído com sucesso' });
    } catch (error: any) {
      await logError('Erro ao excluir contrato', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;

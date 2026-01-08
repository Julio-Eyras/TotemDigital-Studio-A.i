import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { protectContractValues } from '../middleware/contractValuesProtection.middleware';
import { getContractService } from '../services/contractService';
import { getPublisherContractService } from '../services/publisherContractService';
import { logError } from '../utils/loggerHelper';
import { 
  createSubscriberContractValidators, 
  updateSubscriberContractValidators,
  createPublisherContractValidators,
  updatePublisherContractValidators,
  contractFilterValidators
} from '../validators/contract.validators';
import { paginationValidators, searchValidators, idParamValidator } from '../validators/common.validators';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações - usando validadores centralizados
const createContractValidator = createSubscriberContractValidators;
const updateContractValidator = updateSubscriberContractValidators;

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
  ...paginationValidators,
  ...searchValidators,
  ...contractFilterValidators,
  validateRequest,
  protectContractValues,
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
  ...idParamValidator,
  validateRequest,
  protectContractValues,
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
  ...idParamValidator,
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
      // Validação customizada: se subscriber_id não fornecido, created_before_subscriber deve ser true
      if (!req.body.subscriber_id && !req.body.created_before_subscriber) {
        return res.status(400).json({ 
          error: 'Se subscriber_id não for fornecido, created_before_subscriber deve ser true' 
        });
      }

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
  ...idParamValidator,
  ...updateContractValidator,
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
  ...idParamValidator,
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

// =============================================
// ROTAS PARA PUBLISHER CONTRACTS
// =============================================

/**
 * @route GET /api/publisher-contracts
 * @desc Listar todos os contratos de publishers
 */
router.get('/publisher-contracts',
  ...paginationValidators,
  ...searchValidators,
  ...contractFilterValidators,
  validateRequest,
  protectContractValues,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 20, search, publisherId, status, contractType, activeOnly } = req.query;
      
      const result = await getPublisherContractService().getAllContracts({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        publisherId: publisherId ? parseInt(publisherId as string) : undefined,
        status: status as string,
        contractType: contractType as string,
        activeOnly: activeOnly === 'true',
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      await logError('Erro ao listar publisher contracts', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/publisher-contracts/:id
 * @desc Obter publisher contract por ID
 */
router.get('/publisher-contracts/:id',
  ...idParamValidator,
  validateRequest,
  protectContractValues,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const contract = await getPublisherContractService().getContractById(parseInt(id));
      
      if (!contract) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
      }

      return res.json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao obter publisher contract', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/publisher-contracts
 * @desc Criar novo publisher contract
 */
router.post('/publisher-contracts',
  ...createPublisherContractValidators,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      // Validação customizada: se publisher_id não fornecido, created_before_publisher deve ser true
      if (!req.body.publisher_id && !req.body.created_before_publisher) {
        return res.status(400).json({ 
          error: 'Se publisher_id não for fornecido, created_before_publisher deve ser true' 
        });
      }

      const contract = await getPublisherContractService().createContract(req.body, req.user?.userId);
      return res.status(201).json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao criar publisher contract', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/publisher-contracts/:id
 * @desc Atualizar publisher contract
 */
router.put('/publisher-contracts/:id',
  ...idParamValidator,
  ...updatePublisherContractValidators,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const contract = await getPublisherContractService().updateContract(parseInt(id), req.body);
      return res.json({ success: true, data: contract });
    } catch (error: any) {
      await logError('Erro ao atualizar publisher contract', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/publisher-contracts/:id
 * @desc Excluir publisher contract (soft delete)
 */
router.delete('/publisher-contracts/:id',
  ...idParamValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento']),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await getPublisherContractService().deleteContract(parseInt(id));
      return res.json({ success: true, message: 'Contrato excluído com sucesso' });
    } catch (error: any) {
      await logError('Erro ao excluir publisher contract', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/publishers/:id/contracts
 * @desc Listar contratos de um publisher específico
 */
router.get('/publishers/:id/contracts',
  ...idParamValidator,
  validateRequest,
  protectContractValues,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const result = await getPublisherContractService().getAllContracts({
        publisherId: parseInt(id),
        page: 1,
        limit: 1000,
      });

      return res.json({ success: true, data: result.data });
    } catch (error: any) {
      await logError('Erro ao listar contratos do publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;

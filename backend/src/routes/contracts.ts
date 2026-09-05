

// Imports não utilizados removidos
import express, { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { protectContractValues } from '../middleware/contractValuesProtection.middleware';
import { getContractService } from '../services/contractService';
import { getPublisherContractService } from '../services/publisherContractService';
import { logError } from '../utils/loggerHelper';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { isAdminRole } from '../utils/tenantScope';
import { 

  createSubscriberContractValidators, 
  updateSubscriberContractValidators,
  createPublisherContractValidators,
  updatePublisherContractValidators,
  contractFilterValidators
} from '../validators/contract.validators';
import { paginationValidators, searchValidators, idParamValidatorDefault } from '../validators/common.validators';
import { normalizeError } from '../utils/errors';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações - usando validadores centralizados
const createContractValidator = createSubscriberContractValidators;
const updateContractValidator = updateSubscriberContractValidators;

const validateRequest = (req: Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
    return;
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
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

      return res.json({
        success: true, data: result });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar contratos', e.error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/contracts/:id
 * @desc Obter contrato por ID
 */
router.get('/:id(\\d+)',
  ...idParamValidatorDefault,
  validateRequest,
  protectContractValues,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      
      const contract = await getContractService().getContractById(parseInt(id, 10));

      if (!contract) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
      }

      if (!isAdminRole(req.user?.role)) {
        try {
          await assertTenantClientParamAccess(req, contract.subscriber_id);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
          if (e?.statusCode === 403) {
            return res.status(403).json({ error: e.message || 'Acesso negado' });
          }
          throw e;
        }
      }

      return res.json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter contrato', e.error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/contracts/:id/publishers
 * @desc Obter publishers associados a um contrato
 */
router.get('/:id(\\d+)/publishers',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const cid = parseInt(id, 10);

      const sid = await getContractService().getSubscriberIdForContract(cid);
      if (sid == null) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
      }

      if (!isAdminRole(req.user?.role)) {
        try {
          await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
          if (e?.statusCode === 403) {
            return res.status(403).json({ error: e.message || 'Acesso negado' });
          }
          throw e;
        }
      }

      const publishers = await getContractService().getContractPublishers(cid);

      return res.json({
        success: true, data: publishers });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter publishers do contrato', e.error);
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const contract = await getContractService().createContract(req.body);
      return res.status(201).json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar contrato', e.error);
      if (e.message === 'Número de contrato já existe') {
        return res.status(409).json({ error: e.message });
    }
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/contracts/:id
 * @desc Atualizar contrato
 */
router.put('/:id(\\d+)',
  ...idParamValidatorDefault,
  ...updateContractValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const contract = await getContractService().updateContract(parseInt(id), req.body);
      return res.json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar contrato', e.error);
      if (e.message === 'Número de contrato já existe') {
        return res.status(409).json({ error: e.message });
    }
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/contracts/:id
 * @desc Excluir contrato (soft delete)
 */
router.delete('/:id(\\d+)',
  ...idParamValidatorDefault,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento']),
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      await getContractService().deleteContract(parseInt(id));
      return res.json({
        success: true, message: 'Contrato excluído com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir contrato', e.error);
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
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

      return res.json({
        success: true, data: result });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar publisher contracts', e.error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/publisher-contracts/:id
 * @desc Obter publisher contract por ID
 */
router.get('/publisher-contracts/:id',
  ...idParamValidatorDefault,
  validateRequest,
  protectContractValues,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const contract = await getPublisherContractService().getContractById(parseInt(id, 10));

      if (!contract) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
      }

      if (!isAdminRole(req.user?.role)) {
        try {
          await assertTenantClientParamAccess(req, contract.publisher_id, {
            requestedIdIsPublisherScope: true,
          });
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
          if (e?.statusCode === 403) {
            return res.status(403).json({ error: e.message || 'Acesso negado' });
          }
          throw e;
        }
      }

      return res.json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter publisher contract', e.error);
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const contract = await getPublisherContractService().createContract(req.body, req.user?.userId);
      return res.status(201).json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar publisher contract', e.error);
      if (e.message === 'Número de contrato já existe') {
        return res.status(409).json({ error: e.message });
    }
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/publisher-contracts/:id
 * @desc Atualizar publisher contract
 */
router.put('/publisher-contracts/:id',
  ...idParamValidatorDefault,
  ...updatePublisherContractValidators,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const contract = await getPublisherContractService().updateContract(parseInt(id), req.body);
      return res.json({
        success: true, data: contract });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar publisher contract', e.error);
      if (e.message === 'Número de contrato já existe') {
        return res.status(409).json({ error: e.message });
    }
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/publisher-contracts/:id
 * @desc Excluir publisher contract (soft delete)
 */
router.delete('/publisher-contracts/:id',
  ...idParamValidatorDefault,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento']),
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      await getPublisherContractService().deleteContract(parseInt(id));
      return res.json({
        success: true, message: 'Contrato excluído com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir publisher contract', e.error);
      return res.status(500).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/publishers/:id/contracts
 * @desc Listar contratos de um publisher específico
 */
router.get('/publishers/:id/contracts',
  ...idParamValidatorDefault,
  validateRequest,
  protectContractValues,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const result = await getPublisherContractService().getAllContracts({
        publisherId: parseInt(id),
        page: 1,
        limit: 1000,
      });

      return res.json({
        success: true, data: result.data });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar contratos do publisher', e.error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;

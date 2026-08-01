import express from 'express';
import { body } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import {
  getInstallationModulesAdminView,
  saveInstallationModules,
  setMultiAgencyMode,
} from '../services/installationModulesService';
import { logError } from '../utils/loggerHelper';
import { createDatabaseWrapper } from '../config/database-pg';

const router = express.Router();

router.use(authMiddleware);

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }
  next();
};

/**
 * @route GET /api/installation/modules
 * @desc Catálogo + estado dos complementos de produto
 * @access owner_system, admin_sql
 */
router.get(
  '/modules',
  authorizeRole(['owner_system', 'admin_sql']),
  async (_req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const view = await getInstallationModulesAdminView(db);
      res.json({
        success: true,
        data: {
          catalog: view.catalog,
          modules: view.modules,
          defaults: view.defaults,
          overrides: view.overrides,
          profile: view.capabilities.profile,
          multiAgencyEnabled: view.multiAgencyEnabled,
          multiAgencyPresetIds: view.multiAgencyPresetIds,
          note:
            'Use o botão Modo multi-agência para o preset. Opções avançadas = módulos individuais. flag_smart_* = permissão por utilizador.',
          phase: 'multi_agency_master',
          enforcement: 'menu_and_api',
        },
      });
    } catch (error: any) {
      await logError('Erro ao listar módulos da instalação', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar módulos',
      });
    }
  }
);

/**
 * @route PUT /api/installation/multi-agency
 * @desc Master switch — preset atómico multi-agência ON/OFF
 * @access owner_system, admin_sql
 */
router.put(
  '/multi-agency',
  authorizeRole(['owner_system', 'admin_sql']),
  body('enabled').isBoolean().withMessage('enabled deve ser boolean'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const result = await setMultiAgencyMode(db, Boolean(req.body.enabled), req.user?.id);
      res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro ao alterar modo multi-agência', error);
      const msg = error?.message || 'Erro ao alterar modo multi-agência';
      const status = msg.includes('requer') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: msg,
      });
    }
  }
);

/**
 * @route PUT /api/installation/modules
 * @desc Actualiza complementos individuais (opções avançadas)
 * @access owner_system, admin_sql
 */
router.put(
  '/modules',
  authorizeRole(['owner_system', 'admin_sql']),
  body('modules').isObject().withMessage('modules deve ser um objeto'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const modules = await saveInstallationModules(db, req.body.modules || {}, req.user?.id);
      res.json({
        success: true,
        message:
          'Complementos guardados. O menu e a API passam a respeitar os módulos (recarregue a aplicação).',
        data: { modules },
      });
    } catch (error: any) {
      await logError('Erro ao guardar módulos da instalação', error);
      const msg = error?.message || 'Erro ao guardar módulos';
      const status = msg.includes('requer') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: msg,
      });
    }
  }
);

export default router;

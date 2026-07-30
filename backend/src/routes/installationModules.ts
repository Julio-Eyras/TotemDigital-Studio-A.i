import express from 'express';
import { body } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import {
  getInstallationModulesAdminView,
  saveInstallationModules,
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
          note:
            'Módulos controlam o produto da instalação. flag_smart_* controla permissões por utilizador.',
          phase: 'A',
          enforcement: 'persist_only',
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
 * @route PUT /api/installation/modules
 * @desc Actualiza complementos de produto (Fase A: persiste; Fase B: gates)
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
          'Complementos guardados. Na Fase A o menu/API ainda seguem o perfil actual; a Fase B aplicará os gates.',
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

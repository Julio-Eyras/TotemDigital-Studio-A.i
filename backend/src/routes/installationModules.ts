import express from 'express';
import { body } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import {
  getInstallationModulesAdminView,
  saveInstallationModules,
  setMultiAgencyMode,
  getMultiAgencyActivationChecklist,
} from '../services/installationModulesService';
import {
  getPortalSettings,
  savePortalSettings,
  listPortalHosts,
  syncPortalHosts,
  syncPortalCloudflareDns,
  issuePortalSsl,
} from '../services/portalHostService';
import { ensureDemoSecondAgencyIfNeeded } from '../services/installationModulesService';
import { buildPortalWildcardSslPlan } from '../services/portalSslService';
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
 * @route GET /api/installation/portal
 * @desc Settings + inventário de hosts por slug
 */
router.get(
  '/portal',
  authorizeRole(['owner_system', 'admin_sql']),
  async (_req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const settings = await getPortalSettings(db);
      const hosts = await listPortalHosts(db);
      res.json({
        success: true,
        data: {
          settings,
          hosts,
          sslPlan: settings.baseDomain
            ? buildPortalWildcardSslPlan({
                baseDomain: settings.baseDomain,
                email: settings.sslEmail,
              })
            : null,
          patterns: {
            publisherTenant: settings.baseDomain
              ? `{slug}.publisher.${settings.baseDomain}`
              : '{slug}.publisher.local',
            subscriberTenant: settings.baseDomain
              ? `{slug}.subscriber.${settings.baseDomain}`
              : '{slug}.subscriber.local',
            rolePublisher: settings.roleHosts.publisher,
            roleSubscriber: settings.roleHosts.subscriber,
          },
        },
      });
    } catch (error: any) {
      await logError('Erro ao listar portal hosts', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar portal' });
    }
  }
);

/**
 * @route PUT /api/installation/portal
 * @desc Actualiza portal.* (domínio, DNS, Cloudflare zone, SSL, seed)
 */
router.put(
  '/portal',
  authorizeRole(['owner_system', 'admin_sql']),
  body('baseDomain').optional().isString(),
  body('dnsMode').optional().isIn(['off', 'public_wildcard', 'local_dnsmasq']),
  body('syncEnabled').optional().isBoolean(),
  body('dnsProvider').optional().isIn(['off', 'manual', 'cloudflare']),
  body('cloudflareZoneId').optional().isString(),
  body('dnsTargetIpv4').optional().isString(),
  body('sslWildcardEnabled').optional().isBoolean(),
  body('sslEmail').optional().isString(),
  body('seedSecondAgency').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const settings = await savePortalSettings(db, {
        baseDomain: req.body.baseDomain,
        dnsMode: req.body.dnsMode,
        syncEnabled: req.body.syncEnabled,
        dnsProvider: req.body.dnsProvider,
        cloudflareZoneId: req.body.cloudflareZoneId,
        dnsTargetIpv4: req.body.dnsTargetIpv4,
        sslWildcardEnabled: req.body.sslWildcardEnabled,
        sslEmail: req.body.sslEmail,
        seedSecondAgency: req.body.seedSecondAgency,
      });
      res.json({
        success: true,
        message: 'Definições de portal guardadas',
        data: { settings },
      });
    } catch (error: any) {
      await logError('Erro ao guardar portal settings', error);
      const status = error?.message?.includes('inválido') ? 400 : 500;
      res.status(status).json({ success: false, error: error.message || 'Erro ao guardar portal' });
    }
  }
);

/**
 * @route POST /api/installation/portal/sync
 * @desc Gera snippets Nginx/dnsmasq e opcionalmente Cloudflare + script local
 */
router.post(
  '/portal/sync',
  authorizeRole(['owner_system', 'admin_sql']),
  body('dryRunDns').optional().isBoolean(),
  body('applyCloudflare').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const result = await syncPortalHosts(db, {
        dryRunDns: req.body?.dryRunDns,
        applyCloudflare: req.body?.applyCloudflare,
      });
      res.status(result.ok ? 200 : 500).json({
        success: result.ok,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro ao sincronizar portal hosts', error);
      res.status(500).json({ success: false, error: error.message || 'Erro no sync de portal' });
    }
  }
);

/**
 * @route POST /api/installation/portal/dns/cloudflare
 * @desc Sync DNS wildcards na Cloudflare (dryRun por defeito se sem token)
 */
router.post(
  '/portal/dns/cloudflare',
  authorizeRole(['owner_system', 'admin_sql']),
  body('dryRun').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const dryRun =
        req.body?.dryRun === true ||
        process.env.PORTAL_DNS_DRY_RUN === 'true';
      const result = await syncPortalCloudflareDns(db, { dryRun });
      res.status(result.ok ? 200 : 400).json({
        success: result.ok,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro Cloudflare portal DNS', error);
      res.status(500).json({ success: false, error: error.message || 'Erro Cloudflare' });
    }
  }
);

/**
 * @route POST /api/installation/portal/ssl/issue
 * @desc Emite ou simula LE wildcard DNS-01
 */
router.post(
  '/portal/ssl/issue',
  authorizeRole(['owner_system', 'admin_sql']),
  body('dryRun').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      // Por segurança: dryRun=true por defeito; dryRun=false explícito para emissão real
      const dryRun = req.body?.dryRun !== false;
      const result = await issuePortalSsl(db, { dryRun });
      res.status(result.ok ? 200 : 400).json({
        success: result.ok,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro ao emitir SSL portal', error);
      res.status(500).json({ success: false, error: error.message || 'Erro SSL portal' });
    }
  }
);

/**
 * @route POST /api/installation/portal/seed-second-agency
 * @desc Cria 2ª agência + anunciante demo (idempotente)
 */
router.post(
  '/portal/seed-second-agency',
  authorizeRole(['owner_system', 'admin_sql']),
  async (_req: any, res: any) => {
    try {
      const db = createDatabaseWrapper();
      const result = await ensureDemoSecondAgencyIfNeeded(db);
      res.json({
        success: true,
        message: result.detail,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro seed 2ª agência', error);
      res.status(500).json({ success: false, error: error.message || 'Erro no seed' });
    }
  }
);

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
      const checklist = await getMultiAgencyActivationChecklist(db);
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
          activationChecklist: checklist,
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
      const result = await saveInstallationModules(db, req.body.modules || {}, req.user?.id);
      res.json({
        success: true,
        message: result.requiresBackendRestart
          ? 'Complementos guardados. Hot-reload de workers falhou — reinicie o backend; depois recarregue a aplicação.'
          : result.workersReconciled
            ? 'Complementos guardados. Workers aplicados em runtime; recarregue a aplicação para o menu.'
            : 'Complementos guardados. O menu e a API passam a respeitar os módulos (recarregue a aplicação).',
        data: result,
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

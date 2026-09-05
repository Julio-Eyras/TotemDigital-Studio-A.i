/**
 * SmartDisplayFX Analytics Routes
 * Rotas para analytics e estatísticas avançadas de SmartDisplayFX
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */

import { Router} from 'express';
import express from 'express';

import { query, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxAnalyticsService } from '../services/fxAnalyticsService';
import { logError } from '../utils/loggerHelper';
import { isMissingTableError } from '../utils/dbErrors';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/smartdisplayfx/analytics/overview
 * @desc Obtém visão geral de analytics FX
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/overview',
  query('site_id').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { site_id, startDate, endDate } = req.query;
      
      const overview = await getFxAnalyticsService().getOverview({
        site_id: site_id as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      return res.json(overview);} catch (error: unknown) {
      const e = normalizeError(error);
      if (isMissingTableError(error)) {
        return res.json({ overview: {}, sites: [], metrics: [] });
    }
      await logError('GET /api/smartdisplayfx/analytics/overview error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao obter overview de analytics',
        message: e.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/analytics/performance
 * @desc Obtém métricas de performance detalhadas
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/performance',
  query('site_id').optional().isString(),
  query('effect_id').optional().isString(),
  query('totem_id').optional().isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { site_id, effect_id, totem_id, startDate, endDate } = req.query;
      
      const metrics = await getFxAnalyticsService().getPerformanceMetrics({
        site_id: site_id as string | undefined,
        effect_id: effect_id as string | undefined,
        totem_id: totem_id ? parseInt(totem_id as string) : undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      return res.json(metrics);} catch (error: unknown) {
      const e = normalizeError(error);
      if (isMissingTableError(error)) {
        return res.json({ metrics: [], summary: {} });
    }
      await logError('GET /api/smartdisplayfx/analytics/performance error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao obter métricas de performance',
        message: e.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/analytics/sites
 * @desc Obtém analytics por site
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/sites',
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const siteStats = await getFxAnalyticsService().getSiteAnalytics({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      return res.json({
        data: siteStats });} catch (error: unknown) {
      const e = normalizeError(error);
      if (isMissingTableError(error)) {
        return res.json({ data: [] });
    }
      await logError('GET /api/smartdisplayfx/analytics/sites error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao obter analytics por site',
        message: e.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/analytics/export/excel
 * @desc Exporta overview para Excel
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/export/excel',
  query('site_id').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { site_id, startDate, endDate } = req.query;
      
      const buffer = await getFxAnalyticsService().exportOverviewToExcel({
        site_id: site_id as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=fx-analytics-${Date.now()}.xlsx`);
      res.send(buffer);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/analytics/export/excel error', error, req.query);
      res.status(500).json({
        error: 'Erro ao exportar para Excel',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/analytics/export/pdf
 * @desc Exporta overview para PDF
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/export/pdf',
  query('site_id').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { site_id, startDate, endDate } = req.query;
      
      const buffer = await getFxAnalyticsService().exportOverviewToPDF({
        site_id: site_id as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=fx-analytics-${Date.now()}.pdf`);
      res.send(buffer);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/analytics/export/pdf error', error, req.query);
      res.status(500).json({
        error: 'Erro ao exportar para PDF',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/analytics/compare
 * @desc Compara períodos de analytics
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/compare',
  query('site_id').optional().isString(),
  query('currentStartDate').isISO8601(),
  query('currentEndDate').isISO8601(),
  query('previousStartDate').isISO8601(),
  query('previousEndDate').isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { site_id, currentStartDate, currentEndDate, previousStartDate, previousEndDate } = req.query;
      
      const comparison = await getFxAnalyticsService().comparePeriods({
        site_id: site_id as string | undefined,
        currentStartDate: currentStartDate as string,
        currentEndDate: currentEndDate as string,
        previousStartDate: previousStartDate as string,
        previousEndDate: previousEndDate as string,
      });

      res.json(comparison);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/analytics/compare error', error, req.query);
      res.status(500).json({
        error: 'Erro ao comparar períodos',
        message: e.message
    });
    }
  }
);

export default router;


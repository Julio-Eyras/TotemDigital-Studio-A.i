import { Router } from 'express';
import express from 'express';

import { param, validationResult } from 'express-validator';
import { getMenuCatalogService } from '../services/menuCatalogService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

const validate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

/**
 * Cardápio público somente leitura para animações HTML no player (preços atualizados).
 */
router.get(
  '/public-menu/:subscriberId',
  param('subscriberId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = Number(req.params?.subscriberId);
      const menuService = getMenuCatalogService();
      const [products, revision] = await Promise.all([
        menuService.listProducts(subscriberId),
        menuService.getCatalogRevision(subscriberId),
      ]);
      const data = products
        .filter((p) => p.isAvailable)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          price: p.price,
          description: p.description,
          isAvailable: p.isAvailable,
        }));
      res.setHeader('Cache-Control', 'no-cache, max-age=0');
      return res.json({
        success: true,
        data,
        meta: {
          catalogRevision: revision.revision,
          refreshSeconds: menuService.getLiveRefreshSeconds(),
          productCount: revision.productCount,
        },
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao carregar cardápio público', e.error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar cardápio' });
    }
  }
);

export default router;

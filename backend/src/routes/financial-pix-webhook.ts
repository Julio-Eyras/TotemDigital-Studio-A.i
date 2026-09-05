/**
 * Webhook PIX público (sem JWT) — montar sem authMiddleware.
 */

import { Router, Response } from 'express';

import { body } from 'express-validator';
import { financialConfig } from '../config/env';
import { getFinancialAdminService } from '../services/financialAdminService';
import { normalizeError } from '../utils/errors';

const router = Router();

router.post(
  '/pix-webhook',
  body('billingId').optional().isInt({ min: 1 }),
  body('publisherBillingId').optional().isInt({ min: 1 }),
  body('scope').optional().isIn(['subscriber', 'publisher']),
  body('txid').optional().isString(),
  async (req, res: Response) => {
    const secret = req.header('x-financial-webhook-secret') || req.header('X-Financial-Webhook-Secret');
    if (!financialConfig.pixWebhookSecret || secret !== financialConfig.pixWebhookSecret) {
      return res.status(401).json({ success: false, message: 'Webhook não autorizado' });
    }
    try {
      const result = await getFinancialAdminService().processPixWebhook(req.body);
      return res.json({
        success: true, data: result });} catch (error: unknown) {
      const e = normalizeError(error);
      return res.status(400).json({ success: false, message: e.message });
    }
  }
);

export default router;

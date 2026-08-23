/**
 * Lab ACE 0.1 — ingestão de audience.context.
 * Opt-in por totem (capabilities.ace_enabled). Default off.
 * Não altera Player-AD.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { isStudioRuntime } from '../config/installationRuntime';
import { logError } from '../utils/loggerHelper';
import { aceGatewayDecide } from '../services/ace/aceGateway';
import { getAceHintStore } from '../services/ace/aceHintStore';
import { parseAnonymousInteraction } from '../services/ace/aceInteraction';
import { listAceAudit, recordAceAudit } from '../services/ace/aceAudit';
import { isAceEnabledInCapabilities } from '../services/ace/aceRuleEngine';
import { AudienceContext } from '../services/ace/aceTypes';

const router = Router();

router.use(authMiddleware);

const ACE_LAB_ROLES = isStudioRuntime()
  ? (['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'publisher_user'] as const)
  : (['admin', 'admin_sql', 'owner_system', 'operador_tecnico'] as const);

router.use(authorizeRole([...ACE_LAB_ROLES]) as any);

function asContext(body: Record<string, unknown>): AudienceContext {
  return body as unknown as AudienceContext;
}

router.post('/context', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const decision = aceGatewayDecide(body, { aceEnabled: true });
    if (decision.status !== 'accepted') {
      recordAceAudit({
        source: 'refuse',
        totemId: Number(body.totem_id) || null,
        code: decision.code,
        errors: decision.errors,
      });
      return res.status(422).json({
        success: false,
        code: decision.code,
        errors: decision.errors,
      });
    }

    const ctx = asContext(decision.payload);
    const hint = getAceHintStore().put(ctx);
    recordAceAudit({
      source: 'context',
      totemId: ctx.totem_id,
      code: hint ? 'HINT_APPLIED' : 'NO_HINT',
      hint,
      context: ctx,
    });
    return res.status(202).json({
      success: true,
      totem_id: ctx.totem_id,
      hint,
    });
  } catch (error: any) {
    await logError('[lab-ace] POST /context', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/interaction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const parsed = parseAnonymousInteraction(body);
    if (parsed.status !== 'accepted' || !parsed.totemId || !parsed.interaction) {
      recordAceAudit({
        source: 'refuse',
        totemId: Number(body.totem_id) || null,
        code: parsed.code,
        errors: parsed.errors,
      });
      return res.status(422).json({
        success: false,
        code: parsed.code,
        errors: parsed.errors,
      });
    }
    const siteId = typeof body.site_id === 'string' ? body.site_id : undefined;
    const hint = getAceHintStore().mergeInteraction(parsed.totemId, parsed.interaction, siteId);
    const stored = getAceHintStore().get(parsed.totemId);
    recordAceAudit({
      source: 'interaction',
      totemId: parsed.totemId,
      code: hint ? 'HINT_APPLIED' : 'NO_HINT',
      hint,
      context: stored?.context ?? null,
    });
    return res.status(202).json({
      success: true,
      totem_id: parsed.totemId,
      interaction: parsed.interaction,
      hint,
    });
  } catch (error: any) {
    await logError('[lab-ace] POST /interaction', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/hint/:totemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totemId = Number(req.params.totemId);
    if (!Number.isFinite(totemId) || totemId < 1) {
      return res.status(400).json({ success: false, error: 'totemId inválido' });
    }
    const audit = getAceHintStore().audit(totemId, true);
    return res.json({ success: true, totem_id: totemId, ...audit });
  } catch (error: any) {
    await logError('[lab-ace] GET /hint', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit/:totemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totemId = Number(req.params.totemId);
    if (!Number.isFinite(totemId) || totemId < 1) {
      return res.status(400).json({ success: false, error: 'totemId inválido' });
    }
    return res.json({
      success: true,
      totem_id: totemId,
      records: listAceAudit(totemId),
    });
  } catch (error: any) {
    await logError('[lab-ace] GET /audit', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export { isAceEnabledInCapabilities };
export default router;

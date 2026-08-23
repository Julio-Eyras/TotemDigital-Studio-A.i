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
      return res.status(422).json({
        success: false,
        code: decision.code,
        errors: decision.errors,
      });
    }

    const ctx = asContext(decision.payload);
    const hint = getAceHintStore().put(ctx);
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

export { isAceEnabledInCapabilities };
export default router;

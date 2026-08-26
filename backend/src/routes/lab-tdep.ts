/**
 * Lab TDEP 0.1 — opt-in de fill e preview da lane.
 * Default off. Sem Player-AD. Sem /tdep/v1 de produto.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { isStudioRuntime } from '../config/installationRuntime';
import { logError } from '../utils/loggerHelper';
import { applyTdepLane, TdepLaneCandidate } from '../services/lab/tdepDispatchLane';
import { getTdepFillStore } from '../services/lab/tdepFillStore';

const router = Router();
router.use(authMiddleware);

const LAB_ROLES = isStudioRuntime()
  ? (['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'publisher_user'] as const)
  : (['admin', 'admin_sql', 'owner_system', 'operador_tecnico'] as const);

router.use(authorizeRole([...LAB_ROLES]) as any);

router.get('/fill/:totemId', (req: AuthenticatedRequest, res: Response) => {
  const totemId = Number(req.params.totemId);
  if (!Number.isInteger(totemId) || totemId < 1) {
    return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
  }
  return res.json({ success: true, totem_id: totemId, ...getTdepFillStore().get(totemId) });
});

router.patch('/fill/:totemId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totemId = Number(req.params.totemId);
    if (!Number.isInteger(totemId) || totemId < 1) {
      return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const saved = getTdepFillStore().put(totemId, {
      enabled: body.enabled === undefined ? undefined : body.enabled === true,
      killSwitch: body.killSwitch === undefined ? undefined : body.killSwitch === true,
      capSharePct: body.capSharePct != null ? Number(body.capSharePct) : undefined,
    });
    return res.json({ success: true, totem_id: totemId, ...saved });
  } catch (error: any) {
    await logError('[lab-tdep] PATCH /fill', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/lane/preview', (req: AuthenticatedRequest, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const candidates = Array.isArray(body.candidates) ? (body.candidates as TdepLaneCandidate[]) : [];
  const result = applyTdepLane(candidates, {
    enabled: body.enabled === true,
    killSwitch: body.killSwitch === true,
    flightAccepted: body.flightAccepted === true,
    flightPriority: body.flightPriority === 'guaranteed' ? 'guaranteed' : 'fill',
    capSharePct: Number(body.capSharePct || 10),
    shareUsedPct: Number(body.shareUsedPct || 0),
    wantSharePct: Number(body.wantSharePct || 1),
  });
  return res.json({ success: true, ...result });
});

export default router;

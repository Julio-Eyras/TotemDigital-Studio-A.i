/**
 * Lab sistema 0.1 — um ciclo ACE + Maestro mock + TDEP mock.
 * Sem Player-AD. Sem TV box. Sem /tdep/v1 de produto.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { isStudioRuntime } from '../config/installationRuntime';
import { logError } from '../utils/loggerHelper';
import {
  getLabNowPlaying,
  listLabProofs,
  LabSystemTickInput,
  revokeLabFlight,
  runLabSystemTick,
} from '../services/lab/labSystemTick';
import { labAceOptInSnapshot, putLabAceOptIn } from '../services/lab/labCapabilitiesStore';
import {
  measureMaestroPair,
  measureSsidPair,
  mockMaestroPlayerAcceptsCue,
  LabSsidBox,
} from '../services/lab/labEmulation';

const router = Router();
router.use(authMiddleware);

const LAB_ROLES = isStudioRuntime()
  ? (['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'publisher_user'] as const)
  : (['admin', 'admin_sql', 'owner_system', 'operador_tecnico'] as const);

router.use(authorizeRole([...LAB_ROLES]) as any);

const PLAYERS: LabSsidBox = { role: 'players', ssid: 'totem-players', bandGhz: 5 };

router.post('/tick', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = (req.body || {}) as LabSystemTickInput;
    const result = runLabSystemTick(body);
    return res.status(202).json({ success: true, ...result });
  } catch (error: any) {
    await logError('[lab-system] POST /tick', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/proofs/:totemId', (req: AuthenticatedRequest, res: Response) => {
  const totemId = Number(req.params.totemId);
  if (!Number.isInteger(totemId) || totemId < 1) {
    return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
  }
  const rows = listLabProofs(totemId);
  return res.json({ success: true, totem_id: totemId, proofs: rows, mock: true });
});

router.get('/now/:totemId', (req: AuthenticatedRequest, res: Response) => {
  const totemId = Number(req.params.totemId);
  if (!Number.isInteger(totemId) || totemId < 1) {
    return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
  }
  const now = getLabNowPlaying(totemId);
  return res.json({ success: true, totem_id: totemId, nowPlaying: now, mock: true });
});

router.post('/revoke', (req: AuthenticatedRequest, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const flightId = revokeLabFlight(typeof body.flightId === 'string' ? body.flightId : undefined);
  return res.json({ success: true, mock: true, revoked: true, flightId, code: 'RIGHTS_REVOKED' });
});

router.get('/optin/:totemId', (req: AuthenticatedRequest, res: Response) => {
  const totemId = Number(req.params.totemId);
  if (!Number.isInteger(totemId) || totemId < 1) {
    return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
  }
  return res.json({ success: true, ...labAceOptInSnapshot(totemId) });
});

router.patch('/optin/:totemId', (req: AuthenticatedRequest, res: Response) => {
  const totemId = Number(req.params.totemId);
  if (!Number.isInteger(totemId) || totemId < 1) {
    return res.status(400).json({ success: false, code: 'BAD_TOTEM' });
  }
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.aceEnabled !== undefined) {
    putLabAceOptIn(totemId, body.aceEnabled === true);
  }
  return res.json({ success: true, ...labAceOptInSnapshot(totemId) });
});

router.post('/maestro/preview', (req: AuthenticatedRequest, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const ntp = measureMaestroPair(Number(body.offsetAMs ?? 18), Number(body.offsetBMs ?? 0), {
    ntpOkA: body.ntpOkA !== false,
    ntpOkB: body.ntpOkB !== false,
  });
  const ssidA = (body.ssidA as LabSsidBox) || PLAYERS;
  const ssidB = (body.ssidB as LabSsidBox) || PLAYERS;
  const ssid = measureSsidPair(ssidA, ssidB);
  const player = mockMaestroPlayerAcceptsCue(
    { clock: { ntp_ok: ntp.ntpOk, drift_ms: ntp.driftMs } },
    ssid
  );
  return res.json({ success: true, mock: true, ntp, ssid, player });
});

export default router;

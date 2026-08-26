jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 1, userId: 1, role: 'admin', username: 'lab' };
    next();
  },
  authorizeRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../config/installationRuntime', () => ({
  isStudioRuntime: () => true,
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import labSystemRouter from '../../../routes/lab-system';
import { resetLabPlayerStoreForTests } from '../../../services/lab/labSystemTick';
import { resetAceHintStoreForTests } from '../../../services/ace/aceHintStore';
import { resetAceAuditRingForTests } from '../../../services/ace/aceAudit';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/lab/system', labSystemRouter);
  return server;
}

describe('HTTP lab sistema (auth mock, sem Postgres nem TV box)', () => {
  beforeEach(() => {
    resetLabPlayerStoreForTests();
    resetAceHintStoreForTests();
    resetAceAuditRingForTests();
  });

  it('POST /tick 202 default off + GET /now mock', async () => {
    const server = app();
    const tick = await request(server).post('/api/lab/system/tick').send({ totemId: 41 });
    expect(tick.status).toBe(202);
    expect(tick.body.winnerId).toBe('direct-local');
    expect(tick.body.mocks.playerAd).toBe(true);
    expect(tick.body.tdep.code).toBe('TOTEMNET_OFF');

    const now = await request(server).get('/api/lab/system/now/41');
    expect(now.status).toBe(200);
    expect(now.body.nowPlaying.mock).toBe(true);
    expect(now.body.nowPlaying.itemId).toBe('direct-local');
  });

  it('POST /tick fill + GET /proofs HMAC lab', async () => {
    const server = app();
    const tick = await request(server)
      .post('/api/lab/system/tick')
      .send({
        totemId: 41,
        ace: {
          aceEnabled: false,
          candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
        },
        tdep: { enabled: true, flightAccepted: true },
      });
    expect(tick.status).toBe(202);
    expect(tick.body.winnerLane).toBe('tdep_fill');
    expect(tick.body.proof.seller_sig).toMatch(/^[a-f0-9]{64}$/);
    const proofs = await request(server).get('/api/lab/system/proofs/41');
    expect(proofs.body.proofs.length).toBe(1);
    expect(JSON.stringify(proofs.body)).not.toContain('audience');
  });

  it('POST /revoke depois o tick recusa RIGHTS_REVOKED', async () => {
    const server = app();
    const rev = await request(server).post('/api/lab/system/revoke').send({});
    expect(rev.body.code).toBe('RIGHTS_REVOKED');
    const tick = await request(server)
      .post('/api/lab/system/tick')
      .send({
        totemId: 41,
        ace: {
          aceEnabled: false,
          candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
        },
        tdep: { enabled: true, flightAccepted: true },
      });
    expect(tick.body.tdep.code).toBe('RIGHTS_REVOKED');
    expect(tick.body.proof).toBeNull();
  });

  it('POST /maestro/preview recusa CLOCK_DRIFT', async () => {
    const server = app();
    const res = await request(server)
      .post('/api/lab/system/maestro/preview')
      .send({ offsetAMs: 480, offsetBMs: 0 });
    expect(res.status).toBe(200);
    expect(res.body.player.code).toBe('CLOCK_DRIFT');
    expect(res.body.mock).toBe(true);
  });

  it('GET /now totem inválido 400', async () => {
    const server = app();
    const res = await request(server).get('/api/lab/system/now/0');
    expect(res.status).toBe(400);
  });

  it('PATCH /optin mock SQL e tick lê o store', async () => {
    const server = app();
    const off = await request(server).get('/api/lab/system/optin/41');
    expect(off.body.aceEnabled).toBe(false);
    const patch = await request(server).patch('/api/lab/system/optin/41').send({ aceEnabled: true });
    expect(patch.body.aceEnabled).toBe(true);
    expect(patch.body.capabilities.ace_enabled).toBe(true);
    const ignore = await request(server).patch('/api/lab/system/optin/41').send({});
    expect(ignore.body.aceEnabled).toBe(true);
    const tick = await request(server).post('/api/lab/system/tick').send({
      totemId: 41,
      ace: {
        context: {
          schema: 'ace/0.1',
          context_id: '8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10',
          observed_at: new Date().toISOString(),
          totem_id: 41,
          privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
          presence: true,
          count: 3,
          group: true,
          density: 'medium',
          motion: { approaching: 2, passing: 0, stopped: 1, leaving: 0 },
          attention: 'high',
          dwell_ms: 4200,
          interaction: { touch: false, qr: false, nfc: false },
          clock: { hour_local: 18, day_of_week: 0, store_open: true },
          confidence: 0.91,
        },
      },
    });
    expect(tick.body.optIn.source).toBe('store');
    expect(tick.body.ace.hint.category).toBe('PREMIUM');
    expect(tick.body.winnerId).toBe('direct-local');
  });

  it('POST /tick STALE_CONTEXT e FORMAT_MISMATCH', async () => {
    const server = app();
    const stale = await request(server)
      .post('/api/lab/system/tick')
      .send({
        totemId: 41,
        ace: {
          aceEnabled: true,
          context: {
            schema: 'ace/0.1',
            context_id: '8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10',
            observed_at: new Date(Date.now() - 10_000).toISOString(),
            totem_id: 41,
            privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
            presence: true,
            count: 3,
            group: true,
            density: 'medium',
            motion: { approaching: 2, passing: 0, stopped: 1, leaving: 0 },
            attention: 'high',
            dwell_ms: 4200,
            interaction: { touch: false, qr: false, nfc: false },
            clock: { hour_local: 18, day_of_week: 0, store_open: true },
            confidence: 0.91,
          },
        },
      });
    expect(stale.body.ace.gatewayCode).toBe('STALE_CONTEXT');
    expect(stale.body.ace.hint).toBeNull();

    const mismatch = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: {
          aceEnabled: false,
          candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
        },
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', refuse_code: 'FORMAT_MISMATCH' },
        },
      });
    expect(mismatch.body.tdep.code).toBe('FORMAT_MISMATCH');
    expect(mismatch.body.proof).toBeNull();
  });

  it('POST /tick LOW_CONFIDENCE e POLICY_AUDIO', async () => {
    const server = app();
    const low = await request(server)
      .post('/api/lab/system/tick')
      .send({
        totemId: 41,
        ace: {
          aceEnabled: true,
          context: {
            schema: 'ace/0.1',
            context_id: '8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10',
            observed_at: new Date().toISOString(),
            totem_id: 41,
            privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
            presence: true,
            count: 3,
            group: true,
            density: 'medium',
            motion: { approaching: 2, passing: 0, stopped: 1, leaving: 0 },
            attention: 'high',
            dwell_ms: 4200,
            interaction: { touch: false, qr: false, nfc: false },
            clock: { hour_local: 18, day_of_week: 0, store_open: true },
            confidence: 0.12,
          },
        },
      });
    expect(low.body.ace.gatewayCode).toBe('LOW_CONFIDENCE');
    expect(low.body.ace.hint).toBeNull();

    const audio = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: {
          aceEnabled: false,
          candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
        },
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', audio: true, face_audio: false },
        },
      });
    expect(audio.body.tdep.code).toBe('POLICY_AUDIO');
    expect(audio.body.proof).toBeNull();
  });
});

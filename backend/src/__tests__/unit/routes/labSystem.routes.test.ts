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
import { putLabAceSqlRow } from '../../../services/lab/labAceSql';

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

  it('GET /optin postgres NO_DATABASE; POST /sql apply false não escreve; tick hydrateSql', async () => {
    const server = app();
    const get = await request(server).get('/api/lab/system/optin/41');
    expect(get.body.postgres.code).toBe('NO_DATABASE');

    const dry = await request(server).post('/api/lab/system/optin/41/sql').send({ aceEnabled: true });
    expect(dry.body.code).toBe('NO_DATABASE');
    expect(dry.body.applied).toBe(false);

    putLabAceSqlRow(41, { wifi: true });
    const preview = await request(server).post('/api/lab/system/optin/41/sql').send({ aceEnabled: true });
    expect(preview.body.code).toBe('OK');
    expect(preview.body.applied).toBe(false);
    expect(preview.body.aceEnabled).toBe(true);
    const stillOff = await request(server).get('/api/lab/system/optin/41');
    expect(stillOff.body.postgres.aceEnabled).toBe(false);

    const written = await request(server)
      .post('/api/lab/system/optin/41/sql')
      .send({ aceEnabled: true, apply: true });
    expect(written.body.applied).toBe(true);
    const on = await request(server).get('/api/lab/system/optin/41');
    expect(on.body.postgres.aceEnabled).toBe(true);
    expect(on.body.postgres.capabilities.wifi).toBe(true);

    const tickOff = await request(server).post('/api/lab/system/tick').send({
      totemId: 41,
      ace: { hydrateSql: true, sqlConnected: false },
    });
    expect(tickOff.body.optIn.sqlCode).toBe('NO_DATABASE');
    expect(tickOff.body.optIn.aceEnabled).toBe(false);

    const tickOn = await request(server).post('/api/lab/system/tick').send({
      totemId: 41,
      ace: {
        hydrateSql: true,
        sqlRow: { ace_enabled: true },
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
    expect(tickOn.body.optIn.source).toBe('sql');
    expect(tickOn.body.optIn.sqlCode).toBe('OK');
    expect(tickOn.body.ace.hint.category).toBe('PREMIUM');
    expect(tickOn.body.winnerId).toBe('direct-local');
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

  it('POST /tick CATEGORY_BLOCKED e NOT_CEDIBLE', async () => {
    const server = app();
    const remnant = {
      aceEnabled: false,
      candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
    };
    const blocked = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: remnant,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: {
            schema: 'tdep/0.1',
            brand_categories: ['alcohol'],
            blocked_categories: ['alcohol'],
          },
        },
      });
    expect(blocked.body.tdep.code).toBe('CATEGORY_BLOCKED');
    expect(blocked.body.proof).toBeNull();

    const notCedible = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: remnant,
        tdep: { enabled: true, flightAccepted: true, partnerPayload: { schema: 'tdep/0.1', cedible: false } },
      });
    expect(notCedible.body.tdep.code).toBe('NOT_CEDIBLE');
    expect(notCedible.body.proof).toBeNull();
  });

  it('POST /tick NO_HANDSHAKE e HANDSHAKE_REPLAY', async () => {
    const server = app();
    const remnant = {
      aceEnabled: false,
      candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
    };
    const noHs = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: remnant,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', handshake_ok: false },
        },
      });
    expect(noHs.body.tdep.code).toBe('NO_HANDSHAKE');
    expect(noHs.body.proof).toBeNull();

    const replay = await request(server)
      .post('/api/lab/system/tick')
      .send({
        ace: remnant,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', handshake_ts: '2020-01-01T00:00:00.000Z' },
        },
      });
    expect(replay.body.tdep.code).toBe('HANDSHAKE_REPLAY');
    expect(replay.body.proof).toBeNull();
  });
});

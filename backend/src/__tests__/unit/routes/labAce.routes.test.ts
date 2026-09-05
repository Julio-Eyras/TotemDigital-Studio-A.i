jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 1, userId: 1, role: 'admin', username: 'lab', email: 'lab@example.com' };
    next();
  },
  authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../config/installationRuntime', () => ({
  isStudioRuntime: () => true,
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import labAceRouter from '../../../routes/lab-ace';
import { resetAceHintStoreForTests } from '../../../services/ace/aceHintStore';
import { resetAceAuditRingForTests } from '../../../services/ace/aceAudit';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/lab/ace', labAceRouter);
  return server;
}

function freshBody() {
  return {
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
    session_id: 'ephemeral-http',
  };
}

describe('HTTP lab ACE (auth mock, sem Postgres)', () => {
  beforeEach(() => {
    resetAceHintStoreForTests();
    resetAceAuditRingForTests();
  });

  it('POST /context 202 com hint PREMIUM; GET /hint e /audit', async () => {
    const server = app();
    const post = await request(server).post('/api/lab/ace/context').send(freshBody());
    expect(post.status).toBe(202);
    expect(post.body.hint.category).toBe('PREMIUM');
    expect(JSON.stringify(post.body)).not.toContain('ephemeral-http');

    const hint = await request(server).get('/api/lab/ace/hint/41');
    expect(hint.status).toBe(200);
    expect(hint.body.code).toBe('HINT_APPLIED');

    const audit = await request(server).get('/api/lab/ace/audit/41');
    expect(audit.status).toBe(200);
    expect(audit.body.records.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit.body)).not.toContain('ephemeral-http');
  });

  it('POST /context 422 IDENTITY_LEAK', async () => {
    const server = app();
    const res = await request(server)
      .post('/api/lab/ace/context')
      .send({ ...freshBody(), tag_id: '04:AA' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IDENTITY_LEAK');
  });

  it('POST /interaction NFC 202 STANDARD', async () => {
    const server = app();
    const res = await request(server)
      .post('/api/lab/ace/interaction')
      .send({ totem_id: 41, nfc: true });
    expect(res.status).toBe(202);
    expect(res.body.hint.category).toBe('STANDARD');
    expect(res.body.interaction).toEqual({ touch: false, qr: false, nfc: true });
  });

  it('GET /hint totem inválido 400', async () => {
    const server = app();
    const res = await request(server).get('/api/lab/ace/hint/0');
    expect(res.status).toBe(400);
  });
});

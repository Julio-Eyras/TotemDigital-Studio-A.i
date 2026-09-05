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
import labTdepRouter from '../../../routes/lab-tdep';
import { resetTdepFillStoreForTests } from '../../../services/lab/tdepFillStore';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/lab/tdep', labTdepRouter);
  return server;
}

describe('HTTP lab TDEP fill (auth mock, sem Postgres)', () => {
  beforeEach(() => {
    resetTdepFillStoreForTests();
  });

  it('GET /fill default off', async () => {
    const server = app();
    const res = await request(server).get('/api/lab/tdep/fill/41');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.killSwitch).toBe(false);
    expect(res.body.capSharePct).toBe(10);
  });

  it('PATCH omite enabled e não força false', async () => {
    const server = app();
    await request(server).patch('/api/lab/tdep/fill/41').send({ enabled: true });
    const partial = await request(server).patch('/api/lab/tdep/fill/41').send({ killSwitch: true });
    expect(partial.status).toBe(200);
    expect(partial.body.enabled).toBe(true);
    expect(partial.body.killSwitch).toBe(true);
  });

  it('PATCH clamp do cap a 10; GET totem inválido 400', async () => {
    const server = app();
    const patched = await request(server).patch('/api/lab/tdep/fill/7').send({ capSharePct: 99 });
    expect(patched.body.capSharePct).toBe(10);
    const bad = await request(server).get('/api/lab/tdep/fill/0');
    expect(bad.status).toBe(400);
  });

  it('POST /lane/preview: local ganha mesmo com fill a 900', async () => {
    const server = app();
    const res = await request(server)
      .post('/api/lab/tdep/lane/preview')
      .send({
        enabled: true,
        flightAccepted: true,
        candidates: [
          { id: 'direct-local', weight: 100, lane: 'local' },
          { id: 'tdep-fill', weight: 900, lane: 'tdep_fill' },
          { id: 'idle', weight: 1, lane: 'idle' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.winnerId).toBe('direct-local');
    expect(res.body.winnerLane).toBe('local');
  });
});

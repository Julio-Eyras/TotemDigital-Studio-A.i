import express from 'express';
import request from 'supertest';
import { advancedScheduleService } from '../../../services/advancedScheduleService';

import * as express from 'express';

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'sub10') {
      req.user = { id: 1, role: 'subscriber_user', subscriberId: 10, userType: 'subscriber_user' };
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userType: 'subscriber_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return { authMiddleware: authFn };
});

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  sanitizeForLogging: (x: unknown) => x,
}));

describe('GET /api/advanced-schedules/:id — escopo', () => {
  let spySid: jest.SpyInstance;
  let spyGet: jest.SpyInstance;

  const makeApp = async () => {
    const router = (await import('../../../routes/advanced-schedules')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/advanced-schedules', router);
    return app;
  };

  const minimalSchedule = {
    schedule_id: 1,
    name: 'S',
    description: null,
    schedule_type: 'campaign',
    target_id: 5,
    cron_expression: '0 0 * * *',
    schedule_config: {},
    enabled: true,
    last_execution: null,
    next_execution: null,
    execution_count: 0,
    success_count: 0,
    failure_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 1,
  };

  beforeEach(() => {
    spySid = jest.spyOn(advancedScheduleService, 'getSubscriberIdForSchedule').mockResolvedValue(10);
    spyGet = jest.spyOn(advancedScheduleService, 'getScheduleById').mockResolvedValue(minimalSchedule as any);
  });

  afterEach(() => {
    spySid.mockRestore();
    spyGet.mockRestore();
  });

  it('permite subscriber_user do assinante dono do alvo', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/advanced-schedules/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
  });

  it('bloqueia outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/advanced-schedules/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('admin_sql pode ler', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/advanced-schedules/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/advanced-schedules — escopo do target', () => {
  let spyTarget: jest.SpyInstance;
  let spyCreate: jest.SpyInstance;

  const makeApp = async () => {
    const router = (await import('../../../routes/advanced-schedules')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/advanced-schedules', router);
    return app;
  };

  const minimalSchedule = {
    schedule_id: 1,
    name: 'Novo',
    description: null,
    schedule_type: 'campaign',
    target_id: 5,
    cron_expression: '0 0 * * *',
    schedule_config: {},
    enabled: true,
    last_execution: null,
    next_execution: null,
    execution_count: 0,
    success_count: 0,
    failure_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 1,
  };

  const validBody = {
    name: 'Novo',
    scheduleType: 'campaign',
    targetId: 5,
    cronExpression: '0 0 * * *',
  };

  beforeEach(() => {
    spyTarget = jest.spyOn(advancedScheduleService, 'getSubscriberIdForScheduleTarget').mockResolvedValue(10);
    spyCreate = jest.spyOn(advancedScheduleService, 'createSchedule').mockResolvedValue(minimalSchedule as any);
  });

  afterEach(() => {
    spyTarget.mockRestore();
    spyCreate.mockRestore();
  });

  it('permite subscriber_user quando o alvo pertence ao seu assinante', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/advanced-schedules')
      .set('Authorization', 'Bearer sub10')
      .send(validBody);
    expect(res.status).toBe(201);
    expect(spyCreate).toHaveBeenCalled();
  });

  it('bloqueia outro assinante antes de criar', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/advanced-schedules')
      .set('Authorization', 'Bearer sub99')
      .send(validBody);
    expect(res.status).toBe(403);
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('admin_sql pode criar sem checagem de tenant', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/advanced-schedules')
      .set('Authorization', 'Bearer admin')
      .send(validBody);
    expect(res.status).toBe(201);
    expect(spyCreate).toHaveBeenCalled();
  });

  it('retorna 400 quando alvo não resolve subscriber', async () => {
    spyTarget.mockResolvedValue(null);
    const app = await makeApp();
    const res = await request(app)
      .post('/api/advanced-schedules')
      .set('Authorization', 'Bearer sub10')
      .send(validBody);
    expect(res.status).toBe(400);
    expect(spyCreate).not.toHaveBeenCalled();
  });
});

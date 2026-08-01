import { initializeCompactStartup } from '../../../startup/startupCompact';
import { initializeOperationalWorkers } from '../../../startup/startupOperationalWorkers';
import { logInfo } from '../../../utils/loggerHelper';

jest.mock('../../../startup/startupOperationalWorkers', () => ({
  initializeOperationalWorkers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
}));

describe('initializeCompactStartup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve inicializar workers sem Bull e com flags comerciais off por omissão', async () => {
    await initializeCompactStartup({ redisEnabled: true });

    expect(logInfo).toHaveBeenCalledWith('Modo Studio (compacto): Redis ativo para cache');
    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: true,
      enableBullQueues: false,
      enableBillingWorkers: false,
      enablePlaylistMix: false,
      enablePlaylistEngine: false,
      enableAlertCron: false,
      enableSubscriberAccessWorker: false,
      logLabel: 'Modo Studio (compacto)',
    });
  });

  it('deve respeitar workerFlags excepto Bull (sempre off no Studio)', async () => {
    await initializeCompactStartup({
      redisEnabled: false,
      workerFlags: {
        enableBullQueues: true,
        enableBillingWorkers: true,
        enablePlaylistMix: true,
        enablePlaylistEngine: false,
        enableAlertCron: true,
        enableSubscriberAccessWorker: false,
      },
    });

    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: false,
      enableBullQueues: false,
      enableBillingWorkers: true,
      enablePlaylistMix: true,
      enablePlaylistEngine: false,
      enableAlertCron: true,
      enableSubscriberAccessWorker: false,
      logLabel: 'Modo Studio (compacto)',
    });
  });
});

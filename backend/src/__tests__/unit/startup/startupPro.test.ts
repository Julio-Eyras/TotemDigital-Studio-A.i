import { initializeProStartup } from '../../../startup/startupPro';
import { initializeOperationalWorkers } from '../../../startup/startupOperationalWorkers';
import { logInfo } from '../../../utils/loggerHelper';

jest.mock('../../../startup/startupOperationalWorkers', () => ({
  initializeOperationalWorkers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
}));

describe('initializeProStartup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve delegar workers operacionais com filas Bull quando redis ativo', async () => {
    await initializeProStartup({ redisEnabled: true });

    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: true,
      enableBullQueues: true,
      enableBillingWorkers: true,
      enablePlaylistMix: true,
      enablePlaylistEngine: true,
      enableAlertCron: true,
      enableSubscriberAccessWorker: true,
      logLabel: 'Modo Pro',
    });
  });

  it('deve desligar Bull quando redis desativado mesmo com flag pedida', async () => {
    await initializeProStartup({
      redisEnabled: false,
      workerFlags: {
        enableBullQueues: true,
        enableBillingWorkers: false,
        enablePlaylistMix: true,
        enablePlaylistEngine: true,
        enableAlertCron: false,
        enableSubscriberAccessWorker: true,
      },
    });

    expect(logInfo).toHaveBeenCalledWith('Modo Pro sem Redis: filas Bull não serão inicializadas');
    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: false,
      enableBullQueues: false,
      enableBillingWorkers: false,
      enablePlaylistMix: true,
      enablePlaylistEngine: true,
      enableAlertCron: false,
      enableSubscriberAccessWorker: true,
      logLabel: 'Modo Pro',
    });
  });
});

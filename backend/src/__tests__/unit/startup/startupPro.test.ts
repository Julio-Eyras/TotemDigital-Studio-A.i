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
      logLabel: 'Modo Pro',
    });
  });

  it('deve delegar workers sem Bull quando redis desativado', async () => {
    await initializeProStartup({ redisEnabled: false });

    expect(logInfo).toHaveBeenCalledWith('Modo Pro sem Redis: filas Bull não serão inicializadas');
    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: false,
      enableBullQueues: false,
      logLabel: 'Modo Pro',
    });
  });
});

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

  it('deve inicializar workers operacionais sem filas Bull', async () => {
    await initializeCompactStartup({ redisEnabled: true });

    expect(logInfo).toHaveBeenCalledWith('Modo Studio (compacto): Redis ativo para cache');
    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: true,
      enableBullQueues: false,
      logLabel: 'Modo Studio (compacto)',
    });
  });

  it('deve inicializar workers operacionais com redis desativado', async () => {
    await initializeCompactStartup({ redisEnabled: false });

    expect(logInfo).toHaveBeenCalledWith('Modo Studio (compacto): Redis desabilitado');
    expect(initializeOperationalWorkers).toHaveBeenCalledWith({
      redisEnabled: false,
      enableBullQueues: false,
      logLabel: 'Modo Studio (compacto)',
    });
  });
});

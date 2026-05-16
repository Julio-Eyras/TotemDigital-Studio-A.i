import { initializeCompactStartup } from '../../../startup/startupCompact';
import { logInfo } from '../../../utils/loggerHelper';

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../workers/financialBillingWorker', () => ({
  FinancialBillingWorker: class MockFinancialBillingWorker {
    start = jest.fn();
  },
}));

describe('initializeCompactStartup', () => {
  it('deve logar perfil compacto com redis ativo', async () => {
    await initializeCompactStartup({ redisEnabled: true });

    expect(logInfo).toHaveBeenCalledWith('Modo compacto: Redis ativo apenas para cache essencial');
    expect(logInfo).toHaveBeenCalledWith(
      'Modo compacto: filas Bull e workers Pro avançados não serão inicializados'
    );
    expect(logInfo).toHaveBeenCalledWith(
      'Modo compacto: Financial Billing Worker ativo (emissão, vencidas, e-mails)'
    );
  });

  it('deve logar perfil compacto com redis desativado', async () => {
    await initializeCompactStartup({ redisEnabled: false });

    expect(logInfo).toHaveBeenCalledWith('Modo compacto: Redis desabilitado');
    expect(logInfo).toHaveBeenCalledWith(
      'Modo compacto: filas Bull e workers Pro avançados não serão inicializados'
    );
    expect(logInfo).toHaveBeenCalledWith(
      'Modo compacto: Financial Billing Worker ativo (emissão, vencidas, e-mails)'
    );
  });
});


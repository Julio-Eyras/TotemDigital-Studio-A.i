import { logInfo } from '../utils/loggerHelper';

interface CompactStartupOptions {
  redisEnabled: boolean;
}

export async function initializeCompactStartup(options: CompactStartupOptions): Promise<void> {
  if (options.redisEnabled) {
    await logInfo('Modo compacto: Redis ativo apenas para cache essencial');
  } else {
    await logInfo('Modo compacto: Redis desabilitado');
  }

  await logInfo('Modo compacto: filas Bull e workers Pro avançados não serão inicializados');

  const { FinancialBillingWorker } = await import('../workers/financialBillingWorker');
  const financialWorker = new FinancialBillingWorker();
  financialWorker.start();
  (global as any).financialBillingWorker = financialWorker;
  await logInfo('Modo compacto: Financial Billing Worker ativo (emissão, vencidas, e-mails)');
}


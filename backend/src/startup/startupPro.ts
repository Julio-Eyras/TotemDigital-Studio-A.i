import { logInfo } from '../utils/loggerHelper';
import { initializeOperationalWorkers } from './startupOperationalWorkers';

interface ProStartupOptions {
  redisEnabled: boolean;
}

export async function initializeProStartup(options: ProStartupOptions): Promise<void> {
  if (!options.redisEnabled) {
    await logInfo('Modo Pro sem Redis: filas Bull não serão inicializadas');
  }

  await initializeOperationalWorkers({
    redisEnabled: options.redisEnabled,
    enableBullQueues: options.redisEnabled,
    logLabel: 'Modo Pro',
  });
}

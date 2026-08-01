import { logInfo } from '../utils/loggerHelper';
import {
  initializeOperationalWorkers,
  OperationalWorkersOptions,
} from './startupOperationalWorkers';

interface ProStartupOptions {
  redisEnabled: boolean;
  /** Flags derivadas de capabilities (Etapa E). */
  workerFlags?: Omit<OperationalWorkersOptions, 'redisEnabled' | 'logLabel'>;
}

export async function initializeProStartup(options: ProStartupOptions): Promise<void> {
  if (!options.redisEnabled) {
    await logInfo('Modo Pro sem Redis: filas Bull não serão inicializadas');
  }

  const flags = options.workerFlags || {
    enableBullQueues: options.redisEnabled,
    enableBillingWorkers: true,
    enablePlaylistMix: true,
    enablePlaylistEngine: true,
    enableAlertCron: true,
    enableSubscriberAccessWorker: true,
  };

  await initializeOperationalWorkers({
    redisEnabled: options.redisEnabled,
    ...flags,
    enableBullQueues: Boolean(flags.enableBullQueues && options.redisEnabled),
    logLabel: 'Modo Pro',
  });
}

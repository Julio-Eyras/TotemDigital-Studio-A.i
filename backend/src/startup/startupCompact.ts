import { logInfo } from '../utils/loggerHelper';
import {
  initializeOperationalWorkers,
  OperationalWorkersOptions,
} from './startupOperationalWorkers';

interface CompactStartupOptions {
  redisEnabled: boolean;
  /** Flags derivadas de capabilities; se omitidas, Studio sem Bull. */
  workerFlags?: Omit<OperationalWorkersOptions, 'redisEnabled' | 'logLabel'>;
}

/**
 * Arranque modo compacto / Smart Signage Studio (mono).
 * Workers seguem capabilities (Etapa E); default sem Bull.
 */
export async function initializeCompactStartup(options: CompactStartupOptions): Promise<void> {
  if (options.redisEnabled) {
    await logInfo('Modo Studio (compacto): Redis ativo para cache');
  } else {
    await logInfo('Modo Studio (compacto): Redis desabilitado');
  }

  const flags = options.workerFlags || {
    enableBullQueues: false,
    enableBillingWorkers: false,
    enablePlaylistMix: false,
    enablePlaylistEngine: false,
    enableAlertCron: false,
    enableSubscriberAccessWorker: false,
  };

  await initializeOperationalWorkers({
    redisEnabled: options.redisEnabled,
    ...flags,
    enableBullQueues: false, // Studio: nunca Bull export (perfil mono)
    logLabel: 'Modo Studio (compacto)',
  });
}

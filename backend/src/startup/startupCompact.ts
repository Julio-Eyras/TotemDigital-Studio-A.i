import { logInfo } from '../utils/loggerHelper';
import { initializeOperationalWorkers } from './startupOperationalWorkers';

interface CompactStartupOptions {
  redisEnabled: boolean;
}

/**
 * Arranque modo compacto / Smart Signage Studio (mono).
 * Paridade operacional com Pro: mix, alertas, Stripe; Bull export só se Redis + perfil Pro.
 */
export async function initializeCompactStartup(options: CompactStartupOptions): Promise<void> {
  if (options.redisEnabled) {
    await logInfo('Modo Studio (compacto): Redis ativo para cache');
  } else {
    await logInfo('Modo Studio (compacto): Redis desabilitado');
  }

  await initializeOperationalWorkers({
    redisEnabled: options.redisEnabled,
    enableBullQueues: false,
    logLabel: 'Modo Studio (compacto)',
  });
}

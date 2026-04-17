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

  await logInfo(
    'Modo compacto: filas Bull, workers Pro e rotinas avançadas não serão inicializados'
  );
}


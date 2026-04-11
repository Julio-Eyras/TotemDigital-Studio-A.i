/**
 * NTP (Network Time Protocol) Service - Smart Signage Pro v3.1
 * Sincronização de tempo para precisão em timelines
 */

import { logInfo, logError, logWarn } from '../utils/loggerHelper';

export interface NTPTime {
  timestamp: number;
  offset: number; // Offset em milissegundos
  server: string;
  synchronized: boolean;
}

export class NTPService {
  private offset: number = 0;
  private lastSync: number = 0;
  private syncInterval: number = 3600000; // 1 hora
  private ntpServers: string[] = [
    'pool.ntp.org',
    'time.google.com',
    'time.cloudflare.com'
  ];

  /**
   * Sincroniza tempo com servidor NTP
   */
  async syncTime(): Promise<number> {
    try {
      const axios = (await import('axios')).default;
      
      for (const server of this.ntpServers) {
        try {
          const startTime = Date.now();
          const response = await axios.get(`https://${server}`, {
            timeout: 5000,
            validateStatus: () => true
          });
          const endTime = Date.now();
          const roundTripTime = endTime - startTime;

          // Calcular offset (simplificado - em produção usar protocolo NTP real)
          const serverTime = new Date(response.headers['date'] || Date.now()).getTime();
          const localTime = startTime + (roundTripTime / 2);
          this.offset = serverTime - localTime;
          this.lastSync = Date.now();

          await logInfo('Tempo sincronizado com NTP', {
            server,
            offset: this.offset,
            roundTripTime
          });

          return this.offset;
        } catch (error: any) {
          await logWarn(`Falha ao sincronizar com ${server}`, { error: error.message });
          continue;
        }
      }

      throw new Error('Todos os servidores NTP falharam');
    } catch (error: any) {
      await logError('Erro ao sincronizar tempo NTP', error, {});
      // Retornar offset 0 se falhar (usar tempo local)
      this.offset = 0;
      return 0;
    }
  }

  /**
   * Obtém tempo sincronizado atual
   */
  getSynchronizedTime(): number {
    // Se nunca sincronizou ou última sincronização foi há mais de 1 hora, tentar sincronizar
    if (this.lastSync === 0 || (Date.now() - this.lastSync) > this.syncInterval) {
      // Sincronizar em background (não bloquear)
      this.syncTime().catch(() => {});
    }

    return Date.now() + this.offset;
  }

  /**
   * Obtém offset atual
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Verifica se está sincronizado
   */
  isSynchronized(): boolean {
    return this.lastSync > 0 && (Date.now() - this.lastSync) < this.syncInterval;
  }

  /**
   * Valida se timestamp está dentro da tolerância
   */
  validateTimestamp(timestamp: number, toleranceMs: number = 5000): boolean {
    const synchronizedTime = this.getSynchronizedTime();
    const diff = Math.abs(timestamp - synchronizedTime);
    return diff <= toleranceMs;
  }
}

// Singleton
let ntpServiceInstance: NTPService | null = null;

export function getNTPService(): NTPService {
  if (!ntpServiceInstance) {
    ntpServiceInstance = new NTPService();
    // Sincronizar na inicialização
    ntpServiceInstance.syncTime().catch(() => {});
  }
  return ntpServiceInstance;
}


/**
 * Subscriber Access Notification Worker - Smart Signage v2.0
 * Worker para verificar e notificar sobre acessos subscriber → publisher expirando
 */

import cron from 'node-cron';
import { getSubscriberAccessNotificationServiceInstance } from '../services/subscriberAccessNotificationService';
import { logInfo, logError } from '../utils/loggerHelper';

export class SubscriberAccessNotificationWorker {
  private notificationService = getSubscriberAccessNotificationServiceInstance();
  private cronJob30Days: cron.ScheduledTask | null = null;
  private cronJobExpired: cron.ScheduledTask | null = null;

  /**
   * Inicia o worker
   */
  start(): void {
    if (this.cronJob30Days || this.cronJobExpired) {
      logInfo('Subscriber Access Notification Worker já está em execução', {});
      return;
    }
    // Executar diariamente às 8h da manhã para verificar acessos expirando em múltiplos períodos (7, 15, 30 dias)
    this.cronJob30Days = cron.schedule('0 8 * * *', async () => {
      try {
        await logInfo('Iniciando verificação de acessos expirando (múltiplos períodos)', {});
        const result = await this.notificationService.checkAndNotifyAllPeriods([7, 15, 30]);
        await logInfo('Verificação de acessos expirando (múltiplos períodos) concluída', result);
      } catch (error: any) {
        await logError('Erro no worker de notificações de acesso expirando', error);
      }
    });

    // Executar diariamente às 9h da manhã para verificar acessos já expirados
    this.cronJobExpired = cron.schedule('0 9 * * *', async () => {
      try {
        await logInfo('Iniciando verificação de acessos expirados', {});
        const result = await this.notificationService.checkAndNotifyExpiredAccess();
        await logInfo('Verificação de acessos expirados concluída', result);
      } catch (error: any) {
        await logError('Erro no worker de notificações de acesso expirado', error);
      }
    });

    logInfo('Subscriber Access Notification Worker iniciado', {
      schedules: [
        'Verificação de acessos expirando (7, 15, 30 dias): 08:00 diariamente',
        'Verificação de acessos expirados: 09:00 diariamente',
      ],
    });
  }

  /**
   * Para o worker
   */
  stop(): void {
    if (this.cronJob30Days) {
      this.cronJob30Days.stop();
      this.cronJob30Days = null;
    }
    if (this.cronJobExpired) {
      this.cronJobExpired.stop();
      this.cronJobExpired = null;
    }
    logInfo('Subscriber Access Notification Worker parado', {});
  }
}


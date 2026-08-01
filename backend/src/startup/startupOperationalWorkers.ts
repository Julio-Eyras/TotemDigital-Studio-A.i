import cron from 'node-cron';
import {
  initializeExportQueue,
  initializeAdvancedScheduleQueue,
} from '../config/queue';
import { registerExportWorker } from '../workers/exportWorker';
import { registerAdvancedScheduleWorker } from '../workers/advancedScheduleWorker';
import { exportScheduleService } from '../services/exportScheduleService';
import { InvoiceWorker } from '../workers/invoiceWorker';
import { FinancialBillingWorker } from '../workers/financialBillingWorker';
import { SubscriberAccessNotificationWorker } from '../workers/subscriberAccessNotificationWorker';
import { getPlaylistEngineWorkerInstance } from '../workers/playlistEngineWorker';
import { getAlertService } from '../services/alertService';
import { logInfo, logWarn, logError } from '../utils/loggerHelper';

export interface OperationalWorkersOptions {
  redisEnabled: boolean;
  /** Filas Bull de exportação e agenda avançada. */
  enableBullQueues: boolean;
  /** Invoice + Financial Billing. */
  enableBillingWorkers?: boolean;
  /** Playlist Mix worker. */
  enablePlaylistMix?: boolean;
  /** Playlist Engine worker. */
  enablePlaylistEngine?: boolean;
  /** Cron de alertas (5 min). */
  enableAlertCron?: boolean;
  /** Notificações de acesso de anunciante. */
  enableSubscriberAccessWorker?: boolean;
  logLabel: string;
}

/**
 * Workers operacionais partilhados entre Pro e modo compacto (Studio).
 * Condicionados às capabilities/módulos da instalação (Etapa E).
 */
export async function initializeOperationalWorkers(
  options: OperationalWorkersOptions
): Promise<void> {
  const {
    redisEnabled,
    enableBullQueues,
    enableBillingWorkers = true,
    enablePlaylistMix = true,
    enablePlaylistEngine = true,
    enableAlertCron = true,
    enableSubscriberAccessWorker = true,
    logLabel,
  } = options;

  if (redisEnabled && enableBullQueues) {
    try {
      await logInfo(`${logLabel}: inicializando filas Bull (export + agenda avançada)...`);
      initializeExportQueue();
      registerExportWorker();
      initializeAdvancedScheduleQueue();
      registerAdvancedScheduleWorker();
    } catch (error: any) {
      await logWarn(`${logLabel}: erro ao inicializar filas Bull (continuando)`, {
        error: error.message,
      });
    }
  } else if (redisEnabled) {
    await logInfo(`${logLabel}: Redis ativo; filas Bull de export/agenda não solicitadas neste perfil`);
  } else if (enableBullQueues) {
    await logInfo(`${logLabel}: Bull solicitado mas Redis desabilitado — filas não arrancam`);
  }

  if (enableBillingWorkers) {
    await logInfo(`${logLabel}: Invoice Worker (Stripe/assinaturas)...`);
    const invoiceWorker = new InvoiceWorker();
    invoiceWorker.start();
    (global as any).invoiceWorker = invoiceWorker;

    const financialWorker = new FinancialBillingWorker();
    financialWorker.start();
    (global as any).financialBillingWorker = financialWorker;
    await logInfo(`${logLabel}: Financial Billing Worker ativo`);
  } else {
    await logInfo(`${logLabel}: workers de billing/faturamento desactivados (módulo billing off)`);
  }

  if (enableSubscriberAccessWorker) {
    await logInfo(`${logLabel}: Subscriber Access Notification Worker...`);
    const subscriberAccessNotificationWorker = new SubscriberAccessNotificationWorker();
    subscriberAccessNotificationWorker.start();
    (global as any).subscriberAccessNotificationWorker = subscriberAccessNotificationWorker;
  } else {
    await logInfo(`${logLabel}: Subscriber Access Notification Worker desactivado`);
  }

  if (enablePlaylistMix || enablePlaylistEngine) {
    await logInfo(`${logLabel}: Playlist Mix / Engine (conforme módulos)...`);
    if (enablePlaylistEngine) {
      const playlistEngineWorker = getPlaylistEngineWorkerInstance();
      playlistEngineWorker.start();
      (global as any).playlistEngineWorker = playlistEngineWorker;
    }
    if (enablePlaylistMix) {
      const { getPlaylistMixWorker } = await import('../workers/playlistMixWorker');
      const playlistMixWorker = getPlaylistMixWorker();
      playlistMixWorker.start();
      (global as any).playlistMixWorker = playlistMixWorker;
    }
  } else {
    await logInfo(`${logLabel}: Playlist Mix/Engine desactivados (playlists_advanced off)`);
  }

  if (enableBullQueues) {
    try {
      await logInfo(`${logLabel}: carregando agendamentos de export ativos...`);
      await exportScheduleService.loadAllActiveSchedules();
    } catch (error: any) {
      await logWarn(
        `${logLabel}: não foi possível carregar agendamentos de export (continuando): ${error.message || error}`
      );
    }
  }

  if (enableAlertCron) {
    await logInfo(`${logLabel}: verificação automática de alertas (cron 5 min)...`);
    cron.schedule('*/5 * * * *', async () => {
      try {
        const alertService = getAlertService();
        const alerts = await alertService.checkAllAlerts();

        for (const alert of alerts) {
          const rule = (alertService as any).alertRules?.find((r: any) => r.id === alert.ruleId);
          if (rule && rule.enabled && rule.channels.length > 0) {
            await alertService.sendAlert(alert, rule.channels);
          }
        }

        if (alerts.length > 0) {
          await logInfo(`${logLabel}: ${alerts.length} alerta(s) na verificação periódica`, {
            count: alerts.length,
          });
        }
      } catch (error: any) {
        await logError(`${logLabel}: erro na verificação automática de alertas`, error, {});
      }
    });
  } else {
    await logInfo(`${logLabel}: cron de alertas desactivado (dispatcher_admin / multi_agency off)`);
  }
}

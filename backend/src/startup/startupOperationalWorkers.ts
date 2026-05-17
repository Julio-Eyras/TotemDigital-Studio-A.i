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
  /** Filas Bull de exportação e agenda avançada (opcional no mono). */
  enableBullQueues: boolean;
  logLabel: string;
}

/**
 * Workers operacionais partilhados entre Pro e modo compacto (Studio).
 * Centraliza arranque para evitar divergência e regressões entre perfis.
 */
export async function initializeOperationalWorkers(
  options: OperationalWorkersOptions
): Promise<void> {
  const { redisEnabled, enableBullQueues, logLabel } = options;

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
  }

  await logInfo(`${logLabel}: Invoice Worker (Stripe/assinaturas)...`);
  const invoiceWorker = new InvoiceWorker();
  invoiceWorker.start();
  (global as any).invoiceWorker = invoiceWorker;

  const financialWorker = new FinancialBillingWorker();
  financialWorker.start();
  (global as any).financialBillingWorker = financialWorker;
  await logInfo(`${logLabel}: Financial Billing Worker ativo`);

  await logInfo(`${logLabel}: Subscriber Access Notification Worker...`);
  const subscriberAccessNotificationWorker = new SubscriberAccessNotificationWorker();
  subscriberAccessNotificationWorker.start();
  (global as any).subscriberAccessNotificationWorker = subscriberAccessNotificationWorker;

  await logInfo(`${logLabel}: Playlist Mix + Playlist Engine workers...`);
  const { getPlaylistMixWorker } = await import('../workers/playlistMixWorker');
  const playlistMixWorker = getPlaylistMixWorker();
  const playlistEngineWorker = getPlaylistEngineWorkerInstance();
  playlistEngineWorker.start();
  (global as any).playlistEngineWorker = playlistEngineWorker;
  playlistMixWorker.start();
  (global as any).playlistMixWorker = playlistMixWorker;

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
}

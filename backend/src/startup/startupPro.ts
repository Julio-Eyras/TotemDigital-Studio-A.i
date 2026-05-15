import cron from 'node-cron';
import {
  initializeExportQueue,
  initializeAdvancedScheduleQueue,
} from '../config/queue';
import { registerExportWorker } from '../workers/exportWorker';
import { registerAdvancedScheduleWorker } from '../workers/advancedScheduleWorker';
import { exportScheduleService } from '../services/exportScheduleService';
import { InvoiceWorker } from '../workers/invoiceWorker';
import { SubscriberAccessNotificationWorker } from '../workers/subscriberAccessNotificationWorker';
import { getPlaylistEngineWorkerInstance } from '../workers/playlistEngineWorker';
import { getAlertService } from '../services/alertService';
import { logInfo, logWarn, logError } from '../utils/loggerHelper';

interface ProStartupOptions {
  redisEnabled: boolean;
}

export async function initializeProStartup(options: ProStartupOptions): Promise<void> {
  if (options.redisEnabled) {
    try {
      await logInfo('Inicializando Bull Queue...');
      initializeExportQueue();
      registerExportWorker();

      await logInfo('Inicializando Bull Queue de Agendamento Avançado...');
      initializeAdvancedScheduleQueue();
      registerAdvancedScheduleWorker();
    } catch (error: any) {
      await logWarn('Erro ao inicializar Bull Queue, continuando sem filas', {
        error: error.message,
      });
    }
  } else {
    await logInfo('Modo Pro sem Redis: filas Bull não serão inicializadas');
  }

  await logInfo('Inicializando Invoice Worker...');
  const invoiceWorker = new InvoiceWorker();
  invoiceWorker.start();
  (global as any).invoiceWorker = invoiceWorker;

  const { FinancialBillingWorker } = await import('../workers/financialBillingWorker');
  const financialWorker = new FinancialBillingWorker();
  financialWorker.start();
  (global as any).financialBillingWorker = financialWorker;

  await logInfo('Inicializando Subscriber Access Notification Worker...');
  const subscriberAccessNotificationWorker = new SubscriberAccessNotificationWorker();
  subscriberAccessNotificationWorker.start();
  (global as any).subscriberAccessNotificationWorker = subscriberAccessNotificationWorker;

  await logInfo('Inicializando Playlist Mix Worker...');
  const { getPlaylistMixWorker } = await import('../workers/playlistMixWorker');
  const playlistMixWorker = getPlaylistMixWorker();

  await logInfo('Inicializando Playlist Engine Worker...');
  const playlistEngineWorker = getPlaylistEngineWorkerInstance();
  playlistEngineWorker.start();
  (global as any).playlistEngineWorker = playlistEngineWorker;
  playlistMixWorker.start();
  (global as any).playlistMixWorker = playlistMixWorker;

  try {
    await logInfo('Carregando agendamentos ativos...');
    await exportScheduleService.loadAllActiveSchedules();
  } catch (error: any) {
    await logWarn('Não foi possível carregar agendamentos (continuando): ' + (error.message || error));
  }

  await logInfo('Inicializando verificação automática de alertas...');
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
        await logInfo(`Verificação de alertas: ${alerts.length} alerta(s) encontrado(s)`, {
          count: alerts.length,
        });
      }
    } catch (error: any) {
      await logError('Erro na verificação automática de alertas', error, {});
    }
  });
}


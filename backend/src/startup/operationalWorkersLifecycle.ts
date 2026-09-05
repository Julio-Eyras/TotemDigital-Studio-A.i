/**
 * Ciclo de vida dos workers operacionais (boot + hot-reload Etapa F).
 * Evita double-start de crons/Bull e permite ligar/desligar sem reiniciar o processo.
 */
import cron, { ScheduledTask } from 'node-cron';
import {

  initializeExportQueue,
  initializeAdvancedScheduleQueue,
  closeExportQueue,
  closeAdvancedScheduleQueue,
} from '../config/queue';
import { registerExportWorker, resetExportWorkerRegistration } from '../workers/exportWorker';
import {
  registerAdvancedScheduleWorker,
  resetAdvancedScheduleWorkerRegistration,
} from '../workers/advancedScheduleWorker';
import { exportScheduleService } from '../services/exportScheduleService';
import { InvoiceWorker } from '../workers/invoiceWorker';
import { FinancialBillingWorker } from '../workers/financialBillingWorker';
import { SubscriberAccessNotificationWorker } from '../workers/subscriberAccessNotificationWorker';
import { getPlaylistEngineWorkerInstance } from '../workers/playlistEngineWorker';
import { getAlertService } from '../services/alertService';
import { logInfo, logWarn, logError } from '../utils/loggerHelper';
import { buildOperationalWorkerFlags } from '../policy/installationPolicy';
import type { InstallationCapabilities } from '../policy/installationPolicy';
import { normalizeError } from '../utils/errors';

export type WorkerRuntimeFlags = ReturnType<typeof buildOperationalWorkerFlags>;

export interface OperationalWorkersOptions {
  redisEnabled: boolean;
  enableBullQueues: boolean;
  enableBillingWorkers?: boolean;
  enablePlaylistMix?: boolean;
  enablePlaylistEngine?: boolean;
  enableAlertCron?: boolean;
  enableSubscriberAccessWorker?: boolean;
  logLabel: string;
}

type AppliedFlags = WorkerRuntimeFlags & { redisEnabled: boolean };

let applied: AppliedFlags | null = null;
let alertCronTask: ScheduledTask | null = null;
let purgeCronTask: ScheduledTask | null = null;
let reconcileLock: Promise<void> = Promise.resolve();

type WorkersGlobal = typeof globalThis & {
  invoiceWorker?: { stop?: () => void };
  financialBillingWorker?: { stop?: () => void };
  subscriberAccessNotificationWorker?: { stop?: () => void };
  playlistEngineWorker?: { stop?: () => void };
  playlistMixWorker?: { stop?: () => void };
  alertCronTask?: unknown;
  purgeCronTask?: unknown;
};

function g(): WorkersGlobal {
  return global as WorkersGlobal;
}

function normalizeFlags(options: OperationalWorkersOptions): AppliedFlags {
  return {
    redisEnabled: options.redisEnabled,
    enableBullQueues: Boolean(options.enableBullQueues && options.redisEnabled),
    enableBillingWorkers: options.enableBillingWorkers !== false,
    enablePlaylistMix: options.enablePlaylistMix !== false,
    enablePlaylistEngine: options.enablePlaylistEngine !== false,
    enableAlertCron: options.enableAlertCron !== false,
    enableSubscriberAccessWorker: options.enableSubscriberAccessWorker !== false,
  };
}

async function startBull(logLabel: string): Promise<void> {
  await logInfo(`${logLabel}: inicializando filas Bull (export + agenda avançada)...`);
  initializeExportQueue();
  registerExportWorker();
  initializeAdvancedScheduleQueue();
  registerAdvancedScheduleWorker();
  try {
    await exportScheduleService.loadAllActiveSchedules();} catch (error: unknown) {
    const e = normalizeError(error);
    await logWarn(
      `${logLabel}: não foi possível carregar agendamentos de export (continuando): ${e.message || error}`
    );
  }
}

async function stopBull(logLabel: string): Promise<void> {
  try {
    await closeExportQueue();
    resetExportWorkerRegistration();
    await closeAdvancedScheduleQueue();
    resetAdvancedScheduleWorkerRegistration();
    await logInfo(`${
      logLabel}: filas Bull fechadas`);} catch (error: unknown) {
    const e = normalizeError(error);
    await logWarn(`${logLabel}: erro ao fechar filas Bull`, { error: e.message });
  }
}

function startBilling(logLabel: string): void {
  const invoiceWorker = new InvoiceWorker();
  invoiceWorker.start();
  g().invoiceWorker = invoiceWorker;

  const financialWorker = new FinancialBillingWorker();
  financialWorker.start();
  g().financialBillingWorker = financialWorker;
  void logInfo(`${logLabel}: Invoice + Financial Billing workers activos`);
}

function stopBilling(logLabel: string): void {
  try {
    g().invoiceWorker?.stop?.();
  } catch {
    /* ignore */
  }
  g().invoiceWorker = undefined;
  try {
    g().financialBillingWorker?.stop?.();
  } catch {
    /* ignore */
  }
  g().financialBillingWorker = undefined;
  void logInfo(`${logLabel}: workers de billing parados`);
}

function startSubscriberAccess(logLabel: string): void {
  const worker = new SubscriberAccessNotificationWorker();
  worker.start();
  g().subscriberAccessNotificationWorker = worker;
  void logInfo(`${logLabel}: Subscriber Access Notification Worker activo`);
}

function stopSubscriberAccess(logLabel: string): void {
  try {
    g().subscriberAccessNotificationWorker?.stop?.();
  } catch {
    /* ignore */
  }
  g().subscriberAccessNotificationWorker = undefined;
  void logInfo(`${logLabel}: Subscriber Access Notification Worker parado`);
}

async function startPlaylistEngine(logLabel: string): Promise<void> {
  const playlistEngineWorker = getPlaylistEngineWorkerInstance();
  playlistEngineWorker.start();
  g().playlistEngineWorker = playlistEngineWorker;
  await logInfo(`${logLabel}: Playlist Engine activo`);
}

function stopPlaylistEngine(logLabel: string): void {
  try {
    g().playlistEngineWorker?.stop?.();
  } catch {
    /* ignore */
  }
  g().playlistEngineWorker = undefined;
  void logInfo(`${logLabel}: Playlist Engine parado`);
}

async function startPlaylistMix(logLabel: string): Promise<void> {
  const { getPlaylistMixWorker } = await import('../workers/playlistMixWorker');
  const playlistMixWorker = getPlaylistMixWorker();
  playlistMixWorker.start();
  g().playlistMixWorker = playlistMixWorker;
  await logInfo(`${logLabel}: Playlist Mix activo`);
}

function stopPlaylistMix(logLabel: string): void {
  try {
    g().playlistMixWorker?.stop?.();
  } catch {
    /* ignore */
  }
  g().playlistMixWorker = undefined;
  void logInfo(`${logLabel}: Playlist Mix parado`);
}

function startAlertCron(logLabel: string): void {
  if (alertCronTask) return;
  alertCronTask = cron.schedule('*/5 * * * *', async () => {
    try {
      const alertService = getAlertService();
      const alerts = await alertService.checkAllAlerts();
      for (const alert of alerts) {
        const svc = alertService as unknown as {
          alertRules?: Array<{ id?: string | number; enabled?: boolean; channels?: unknown[] }>;
        };
        const rule = svc.alertRules?.find((r) => r.id === alert.ruleId);
        if (rule && rule.enabled && rule.channels && rule.channels.length > 0) {
          await alertService.sendAlert(alert, rule.channels as string[]);
        }
      }
      if (alerts.length > 0) {
        await logInfo(`${logLabel}: ${alerts.length} alerta(s) na verificação periódica`, {
          count: alerts.length,
        });
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError(`${logLabel}: erro na verificação automática de alertas`, e.error, {});
    }
  });
  g().alertCronTask = alertCronTask;
  void logInfo(`${logLabel}: cron de alertas activo (*/5)`);
}

function stopAlertCron(logLabel: string): void {
  if (alertCronTask) {
    try {
      alertCronTask.stop();
    } catch {
      /* ignore */
    }
    alertCronTask = null;
  }
  g().alertCronTask = undefined;
  void logInfo(`${logLabel}: cron de alertas parado`);
}

/** Cron leve (1m) para purge comercial agendado — independente do master switch. */
function ensurePurgeScheduleCron(logLabel: string): void {
  if (purgeCronTask) return;
  purgeCronTask = cron.schedule('* * * * *', async () => {
    try {
      const { createDatabaseWrapper } = await import('../config/database-pg');
      const { tickPurgeSchedule } = await import('../services/commercialPurgeService');
      await tickPurgeSchedule(createDatabaseWrapper());} catch (error: unknown) {
      const e = normalizeError(error);
      await logError(`${logLabel}: erro no tick de purge agendado`, e.error, {});
    }
  });
  g().purgeCronTask = purgeCronTask;
  void logInfo(`${logLabel}: cron de purge comercial activo (* * * * *)`);
}

function stopPurgeScheduleCron(logLabel: string): void {
  if (purgeCronTask) {
    try {
      purgeCronTask.stop();
    } catch {
      /* ignore */
    }
    purgeCronTask = null;
  }
  g().purgeCronTask = undefined;
  void logInfo(`${logLabel}: cron de purge comercial parado`);
}

/**
 * Arranque inicial (boot). Idempotente via reconcile.
 */
export async function initializeOperationalWorkers(
  options: OperationalWorkersOptions
): Promise<void> {
  ensurePurgeScheduleCron(options.logLabel || 'Workers');
  await reconcileOperationalWorkers(normalizeFlags(options), options.logLabel || 'Workers');
}

/**
 * Para todos os workers operacionais (sem fechar Redis/DB).
 */
export async function stopOperationalWorkers(logLabel = 'Workers'): Promise<void> {
  stopPurgeScheduleCron(logLabel);
  stopAlertCron(logLabel);
  stopPlaylistMix(logLabel);
  stopPlaylistEngine(logLabel);
  stopSubscriberAccess(logLabel);
  stopBilling(logLabel);
  await stopBull(logLabel);
  applied = null;
}

/**
 * Ajusta workers ao estado desejado (diff vs applied).
 */
export async function reconcileOperationalWorkers(
  desired: AppliedFlags,
  logLabel = 'Workers'
): Promise<{ changed: boolean; applied: AppliedFlags }> {
  const run = async () => {
    const prev = applied;
    const next: AppliedFlags = {
      redisEnabled: desired.redisEnabled,
      enableBullQueues: Boolean(desired.enableBullQueues && desired.redisEnabled),
      enableBillingWorkers: Boolean(desired.enableBillingWorkers),
      enablePlaylistMix: Boolean(desired.enablePlaylistMix),
      enablePlaylistEngine: Boolean(desired.enablePlaylistEngine),
      enableAlertCron: Boolean(desired.enableAlertCron),
      enableSubscriberAccessWorker: Boolean(desired.enableSubscriberAccessWorker),
    };

    const same =
      prev &&
      prev.enableBullQueues === next.enableBullQueues &&
      prev.enableBillingWorkers === next.enableBillingWorkers &&
      prev.enablePlaylistMix === next.enablePlaylistMix &&
      prev.enablePlaylistEngine === next.enablePlaylistEngine &&
      prev.enableAlertCron === next.enableAlertCron &&
      prev.enableSubscriberAccessWorker === next.enableSubscriberAccessWorker;

    if (same) {
      ensurePurgeScheduleCron(logLabel);
      return { changed: false, applied: next };
    }

    await logInfo(`${logLabel}: reconcile workers`, { previous: prev, next });

    // STOP first (safe order)
    if (prev?.enableAlertCron && !next.enableAlertCron) stopAlertCron(logLabel);
    if (prev?.enablePlaylistMix && !next.enablePlaylistMix) stopPlaylistMix(logLabel);
    if (prev?.enablePlaylistEngine && !next.enablePlaylistEngine) stopPlaylistEngine(logLabel);
    if (prev?.enableSubscriberAccessWorker && !next.enableSubscriberAccessWorker) {
      stopSubscriberAccess(logLabel);
    }
    if (prev?.enableBillingWorkers && !next.enableBillingWorkers) stopBilling(logLabel);
    if (prev?.enableBullQueues && !next.enableBullQueues) await stopBull(logLabel);

    // START
    if (!prev?.enableBullQueues && next.enableBullQueues) {
      try {
        await startBull(logLabel);} catch (error: unknown) {
        const e = normalizeError(error);
        await logWarn(`${logLabel}: erro ao inicializar filas Bull (continuando)`, {
          error: e.message,
      });
      }
    } else if (!next.enableBullQueues && next.redisEnabled && !prev) {
      await logInfo(`${logLabel}: Redis ativo; filas Bull não solicitadas neste perfil`);
    }

    if (!prev?.enableBillingWorkers && next.enableBillingWorkers) startBilling(logLabel);
    else if (!next.enableBillingWorkers && !prev) {
      await logInfo(`${logLabel}: workers de billing/faturamento desactivados`);
    }

    if (!prev?.enableSubscriberAccessWorker && next.enableSubscriberAccessWorker) {
      startSubscriberAccess(logLabel);
    } else if (!next.enableSubscriberAccessWorker && !prev) {
      await logInfo(`${logLabel}: Subscriber Access Notification Worker desactivado`);
    }

    if (!prev?.enablePlaylistEngine && next.enablePlaylistEngine) {
      await startPlaylistEngine(logLabel);
    }
    if (!prev?.enablePlaylistMix && next.enablePlaylistMix) {
      await startPlaylistMix(logLabel);
    }
    if (
      !next.enablePlaylistMix &&
      !next.enablePlaylistEngine &&
      !prev
    ) {
      await logInfo(`${logLabel}: Playlist Mix/Engine desactivados`);
    }

    if (!prev?.enableAlertCron && next.enableAlertCron) startAlertCron(logLabel);
    else if (!next.enableAlertCron && !prev) {
      await logInfo(`${logLabel}: cron de alertas desactivado`);
    }

    ensurePurgeScheduleCron(logLabel);

    applied = next;
    return { changed: true, applied: next };
  };

  let result!: { changed: boolean; applied: AppliedFlags };
  reconcileLock = reconcileLock.then(async () => {
    result = await run();
  });
  await reconcileLock;
  return result;
}

/**
 * Reconcilia a partir das capabilities actuais (chamado após master switch).
 */
export async function reconcileWorkersFromCapabilities(
  caps: InstallationCapabilities,
  redisEnabled: boolean,
  logLabel = 'Hot-reload workers'
): Promise<{ changed: boolean; applied: AppliedFlags; ok: boolean; error?: string }> {
  try {
    const flags = buildOperationalWorkerFlags(caps);
    const result = await reconcileOperationalWorkers(
      {
        redisEnabled,
        ...flags,
        enableBullQueues: flags.enableBullQueues && redisEnabled,
      },
      logLabel
    );
    return {
      ...result, ok: true };} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Falha no hot-reload de workers', e.error);
    return {
      changed: false,
      applied: applied || {
        redisEnabled,
        enableBullQueues: false,
        enableBillingWorkers: false,
        enablePlaylistMix: false,
        enablePlaylistEngine: false,
        enableAlertCron: false,
        enableSubscriberAccessWorker: false,
  },
      ok: false,
      error: e.message || 'Erro no reconcile de workers',
    };
  }
}

export function getAppliedOperationalWorkerFlags(): AppliedFlags | null {
  return applied;
}

/** Só para testes. */
export function resetOperationalWorkersStateForTests(): void {
  applied = null;
  alertCronTask = null;
  purgeCronTask = null;
  reconcileLock = Promise.resolve();
}

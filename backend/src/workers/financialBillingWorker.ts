/**
 * Rotinas automáticas de administração financeira (modo compacto e Pro).
 */

import cron from 'node-cron';
import { financialConfig } from '../config/env';
import { getFinancialAdminService } from '../services/financialAdminService';
import { getFinancialNotificationService } from '../services/financialNotificationService';
import { resolveFinancialWorkerEnabled } from '../services/financialIntegrationConfigService';
import { logError, logInfo } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { normalizeError } from '../utils/errors';

export class FinancialBillingWorker {
  private jobs: cron.ScheduledTask[] = [];

  private async runIfWorkerEnabled(fn: () => Promise<void>): Promise<void> {
    if (!(await resolveFinancialWorkerEnabled())) {
      return;
    }
    await fn();
  }

  start(): void {
    if (this.jobs.length > 0) {
      logInfo('Financial Billing Worker já está em execução', {});
      return;
    }
    if (!financialConfig.workerEnabled) {
      logInfo('Financial Billing Worker desabilitado (FINANCIAL_WORKER_ENABLED=false)', {});
      return;
    }

    this.jobs.push(
      cron.schedule(financialConfig.cronIssueInvoices, async () => {
        await this.runIfWorkerEnabled(async () => {
          try {
            await logInfo('Financeiro: emissão automática de faturas por contrato', {
              autoRevenueShare: financialConfig.autoRevenueSharePayouts,
            });
            const result = await getFinancialAdminService().issueContractInvoices({
              includeRevenueSharePayouts: financialConfig.autoRevenueSharePayouts,
              revenueShareSinceDays: financialConfig.revenueShareSinceDays,
            });
            await logInfo('Financeiro: emissão concluída', result);} catch (error: unknown) {
            const e = normalizeError(error);
            await logError('Financeiro: erro na emissão automática', e.error);
          }
        });
      })
    );

    if (financialConfig.cronRevenueSharePayouts) {
      this.jobs.push(
        cron.schedule(financialConfig.cronRevenueSharePayouts, async () => {
          await this.runIfWorkerEnabled(async () => {
            try {
              await logInfo('Financeiro: repasses revenue share automáticos', {});
              const result = await getFinancialAdminService().issueRevenueSharePayouts({
                sinceDays: financialConfig.revenueShareSinceDays,
              });
              await logInfo('Financeiro: repasses concluídos', result);} catch (error: unknown) {
              const e = normalizeError(error);
              await logError('Financeiro: erro nos repasses revenue share', e.error);
            }
          });
        })
      );
    }

    this.jobs.push(
      cron.schedule(financialConfig.cronMarkOverdue, async () => {
        await this.runIfWorkerEnabled(async () => {
          try {
            const db = getDatabase();
            const sub = await db.executeRaw(`
            UPDATE subscriber_billing
            SET payment_status = 'overdue', updated_at = CURRENT_TIMESTAMP
            WHERE payment_status = 'pending' AND due_date < CURRENT_TIMESTAMP
          `);
            const pub = await db.executeRaw(`
            UPDATE publisher_billing
            SET payment_status = 'overdue', updated_at = CURRENT_TIMESTAMP
            WHERE payment_status = 'pending'
              AND direction = 'incoming'
              AND due_date < CURRENT_TIMESTAMP
          `);
            await logInfo('Financeiro: faturas marcadas como vencidas', {
              subscriber: sub.rowCount || 0,
              publisherIncoming: pub.rowCount || 0,
            });} catch (error: unknown) {
            const e = normalizeError(error);
            await logError('Financeiro: erro ao marcar vencidas', e.error);
          }
        });
      })
    );

    this.jobs.push(
      cron.schedule(financialConfig.cronSendReminders, async () => {
        await this.runIfWorkerEnabled(async () => {
          try {
            const result = await getFinancialNotificationService().sendPendingInvoiceReminders();
            await logInfo('Financeiro: lembretes por e-mail', result);} catch (error: unknown) {
            const e = normalizeError(error);
            await logError('Financeiro: erro nos lembretes', e.error);
          }
        });
      })
    );

    this.jobs.push(
      cron.schedule(financialConfig.cronEnforceOverdueBlocks, async () => {
        await this.runIfWorkerEnabled(async () => {
          try {
            const { getBillingEnforcementService } = await import('../services/billingEnforcementService');
            const result = await getBillingEnforcementService().enforceAutomaticBlocks();
            await logInfo('Financeiro: bloqueio automático por inadimplência', result);} catch (error: unknown) {
            const e = normalizeError(error);
            await logError('Financeiro: erro no bloqueio automático', e.error);
          }
        });
      })
    );

    logInfo('Financial Billing Worker iniciado', {
      issue: financialConfig.cronIssueInvoices,
      overdue: financialConfig.cronMarkOverdue,
      reminders: financialConfig.cronSendReminders,
      enforceBlocks: financialConfig.cronEnforceOverdueBlocks,
      autoRevenueShare: financialConfig.autoRevenueSharePayouts,
      revenueShareCron: financialConfig.cronRevenueSharePayouts || '(desativado)',
    });
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logInfo('Financial Billing Worker parado', {});
  }
}

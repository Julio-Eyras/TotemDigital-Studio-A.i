/**
 * Invoice Worker - Smart Signage v2.1
 * Worker para gerar faturas automáticas periodicamente
 */

import cron from 'node-cron';
import { InvoiceService } from '../services/invoiceService';
import { logInfo, logError } from '../utils/loggerHelper';

export class InvoiceWorker {
  private invoiceService: InvoiceService;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.invoiceService = new InvoiceService();
  }

  /**
   * Inicia o worker
   */
  start(): void {
    // Executar diariamente às 2h da manhã
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      try {
        await logInfo('Iniciando geração de faturas mensais', {});
        const result = await this.invoiceService.generateMonthlyInvoices();
        await logInfo('Geração de faturas mensais concluída', result);
      } catch (error: any) {
        await logError('Erro no worker de faturas mensais', error);
      }
    });

    logInfo('Invoice Worker iniciado', {
      schedules: [
        'Geração de faturas Stripe/assinaturas: 02:00 diariamente',
        'Marcação de vencidas: FinancialBillingWorker (FINANCIAL_CRON_OVERDUE)',
        'Lembretes por e-mail: FinancialBillingWorker (FINANCIAL_CRON_REMINDERS)',
      ],
    });
  }

  /**
   * Para o worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logInfo('Invoice Worker parado', {});
    }
  }
}


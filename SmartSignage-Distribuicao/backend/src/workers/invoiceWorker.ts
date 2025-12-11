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

    // Executar diariamente às 3h da manhã para marcar faturas vencidas
    cron.schedule('0 3 * * *', async () => {
      try {
        await logInfo('Iniciando marcação de faturas vencidas', {});
        const count = await this.invoiceService.markOverdueInvoices();
        await logInfo('Marcação de faturas vencidas concluída', { count });
      } catch (error: any) {
        await logError('Erro no worker de faturas vencidas', error);
      }
    });

    // Executar diariamente às 9h da manhã para enviar notificações
    cron.schedule('0 9 * * *', async () => {
      try {
        await logInfo('Iniciando envio de notificações de faturas', {});
        const sent = await this.invoiceService.sendInvoiceNotifications();
        await logInfo('Envio de notificações concluído', { sent });
      } catch (error: any) {
        await logError('Erro no worker de notificações de faturas', error);
      }
    });

    logInfo('Invoice Worker iniciado', {
      schedules: [
        'Geração de faturas: 02:00 diariamente',
        'Marcação de vencidas: 03:00 diariamente',
        'Notificações: 09:00 diariamente',
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


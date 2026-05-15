/**
 * Notificações financeiras (e-mail com link de faturamento e PIX).
 */

import { getDatabase } from '../config/database';
import { financialConfig } from '../config/env';
import { emailService } from './emailService';
import { buildPixCopyPaste } from '../utils/pixEmv';
import { logError, logInfo } from '../utils/loggerHelper';

export class FinancialNotificationService {
  private get db() {
    return getDatabase();
  }

  private billingUrl(billingId: number): string {
    const base = financialConfig.publicAppUrl.replace(/\/$/, '');
    return `${base}/billing?type=subscriber&invoice=${billingId}`;
  }

  private whatsappLink(text: string): string | null {
    const phone = financialConfig.whatsappNumber?.replace(/\D/g, '');
    if (!phone) return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async sendInvoicePaymentEmail(billingId: number): Promise<{ sent: boolean; reason?: string }> {
    try {
      const row = await this.db.findFirst(
        `
        SELECT
          sb.billing_id,
          sb.amount,
          sb.currency,
          sb.due_date,
          sb.invoice_number,
          sb.description,
          sb.payment_status,
          s.name AS subscriber_name,
          s.email AS subscriber_email
        FROM subscriber_billing sb
        JOIN subscribers s ON s.subscriber_id = sb.subscriber_id
        WHERE sb.billing_id = $1
      `,
        [billingId]
      );

      if (!row) return { sent: false, reason: 'Fatura não encontrada' };
      if (!row.subscriber_email) return { sent: false, reason: 'Anunciante sem e-mail' };
      if (row.payment_status === 'paid') return { sent: false, reason: 'Fatura já paga' };

      let pixBlock = '<p><em>PIX: configure FINANCIAL_PIX_KEY no servidor.</em></p>';
      if (financialConfig.pixKey?.trim()) {
        try {
          const copyPaste = buildPixCopyPaste({
            pixKey: financialConfig.pixKey,
            merchantName: financialConfig.pixMerchantName,
            merchantCity: financialConfig.pixMerchantCity,
            amount: Number(row.amount),
            txid: `F${billingId}`,
          });
          pixBlock = `<p><strong>PIX copia e cola:</strong><br/><code style="word-break:break-all">${copyPaste}</code></p>`;
        } catch {
          /* mantém mensagem padrão */
        }
      }
      const payUrl = this.billingUrl(billingId);
      const dueStr = row.due_date
        ? new Date(row.due_date).toLocaleDateString('pt-BR')
        : '—';
      const amountStr = Number(row.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: row.currency || 'BRL',
      });

      const waText = `Olá ${row.subscriber_name}, segue fatura ${row.invoice_number || billingId} no valor de ${amountStr}, vencimento ${dueStr}. Link: ${payUrl}`;
      const waLink = this.whatsappLink(waText);

      const html = `
        <p>Olá <strong>${row.subscriber_name}</strong>,</p>
        <p>Segue a cobrança <strong>${row.invoice_number || `#${billingId}`}</strong>:</p>
        <ul>
          <li>Valor: <strong>${amountStr}</strong></li>
          <li>Vencimento: <strong>${dueStr}</strong></li>
          <li>Descrição: ${row.description || '—'}</li>
        </ul>
        <p><a href="${payUrl}">Abrir faturamento no sistema</a></p>
        ${pixBlock}
        ${waLink ? `<p><a href="${waLink}">Enviar mensagem via WhatsApp</a></p>` : ''}
        <p>Atenciosamente,<br/>${financialConfig.pixMerchantName}</p>
      `;

      const result = await emailService.sendEmail({
        to: row.subscriber_email,
        subject: `Fatura ${row.invoice_number || billingId} — vencimento ${dueStr}`,
        html,
        text: `Fatura ${amountStr}, vencimento ${dueStr}. Acesse: ${payUrl}`,
      });

      if (result.success) {
        await logInfo('E-mail de fatura enviado', { billingId, to: row.subscriber_email });
        return { sent: true };
      }
      return { sent: false, reason: result.error || 'Falha no envio SMTP' };
    } catch (error: any) {
      await logError('Erro ao enviar e-mail de fatura', error, { billingId });
      return { sent: false, reason: error.message };
    }
  }

  /** Lembretes para faturas pendentes (vencidas ou a vencer em N dias). */
  async sendPendingInvoiceReminders(): Promise<{ sent: number; skipped: number }> {
    const days = financialConfig.dueSoonDays;
    const rows = await this.db.findMany(
      `
      SELECT billing_id
      FROM subscriber_billing sb
      JOIN subscribers s ON s.subscriber_id = sb.subscriber_id
      WHERE sb.payment_status IN ('pending', 'overdue')
        AND s.email IS NOT NULL
        AND sb.due_date IS NOT NULL
        AND (
          sb.due_date < CURRENT_DATE
          OR sb.due_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
        )
      ORDER BY sb.due_date ASC
      LIMIT 100
    `,
      [days]
    );

    let sent = 0;
    let skipped = 0;
    for (const row of rows) {
      const r = await this.sendInvoicePaymentEmail(Number(row.billing_id));
      if (r.sent) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }
}

let instance: FinancialNotificationService | null = null;

export function getFinancialNotificationService(): FinancialNotificationService {
  if (!instance) instance = new FinancialNotificationService();
  return instance;
}

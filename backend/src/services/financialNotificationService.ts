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

  private billingUrl(scope: 'subscriber' | 'publisher', billingId: number): string {
    const base = financialConfig.publicAppUrl.replace(/\/$/, '');
    return `${base}/billing?type=${scope}&invoice=${billingId}`;
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
      const payUrl = this.billingUrl('subscriber', billingId);
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

  async sendPublisherPaymentEmail(billingId: number): Promise<{ sent: boolean; reason?: string }> {
    try {
      const row = await this.db.findFirst(
        `
        SELECT
          pb.billing_id,
          pb.amount,
          pb.currency,
          pb.due_date,
          pb.invoice_number,
          pb.description,
          pb.payment_status,
          pb.direction,
          p.name AS publisher_name,
          p.email AS publisher_email
        FROM publisher_billing pb
        JOIN publishers p ON p.publisher_id = pb.publisher_id
        WHERE pb.billing_id = $1
      `,
        [billingId]
      );

      if (!row) return { sent: false, reason: 'Fatura não encontrada' };
      if (row.direction !== 'incoming') {
        return { sent: false, reason: 'Fatura de saída (repasse) não usa cobrança PIX' };
      }
      if (!row.publisher_email) return { sent: false, reason: 'Exibidor sem e-mail' };
      if (row.payment_status === 'paid') return { sent: false, reason: 'Fatura já paga' };

      let pixBlock = '<p><em>PIX: configure FINANCIAL_PIX_KEY no servidor.</em></p>';
      if (financialConfig.pixKey?.trim()) {
        try {
          const copyPaste = buildPixCopyPaste({
            pixKey: financialConfig.pixKey,
            merchantName: financialConfig.pixMerchantName,
            merchantCity: financialConfig.pixMerchantCity,
            amount: Number(row.amount),
            txid: `P${billingId}`,
          });
          pixBlock = `<p><strong>PIX copia e cola:</strong><br/><code style="word-break:break-all">${copyPaste}</code></p>`;
        } catch {
          /* mantém mensagem padrão */
        }
      }

      const payUrl = this.billingUrl('publisher', billingId);
      const dueStr = row.due_date ? new Date(row.due_date).toLocaleDateString('pt-BR') : '—';
      const amountStr = Number(row.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: row.currency || 'BRL',
      });
      const waText = `Olá ${row.publisher_name}, fatura ${row.invoice_number || billingId}: ${amountStr}, venc. ${dueStr}. ${payUrl}`;
      const waLink = this.whatsappLink(waText);

      const html = `
        <p>Olá <strong>${row.publisher_name}</strong>,</p>
        <p>Cobrança <strong>${row.invoice_number || `#${billingId}`}</strong> (exibidor):</p>
        <ul>
          <li>Valor: <strong>${amountStr}</strong></li>
          <li>Vencimento: <strong>${dueStr}</strong></li>
          <li>Descrição: ${row.description || '—'}</li>
        </ul>
        <p><a href="${payUrl}">Abrir faturamento no sistema</a></p>
        ${pixBlock}
        ${waLink ? `<p><a href="${waLink}">WhatsApp</a></p>` : ''}
        <p>Atenciosamente,<br/>${financialConfig.pixMerchantName}</p>
      `;

      const result = await emailService.sendEmail({
        to: row.publisher_email,
        subject: `Fatura exibidor ${row.invoice_number || billingId} — venc. ${dueStr}`,
        html,
        text: `Fatura ${amountStr}, venc. ${dueStr}. ${payUrl}`,
      });

      if (result.success) {
        await logInfo('E-mail de fatura (exibidor) enviado', { billingId, to: row.publisher_email });
        return { sent: true };
      }
      return { sent: false, reason: result.error || 'Falha no envio SMTP' };
    } catch (error: any) {
      await logError('Erro ao enviar e-mail de fatura (exibidor)', error, { billingId });
      return { sent: false, reason: error.message };
    }
  }

  /** Lembretes para faturas pendentes (anunciantes + exibidor incoming). */
  async sendPendingInvoiceReminders(): Promise<{ sent: number; skipped: number }> {
    const days = financialConfig.dueSoonDays;
    const subRows = await this.db.findMany(
      `
      SELECT billing_id, 'subscriber' AS scope
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
      LIMIT 50
    `,
      [days]
    );

    const pubRows = await this.db.findMany(
      `
      SELECT billing_id, 'publisher' AS scope
      FROM publisher_billing pb
      JOIN publishers p ON p.publisher_id = pb.publisher_id
      WHERE pb.direction = 'incoming'
        AND pb.payment_status IN ('pending', 'overdue')
        AND p.email IS NOT NULL
        AND pb.due_date IS NOT NULL
        AND (
          pb.due_date < CURRENT_DATE
          OR pb.due_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
        )
      ORDER BY pb.due_date ASC
      LIMIT 50
    `,
      [days]
    );

    let sent = 0;
    let skipped = 0;
    for (const row of [...subRows, ...pubRows]) {
      const r =
        row.scope === 'publisher'
          ? await this.sendPublisherPaymentEmail(Number(row.billing_id))
          : await this.sendInvoicePaymentEmail(Number(row.billing_id));
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

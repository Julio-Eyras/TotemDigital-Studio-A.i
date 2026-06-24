/**
 * Notificações financeiras (e-mail com link de faturamento e PIX).
 */

import { getDatabase } from '../config/database';
import { financialConfig } from '../config/env';
import { emailService } from './emailService';
import { buildPixCopyPaste } from '../utils/pixEmv';
import { logError, logInfo } from '../utils/loggerHelper';
import {
  DEFAULT_OVERDUE_BLOCK_EMAIL_BODY,
  DEFAULT_OVERDUE_BLOCK_EMAIL_SUBJECT,
  DEFAULT_OVERDUE_BLOCK_WHATSAPP_MESSAGE,
  renderBillingTemplate,
} from '../utils/billingTemplateRenderer';
import { SettingsService } from './settingsService';
import { getWhatsappMessagingService } from './whatsappMessagingService';
import type { OverdueBillingSummary } from '../types/billingEnforcementTypes';

export class FinancialNotificationService {
  private settingsService = new SettingsService();

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

  /**
   * Aviso de repasse à organização (outgoing / revenue_share). Sem PIX — informativo para pagamento manual.
   */
  async sendPublisherRevenueSharePayoutEmail(
    billingId: number
  ): Promise<{ sent: boolean; reason?: string }> {
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
          pb.billing_type,
          p.name AS publisher_name,
          p.email AS publisher_email
        FROM publisher_billing pb
        JOIN publishers p ON p.publisher_id = pb.publisher_id
        WHERE pb.billing_id = $1
      `,
        [billingId]
      );

      if (!row) return { sent: false, reason: 'Fatura não encontrada' };
      if (row.direction !== 'outgoing') {
        return { sent: false, reason: 'Apenas repasses (saída) podem usar este aviso' };
      }
      if (!row.publisher_email) return { sent: false, reason: 'Organização sem e-mail' };
      if (row.payment_status === 'paid') {
        return { sent: false, reason: 'Repasse já marcado como pago' };
      }

      const payUrl = this.billingUrl('publisher', billingId);
      const dueStr = row.due_date ? new Date(row.due_date).toLocaleDateString('pt-BR') : '—';
      const amountStr = Number(row.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: row.currency || 'BRL',
      });
      const waText = `Olá ${row.publisher_name}, repasse ${row.invoice_number || billingId}: ${amountStr}, previsto até ${dueStr}. Detalhes: ${payUrl}`;
      const waLink = this.whatsappLink(waText);

      const html = `
        <p>Olá <strong>${row.publisher_name}</strong>,</p>
        <p>Foi registado um <strong>repasse (revenue share)</strong> a pagar:</p>
        <ul>
          <li>Referência: <strong>${row.invoice_number || `#${billingId}`}</strong></li>
          <li>Valor: <strong>${amountStr}</strong></li>
          <li>Previsão de pagamento: <strong>${dueStr}</strong></li>
          <li>Descrição: ${row.description || '—'}</li>
        </ul>
        <p><a href="${payUrl}">Ver repasses no painel de faturamento</a></p>
        <p><em>Este repasse é pago pela plataforma à organização (não é cobrança PIX à organização).</em></p>
        ${waLink ? `<p><a href="${waLink}">WhatsApp</a></p>` : ''}
        <p>Atenciosamente,<br/>${financialConfig.pixMerchantName}</p>
      `;

      const result = await emailService.sendEmail({
        to: row.publisher_email,
        subject: `Repasse organização ${row.invoice_number || billingId} — ${amountStr}`,
        html,
        text: `Repasse ${amountStr}, previsão ${dueStr}. Painel: ${payUrl}`,
      });

      if (result.success) {
        await logInfo('E-mail de repasse (organização) enviado', { billingId, to: row.publisher_email });
        return { sent: true };
      }
      return { sent: false, reason: result.error || 'Falha no envio SMTP' };
    } catch (error: any) {
      await logError('Erro ao enviar e-mail de repasse', error, { billingId });
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
          pb.billing_type,
          p.name AS publisher_name,
          p.email AS publisher_email
        FROM publisher_billing pb
        JOIN publishers p ON p.publisher_id = pb.publisher_id
        WHERE pb.billing_id = $1
      `,
        [billingId]
      );

      if (!row) return { sent: false, reason: 'Fatura não encontrada' };
      if (row.direction === 'outgoing') {
        return this.sendPublisherRevenueSharePayoutEmail(billingId);
      }
      if (!row.publisher_email) return { sent: false, reason: 'Organização sem e-mail' };
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
        <p>Cobrança <strong>${row.invoice_number || `#${billingId}`}</strong> (organização):</p>
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
        subject: `Fatura organização ${row.invoice_number || billingId} — venc. ${dueStr}`,
        html,
        text: `Fatura ${amountStr}, venc. ${dueStr}. ${payUrl}`,
      });

      if (result.success) {
        await logInfo('E-mail de fatura (organização) enviado', { billingId, to: row.publisher_email });
        return { sent: true };
      }
      return { sent: false, reason: result.error || 'Falha no envio SMTP' };
    } catch (error: any) {
      await logError('Erro ao enviar e-mail de fatura (organização)', error, { billingId });
      return { sent: false, reason: error.message };
    }
  }

  /** Lembretes para faturas pendentes (anunciantes + organização incoming). */
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

    const repasseRows = await this.db.findMany(
      `
      SELECT billing_id, 'repasse' AS scope
      FROM publisher_billing pb
      JOIN publishers p ON p.publisher_id = pb.publisher_id
      WHERE pb.direction = 'outgoing'
        AND pb.billing_type = 'revenue_share'
        AND pb.payment_status = 'pending_payout'
        AND p.email IS NOT NULL
        AND pb.due_date IS NOT NULL
        AND (
          pb.due_date < CURRENT_DATE
          OR pb.due_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
        )
      ORDER BY pb.due_date ASC
      LIMIT 25
    `,
      [days]
    );

    let sent = 0;
    let skipped = 0;
    for (const row of [...subRows, ...pubRows, ...repasseRows]) {
      const r =
        row.scope === 'repasse'
          ? await this.sendPublisherRevenueSharePayoutEmail(Number(row.billing_id))
          : row.scope === 'publisher'
            ? await this.sendPublisherPaymentEmail(Number(row.billing_id))
            : await this.sendInvoicePaymentEmail(Number(row.billing_id));
      if (r.sent) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }

  private async readTemplateSetting(key: string, fallback: string): Promise<string> {
    try {
      const row = await this.settingsService.getSetting(key);
      const value = String(row?.value ?? '').trim();
      return value || fallback;
    } catch {
      return fallback;
    }
  }

  private async isNotifyChannelEnabled(key: string, fallback = true): Promise<boolean> {
    try {
      const row = await this.settingsService.getSetting(key);
      if (row?.value === undefined || row?.value === null) return fallback;
      const v = String(row.value).trim().toLowerCase();
      return v === 'true' || v === '1';
    } catch {
      return fallback;
    }
  }

  private buildBillingListLines(summary: OverdueBillingSummary): string {
    return summary.items
      .map((item) => {
        const amount = Number(item.amount).toLocaleString('pt-BR', {
          style: 'currency',
          currency: item.currency || 'BRL',
        });
        const due = item.dueDate
          ? new Date(item.dueDate).toLocaleDateString('pt-BR')
          : '—';
        return `• ${item.description} — ${amount} — venc. ${due} (${item.daysOverdue} dia(s) em atraso)`;
      })
      .join('\n');
  }

  private buildTemplateVars(
    subscriberName: string,
    summary: OverdueBillingSummary
  ): Record<string, string | number> {
    const amountTotal = summary.totalAmount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: summary.currency || 'BRL',
    });
    const billingUrl = `${financialConfig.publicAppUrl.replace(/\/$/, '')}/billing?type=subscriber&dueFilter=overdue`;
    return {
      subscriber_name: subscriberName,
      overdue_count: summary.count,
      amount_total: amountTotal,
      grace_days: summary.graceDays,
      days_overdue: summary.maxDaysOverdue,
      billing_url: billingUrl,
      invoice_list: this.buildBillingListLines(summary),
      merchant_name: financialConfig.pixMerchantName,
    };
  }

  /**
   * E-mail + WhatsApp padronizados quando o bloqueio automático entra em vigor.
   */
  async sendOverdueBlockNotification(
    subscriberId: number,
    summary: OverdueBillingSummary
  ): Promise<{ sent: boolean; channels: string[]; reason?: string }> {
    try {
      const row = await this.db.findFirst(
        `
        SELECT subscriber_id, name, email, whatsapp
        FROM subscribers
        WHERE subscriber_id = $1
        `,
        [subscriberId]
      );

      if (!row) return { sent: false, channels: [], reason: 'Anunciante não encontrado' };

      const subscriberName = String(row.name || '').trim() || `Anunciante #${subscriberId}`;
      const vars = this.buildTemplateVars(subscriberName, summary);

      const emailEnabled = await this.isNotifyChannelEnabled(
        'financial.notify_block_email_enabled',
        true
      );
      const whatsappEnabled = await this.isNotifyChannelEnabled(
        'financial.notify_block_whatsapp_enabled',
        true
      );

      const subjectTemplate = await this.readTemplateSetting(
        'financial.overdue_block_email_subject',
        DEFAULT_OVERDUE_BLOCK_EMAIL_SUBJECT
      );
      const bodyTemplate = await this.readTemplateSetting(
        'financial.overdue_block_email_body',
        DEFAULT_OVERDUE_BLOCK_EMAIL_BODY
      );
      const whatsappTemplate = await this.readTemplateSetting(
        'financial.overdue_block_whatsapp_message',
        DEFAULT_OVERDUE_BLOCK_WHATSAPP_MESSAGE
      );

      const subject = renderBillingTemplate(subjectTemplate, vars);
      const bodyText = renderBillingTemplate(bodyTemplate, vars);
      const whatsappText = renderBillingTemplate(whatsappTemplate, vars);

      const channels: string[] = [];

      if (emailEnabled && row.email) {
        const waService = getWhatsappMessagingService();
        const merchantWa = waService.merchantContactLink(whatsappText);
        const subscriberWa = row.whatsapp
          ? waService.buildLink(String(row.whatsapp), whatsappText)
          : null;

        const htmlBody = bodyText
          .split('\n')
          .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
          .join('');

        const html = `
          ${htmlBody}
          <p><a href="${vars.billing_url}">Abrir faturamento</a></p>
          ${subscriberWa ? `<p><a href="${subscriberWa}">WhatsApp para o anunciante (wa.me)</a></p>` : ''}
          ${merchantWa ? `<p><a href="${merchantWa}">Falar com o financeiro no WhatsApp</a></p>` : ''}
        `;

        const result = await emailService.sendEmail({
          to: row.email,
          subject,
          html,
          text: bodyText,
        });

        if (result.success) {
          channels.push('email');
          await logInfo('E-mail de bloqueio por inadimplência enviado', {
            subscriberId,
            to: row.email,
          });
        }
      }

      if (whatsappEnabled && row.whatsapp) {
        const waResult = await getWhatsappMessagingService().sendTextMessage(
          String(row.whatsapp),
          whatsappText
        );
        if (waResult.sent) {
          channels.push('whatsapp_api');
        } else if (waResult.waMeUrl) {
          channels.push('whatsapp_wa_me');
          await logInfo('WhatsApp bloqueio: link wa.me (API não configurada ou falhou)', {
            subscriberId,
            reason: waResult.reason,
          });
        }
      }

      if (channels.length === 0) {
        return {
          sent: false,
          channels: [],
          reason: 'Sem e-mail/WhatsApp do anunciante ou canais desabilitados',
        };
      }

      return { sent: true, channels };
    } catch (error: any) {
      await logError('Erro ao enviar notificação de bloqueio financeiro', error, { subscriberId });
      return { sent: false, channels: [], reason: error.message };
    }
  }
}

let instance: FinancialNotificationService | null = null;

export function getFinancialNotificationService(): FinancialNotificationService {
  if (!instance) instance = new FinancialNotificationService();
  return instance;
}

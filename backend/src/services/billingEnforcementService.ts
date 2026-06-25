/**
 * Bloqueio operacional por inadimplência (prestações vencidas do anunciante).
 */

import { getDatabase } from '../config/database';
import { SettingsService } from './settingsService';
import { getCampaignService } from './campaignService';
import { getFinancialNotificationService } from './financialNotificationService';
import { getPlaylistEngineServiceInstance } from './playlistEngineService';
import { logError, logInfo } from '../utils/loggerHelper';
import type { OverdueBillingItem, OverdueBillingSummary } from '../types/billingEnforcementTypes';

export class BillingOverduePublishError extends Error {
  readonly code = 'BILLING_OVERDUE';

  constructor(
    message: string,
    public readonly summary: OverdueBillingSummary
  ) {
    super(message);
    this.name = 'BillingOverduePublishError';
  }
}

const ADMIN_OVERRIDE_ROLES = new Set(['owner_system', 'admin_sql', 'admin']);
const SYSTEM_ENFORCEMENT_USER_ID = 0;

let billingEnforcementServiceInstance: BillingEnforcementService | null = null;

export class BillingEnforcementService {
  private settingsService = new SettingsService();

  private get db() {
    return getDatabase();
  }

  private parseBooleanSetting(raw: unknown, fallback: boolean): boolean {
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return fallback;
  }

  private parseNumberSetting(raw: unknown, fallback: number): number {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
  }

  async getBlockGraceDays(): Promise<number> {
    try {
      const setting = await this.settingsService.getSetting('financial.block_publish_overdue_grace_days');
      return this.parseNumberSetting(setting?.value, 0);
    } catch {
      return 0;
    }
  }

  async isBlockPublishOnOverdueEnabled(): Promise<boolean> {
    try {
      const setting = await this.settingsService.getSetting('financial.block_publish_on_overdue');
      return this.parseBooleanSetting(setting?.value, true);
    } catch {
      return true;
    }
  }

  async isAdminOverrideEnabled(): Promise<boolean> {
    try {
      const setting = await this.settingsService.getSetting('financial.admin_override_overdue_block');
      return this.parseBooleanSetting(setting?.value, true);
    } catch {
      return true;
    }
  }

  async isAutoPauseCampaignsEnabled(): Promise<boolean> {
    try {
      const setting = await this.settingsService.getSetting('financial.auto_pause_campaigns_on_block');
      return this.parseBooleanSetting(setting?.value, true);
    } catch {
      return true;
    }
  }

  /**
   * Prestações vencidas que já ultrapassaram a tolerância (grace days).
   * grace=0 → bloqueia no 1º dia após vencimento.
   */
  async getSubscriberBlockingBillings(subscriberId: number): Promise<OverdueBillingSummary> {
    const sid = Number(subscriberId);
    const graceDays = await this.getBlockGraceDays();
    if (!Number.isInteger(sid) || sid <= 0) {
      return {
        count: 0,
        totalAmount: 0,
        currency: 'BRL',
        graceDays,
        maxDaysOverdue: 0,
        items: [],
      };
    }

    const rows = await this.db.findMany(
      `
      SELECT
        sb.billing_id,
        sb.description,
        sb.amount,
        sb.currency,
        sb.due_date,
        GREATEST(0, (CURRENT_DATE - sb.due_date::date)) AS days_overdue
      FROM subscriber_billing sb
      WHERE sb.subscriber_id = $1
        AND sb.payment_status NOT IN ('paid', 'cancelled', 'refunded')
        AND sb.payment_status IN ('pending', 'overdue')
        AND sb.due_date IS NOT NULL
        AND sb.due_date::date < CURRENT_DATE
        AND GREATEST(0, (CURRENT_DATE - sb.due_date::date)) >= $2
      ORDER BY sb.due_date ASC
      `,
      [sid, graceDays]
    );

    const items: OverdueBillingItem[] = (rows || []).map((row: any) => ({
      billingId: Number(row.billing_id),
      description: String(row.description || '').trim() || `Fatura #${row.billing_id}`,
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'BRL').toUpperCase(),
      dueDate: row.due_date ? String(row.due_date) : null,
      daysOverdue: Number(row.days_overdue || 0),
    }));

    const currency = items[0]?.currency || 'BRL';
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const maxDaysOverdue = items.reduce((max, item) => Math.max(max, item.daysOverdue), 0);

    return {
      count: items.length,
      totalAmount,
      currency,
      graceDays,
      maxDaysOverdue,
      items,
    };
  }

  /** Compatibilidade: todas vencidas (sem grace) — semáforo / alertas. */
  async getSubscriberOverdueBillings(subscriberId: number): Promise<OverdueBillingSummary> {
    const graceDays = 0;
    const sid = Number(subscriberId);
    if (!Number.isInteger(sid) || sid <= 0) {
      return { count: 0, totalAmount: 0, currency: 'BRL', graceDays, maxDaysOverdue: 0, items: [] };
    }

    const rows = await this.db.findMany(
      `
      SELECT
        sb.billing_id,
        sb.description,
        sb.amount,
        sb.currency,
        sb.due_date,
        GREATEST(0, (CURRENT_DATE - sb.due_date::date)) AS days_overdue
      FROM subscriber_billing sb
      WHERE sb.subscriber_id = $1
        AND sb.payment_status NOT IN ('paid', 'cancelled', 'refunded')
        AND sb.payment_status IN ('pending', 'overdue')
        AND sb.due_date IS NOT NULL
        AND sb.due_date::date < CURRENT_DATE
      ORDER BY sb.due_date ASC
      `,
      [sid]
    );

    const items: OverdueBillingItem[] = (rows || []).map((row: any) => ({
      billingId: Number(row.billing_id),
      description: String(row.description || '').trim() || `Fatura #${row.billing_id}`,
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'BRL').toUpperCase(),
      dueDate: row.due_date ? String(row.due_date) : null,
      daysOverdue: Number(row.days_overdue || 0),
    }));

    const currency = items[0]?.currency || 'BRL';
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const maxDaysOverdue = items.reduce((max, item) => Math.max(max, item.daysOverdue), 0);

    return { count: items.length, totalAmount, currency, graceDays, maxDaysOverdue, items };
  }

  async isSubscriberPublishBlocked(subscriberId: number): Promise<boolean> {
    const blockEnabled = await this.isBlockPublishOnOverdueEnabled();
    if (!blockEnabled) return false;
    const summary = await this.getSubscriberBlockingBillings(subscriberId);
    return summary.count > 0;
  }

  private canAdminOverride(userRole?: string, adminOverrideEnabled?: boolean): boolean {
    if (!adminOverrideEnabled) return false;
    const role = String(userRole || '').trim().toLowerCase();
    return ADMIN_OVERRIDE_ROLES.has(role);
  }

  async assertSubscriberCanPublish(subscriberId: number, userRole?: string): Promise<void> {
    const blockEnabled = await this.isBlockPublishOnOverdueEnabled();
    if (!blockEnabled) return;

    const adminOverrideEnabled = await this.isAdminOverrideEnabled();
    if (this.canAdminOverride(userRole, adminOverrideEnabled)) return;

    const summary = await this.getSubscriberBlockingBillings(subscriberId);
    if (summary.count === 0) return;

    const first = summary.items[0];
    const amountLabel = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: summary.currency || 'BRL',
    }).format(summary.totalAmount);

    const graceHint =
      summary.graceDays > 0
        ? ` (tolerância de ${summary.graceDays} dia(s) excedida)`
        : '';

    throw new BillingOverduePublishError(
      `Publicação bloqueada: ${summary.count} prestação(ões) em atraso${graceHint} — total ${amountLabel}. ` +
        `Regularize em Faturamento antes de publicar.` +
        (first?.description ? ` Ex.: ${first.description}.` : ''),
      summary
    );
  }

  private async wasBlockNotificationSent(billingId: number): Promise<boolean> {
    const row = await this.db.findFirst(
      `SELECT metadata FROM subscriber_billing WHERE billing_id = $1`,
      [billingId]
    );
    const meta = row?.metadata;
    if (!meta || typeof meta !== 'object') return false;
    return Boolean((meta as any).block_notified_at);
  }

  private async markBlockNotificationSent(billingId: number, extra: Record<string, unknown>): Promise<void> {
    await this.db.executeRaw(
      `
      UPDATE subscriber_billing
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE billing_id = $1
      `,
      [billingId, JSON.stringify({ block_notified_at: new Date().toISOString(), ...extra })]
    );
  }

  private async pauseSubscriberActiveCampaigns(subscriberId: number): Promise<number> {
    const campaigns = await this.db.findMany(
      `
      SELECT campaign_id
      FROM campaigns
      WHERE subscriber_id = $1
        AND COALESCE(is_active, false) = true
        AND status IN ('active', 'approved')
      `,
      [subscriberId]
    );

    const campaignService = getCampaignService();
    let paused = 0;
    for (const row of campaigns) {
      const campaignId = Number(row.campaign_id);
      if (!Number.isInteger(campaignId) || campaignId <= 0) continue;
      try {
        await campaignService.pauseCampaign(campaignId, SYSTEM_ENFORCEMENT_USER_ID);
        paused += 1;
      } catch (error: any) {
        if (!String(error?.message || '').includes('já está inativa')) {
          await logError('Erro ao pausar campanha por inadimplência', error, { campaignId, subscriberId });
        }
      }
    }
    return paused;
  }

  private async regenerateTotemsForSubscriber(subscriberId: number): Promise<number> {
    const rows = await this.db.findMany(
      `
      SELECT DISTINCT ct.totem_id
      FROM campaign_totems ct
      JOIN campaigns c ON c.campaign_id = ct.campaign_id
      WHERE c.subscriber_id = $1
        AND ct.totem_id IS NOT NULL
      `,
      [subscriberId]
    );

    const engine = getPlaylistEngineServiceInstance();
    let count = 0;
    for (const row of rows) {
      const totemId = Number(row.totem_id);
      if (!Number.isInteger(totemId) || totemId <= 0) continue;
      try {
        await engine.generatePlaylistForTotem(totemId, undefined, true);
        count += 1;
      } catch (error) {
        await logError('Erro ao regenerar mix após bloqueio financeiro', error, { totemId, subscriberId });
      }
    }
    return count;
  }

  /**
   * Rotina automática: pausa campanhas, envia e-mail/WhatsApp padronizados, regenera mix.
   */
  async enforceAutomaticBlocks(): Promise<{
    subscribersChecked: number;
    notificationsSent: number;
    campaignsPaused: number;
    totemsRegenerated: number;
    skippedAlreadyNotified: number;
  }> {
    const blockEnabled = await this.isBlockPublishOnOverdueEnabled();
    if (!blockEnabled) {
      return {
        subscribersChecked: 0,
        notificationsSent: 0,
        campaignsPaused: 0,
        totemsRegenerated: 0,
        skippedAlreadyNotified: 0,
      };
    }

    const graceDays = await this.getBlockGraceDays();
    const autoPause = await this.isAutoPauseCampaignsEnabled();

    const subscriberRows = await this.db.findMany(
      `
      SELECT DISTINCT sb.subscriber_id
      FROM subscriber_billing sb
      JOIN subscribers s ON s.subscriber_id = sb.subscriber_id
      WHERE s.is_active = true
        AND sb.payment_status NOT IN ('paid', 'cancelled', 'refunded')
        AND sb.payment_status IN ('pending', 'overdue')
        AND sb.due_date IS NOT NULL
        AND sb.due_date::date < CURRENT_DATE
        AND GREATEST(0, (CURRENT_DATE - sb.due_date::date)) >= $1
      `,
      [graceDays]
    );

    let notificationsSent = 0;
    let campaignsPaused = 0;
    let totemsRegenerated = 0;
    let skippedAlreadyNotified = 0;

    const notificationService = getFinancialNotificationService();

    for (const row of subscriberRows) {
      const subscriberId = Number(row.subscriber_id);
      if (!Number.isInteger(subscriberId) || subscriberId <= 0) continue;

      const summary = await this.getSubscriberBlockingBillings(subscriberId);
      if (summary.count === 0) continue;

      const primaryBillingId = summary.items[0]?.billingId;
      if (primaryBillingId && (await this.wasBlockNotificationSent(primaryBillingId))) {
        skippedAlreadyNotified += 1;
        continue;
      }

      if (autoPause) {
        campaignsPaused += await this.pauseSubscriberActiveCampaigns(subscriberId);
        totemsRegenerated += await this.regenerateTotemsForSubscriber(subscriberId);
      }

      const notifyResult = await notificationService.sendOverdueBlockNotification(
        subscriberId,
        summary
      );

      if (notifyResult.sent && primaryBillingId) {
        await this.markBlockNotificationSent(primaryBillingId, {
          grace_days: summary.graceDays,
          campaigns_paused: campaignsPaused,
          channels: notifyResult.channels,
        });
        notificationsSent += 1;
        await logInfo('Bloqueio financeiro aplicado ao anunciante', {
          subscriberId,
          graceDays: summary.graceDays,
          overdueCount: summary.count,
          channels: notifyResult.channels,
        });
      }
    }

    return {
      subscribersChecked: subscriberRows.length,
      notificationsSent,
      campaignsPaused,
      totemsRegenerated,
      skippedAlreadyNotified,
    };
  }
}

export function getBillingEnforcementService(): BillingEnforcementService {
  if (!billingEnforcementServiceInstance) {
    billingEnforcementServiceInstance = new BillingEnforcementService();
  }
  return billingEnforcementServiceInstance;
}

export type { OverdueBillingItem, OverdueBillingSummary } from '../types/billingEnforcementTypes';

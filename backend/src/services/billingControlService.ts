/**
 * Painel unificado de faturamento (subscriber + publisher billing + contratos).
 * Sem dependência da tabela legada `billing`.
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { SubscriberBillingService } from './subscriberBillingService';
import { PublisherBillingService } from './publisherBillingService';
import { normalizeError } from '../utils/errors';

function getSubscriberBillingService(): SubscriberBillingService {
  if (!(global as unknown as Record<string, unknown>).subscriberBillingServiceInstance) {
    (global as unknown as Record<string, unknown>).subscriberBillingServiceInstance = new SubscriberBillingService();
  }
  return (global as unknown as Record<string, unknown>).subscriberBillingServiceInstance as SubscriberBillingService;
}

function getPublisherBillingService(): PublisherBillingService {
  if (!(global as unknown as Record<string, unknown>).publisherBillingServiceInstance) {
    (global as unknown as Record<string, unknown>).publisherBillingServiceInstance = new PublisherBillingService();
  }
  return (global as unknown as Record<string, unknown>).publisherBillingServiceInstance as PublisherBillingService;
}

export interface BillingControlDashboard {
  dueSoonDays: number;
  subscriberBilling: Awaited<ReturnType<ReturnType<typeof getSubscriberBillingService>['getBillingStats']>>;
  publisherBilling: Awaited<ReturnType<ReturnType<typeof getPublisherBillingService>['getBillingStats']>>;
  contracts: {
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
    withoutEndDate: number;
  };
  contractsExpiringSoon: Array<{
    contract_id: number;
    contract_number: string;
    title: string;
    subscriber_id: number | null;
    subscriber_name: string | null;
    end_date: string;
    status: string;
    days_until_end: number;
  }>;
  contractsExpired: Array<{
    contract_id: number;
    contract_number: string;
    title: string;
    subscriber_id: number | null;
    subscriber_name: string | null;
    end_date: string | null;
    status: string;
    days_past_end: number;
  }>;
  revenueShare: {
    pendingPayoutCount: number;
    pendingPayoutAmount: number;
    revenueShareTotalCount: number;
    campaignsAwaitingPayout: number;
  };
  publisherContracts: {
    active: number;
    subscriptionActive: number;
    expiringSoon: number;
  };
}

export class BillingControlService {
  private get db() {
    return getDatabase();
  }

  async getDashboard(options?: {
    subscriberId?: number;
    publisherId?: number;
    dueSoonDays?: number;
    contractListLimit?: number;
  }): Promise<BillingControlDashboard> {
    const dueSoonDays = Math.min(Math.max(options?.dueSoonDays ?? 30, 1), 365);
    const listLimit = Math.min(Math.max(options?.contractListLimit ?? 15, 1), 50);

    try {
      const [
        subscriberBilling,
        publisherBilling,
        contractCounts,
        contractsExpiringSoon,
        contractsExpired,
        revenueShare,
        publisherContracts,
      ] = await Promise.all([
          getSubscriberBillingService().getBillingStats({
            subscriberId: options?.subscriberId,
          }),
          getPublisherBillingService().getBillingStats({
            publisherId: options?.publisherId,
            dueSoonDays,
          }),
          this.getContractCounts(dueSoonDays),
          this.getContractsExpiringSoon(dueSoonDays, listLimit),
          this.getContractsExpired(listLimit),
          this.getRevenueShareSummary(options?.publisherId),
          this.getPublisherContractCounts(dueSoonDays, options?.publisherId),
        ]);

      return {
        dueSoonDays,
        subscriberBilling,
        publisherBilling,
        contracts: contractCounts,
        contractsExpiringSoon,
        contractsExpired,
        revenueShare,
        publisherContracts,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao montar painel de faturamento', e.error);
      throw new Error('Erro interno do servidor');
    }
  }

  private async getContractCounts(dueSoonDays: number) {
    const row = await this.db.findFirst(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE sc.status = 'active'
            AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
        )::int AS active,
        COUNT(*) FILTER (
          WHERE sc.status IN ('expired', 'terminated', 'cancelled')
            OR (sc.end_date IS NOT NULL AND sc.end_date < CURRENT_DATE)
        )::int AS expired,
        COUNT(*) FILTER (
          WHERE sc.status = 'active'
            AND sc.end_date IS NOT NULL
            AND sc.end_date >= CURRENT_DATE
            AND sc.end_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
        )::int AS expiring_soon,
        COUNT(*) FILTER (WHERE sc.end_date IS NULL)::int AS without_end_date
      FROM subscriber_contracts sc
      `,
      [dueSoonDays]
    );

    return {
      total: parseInt(row?.total || '0', 10),
      active: parseInt(row?.active || '0', 10),
      expired: parseInt(row?.expired || '0', 10),
      expiringSoon: parseInt(row?.expiring_soon || '0', 10),
      withoutEndDate: parseInt(row?.without_end_date || '0', 10),
    };
  }

  private async getContractsExpiringSoon(dueSoonDays: number, limit: number) {
    const rows = await this.db.findMany(
      `
      SELECT
        sc.contract_id,
        sc.contract_number,
        sc.title,
        sc.subscriber_id,
        s.name AS subscriber_name,
        sc.end_date::text AS end_date,
        sc.status,
        (sc.end_date - CURRENT_DATE)::int AS days_until_end
      FROM subscriber_contracts sc
      LEFT JOIN subscribers s ON s.subscriber_id = sc.subscriber_id
      WHERE sc.status = 'active'
        AND sc.end_date IS NOT NULL
        AND sc.end_date >= CURRENT_DATE
        AND sc.end_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
      ORDER BY sc.end_date ASC
      LIMIT $2
      `,
      [dueSoonDays, limit]
    );

    return rows.map((r: any) => ({
      contract_id: r.contract_id,
      contract_number: r.contract_number,
      title: r.title,
      subscriber_id: r.subscriber_id,
      subscriber_name: r.subscriber_name,
      end_date: r.end_date,
      status: r.status,
      days_until_end: parseInt(r.days_until_end || '0', 10),
    }));
  }

  private async getRevenueShareSummary(publisherId?: number) {
    let pubFilter = '';
    const params: (number | string)[] = [];
    if (publisherId) {
      params.push(publisherId);
      pubFilter = ` AND cp.publisher_id = $${params.length}`;
    }

    const repasse = await this.db.findFirst(
      `
      SELECT
        COUNT(*) FILTER (WHERE pb.payment_status = 'pending_payout')::int AS pending_payout_count,
        COALESCE(SUM(pb.amount) FILTER (WHERE pb.payment_status = 'pending_payout'), 0) AS pending_payout_amount,
        COUNT(*)::int AS revenue_share_total_count
      FROM publisher_billing pb
      WHERE pb.billing_type = 'revenue_share' AND pb.direction = 'outgoing'
        ${publisherId ? `AND pb.publisher_id = $1` : ''}
    `,
      publisherId ? [publisherId] : []
    );

    const awaiting = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS c
      FROM subscriber_billing sb
      INNER JOIN campaign_publishers cp ON cp.campaign_id = sb.campaign_id AND cp.is_active = true
      INNER JOIN publisher_contracts pc ON pc.publisher_id = cp.publisher_id
        AND pc.status = 'active'
        AND pc.contract_type IN ('revenue_share', 'hybrid')
      WHERE sb.payment_status = 'paid'
        AND sb.campaign_id IS NOT NULL
        AND sb.payment_date IS NOT NULL
        AND sb.payment_date >= CURRENT_DATE - INTERVAL '90 days'
        AND COALESCE(cp.revenue_share_percentage, pc.revenue_share_percentage, 0) > 0
        ${pubFilter}
        AND NOT EXISTS (
          SELECT 1 FROM publisher_billing pb
          WHERE pb.billing_type = 'revenue_share'
            AND pb.publisher_id = cp.publisher_id
            AND pb.metadata->>'sourceSubscriberBillingId' = sb.billing_id::text
        )
    `,
      params
    );

    return {
      pendingPayoutCount: parseInt(repasse?.pending_payout_count || '0', 10),
      pendingPayoutAmount: parseFloat(repasse?.pending_payout_amount || '0'),
      revenueShareTotalCount: parseInt(repasse?.revenue_share_total_count || '0', 10),
      campaignsAwaitingPayout: parseInt(awaiting?.c || '0', 10),
    };
  }

  private async getPublisherContractCounts(dueSoonDays: number, publisherId?: number) {
    const params: number[] = [dueSoonDays];
    let pubWhere = '';
    if (publisherId) {
      params.push(publisherId);
      pubWhere = ` AND pc.publisher_id = $${params.length}`;
    }

    const row = await this.db.findFirst(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE pc.status = 'active'
            AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE)
        )::int AS active,
        COUNT(*) FILTER (
          WHERE pc.status = 'active'
            AND pc.contract_type IN ('subscription', 'hybrid')
            AND COALESCE(pc.subscription_amount, 0) > 0
        )::int AS subscription_active,
        COUNT(*) FILTER (
          WHERE pc.status = 'active'
            AND pc.end_date IS NOT NULL
            AND pc.end_date >= CURRENT_DATE
            AND pc.end_date <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
        )::int AS expiring_soon
      FROM publisher_contracts pc
      WHERE 1=1 ${pubWhere}
    `,
      params
    );

    return {
      active: parseInt(row?.active || '0', 10),
      subscriptionActive: parseInt(row?.subscription_active || '0', 10),
      expiringSoon: parseInt(row?.expiring_soon || '0', 10),
    };
  }

  private async getContractsExpired(limit: number) {
    const rows = await this.db.findMany(
      `
      SELECT
        sc.contract_id,
        sc.contract_number,
        sc.title,
        sc.subscriber_id,
        s.name AS subscriber_name,
        sc.end_date::text AS end_date,
        sc.status,
        CASE
          WHEN sc.end_date IS NOT NULL THEN (CURRENT_DATE - sc.end_date)::int
          ELSE 0
        END AS days_past_end
      FROM subscriber_contracts sc
      LEFT JOIN subscribers s ON s.subscriber_id = sc.subscriber_id
      WHERE sc.status IN ('expired', 'terminated', 'cancelled')
        OR (sc.end_date IS NOT NULL AND sc.end_date < CURRENT_DATE)
      ORDER BY sc.end_date DESC NULLS LAST, sc.updated_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return rows.map((r: any) => ({
      contract_id: r.contract_id,
      contract_number: r.contract_number,
      title: r.title,
      subscriber_id: r.subscriber_id,
      subscriber_name: r.subscriber_name,
      end_date: r.end_date,
      status: r.status,
      days_past_end: parseInt(r.days_past_end || '0', 10),
    }));
  }
}

let instance: BillingControlService | null = null;

export function getBillingControlService(): BillingControlService {
  if (!instance) instance = new BillingControlService();
  return instance;
}

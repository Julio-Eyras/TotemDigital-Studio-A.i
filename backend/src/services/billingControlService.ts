/**
 * Painel unificado de faturamento (subscriber + publisher billing + contratos).
 * Sem dependência da tabela legada `billing`.
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { SubscriberBillingService } from './subscriberBillingService';
import { PublisherBillingService } from './publisherBillingService';

function getSubscriberBillingService(): SubscriberBillingService {
  if (!(global as any).subscriberBillingServiceInstance) {
    (global as any).subscriberBillingServiceInstance = new SubscriberBillingService();
  }
  return (global as any).subscriberBillingServiceInstance;
}

function getPublisherBillingService(): PublisherBillingService {
  if (!(global as any).publisherBillingServiceInstance) {
    (global as any).publisherBillingServiceInstance = new PublisherBillingService();
  }
  return (global as any).publisherBillingServiceInstance;
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
      const [subscriberBilling, publisherBilling, contractCounts, contractsExpiringSoon, contractsExpired] =
        await Promise.all([
          getSubscriberBillingService().getBillingStats({
            subscriberId: options?.subscriberId,
          }),
          getPublisherBillingService().getBillingStats({
            publisherId: options?.publisherId,
          }),
          this.getContractCounts(dueSoonDays),
          this.getContractsExpiringSoon(dueSoonDays, listLimit),
          this.getContractsExpired(listLimit),
        ]);

      return {
        dueSoonDays,
        subscriberBilling,
        publisherBilling,
        contracts: contractCounts,
        contractsExpiringSoon,
        contractsExpired,
      };
    } catch (error: any) {
      await logError('Erro ao montar painel de faturamento', error);
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

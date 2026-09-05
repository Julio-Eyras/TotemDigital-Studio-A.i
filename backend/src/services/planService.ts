/**
 * Plan Service - Smart Signage v2.1
 * Serviço para gerenciar planos de assinatura
 */

import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import {

  isBillingIntervalCode,
  normalizeBillingInterval,
  validatePlanPriceConfiguration,
} from '../utils/billingIntervals';
import { normalizeError } from '../utils/errors';

const PLAN_SELECT = `
          plan_id as "planId",
          name,
          slug,
          description,
          price_monthly as "priceMonthly",
          price_four_month as "priceFourMonth",
          price_semester as "priceSemester",
          price_yearly as "priceYearly",
          currency,
          billing_interval as "billingInterval",
          stripe_price_id_monthly as "stripePriceIdMonthly",
          stripe_price_id_four_month as "stripePriceIdFourMonth",
          stripe_price_id_semester as "stripePriceIdSemester",
          stripe_price_id_yearly as "stripePriceIdYearly",
          stripe_product_id as "stripeProductId",
          features,
          limits,
          is_active as "isActive",
          is_popular as "isPopular",
          COALESCE(is_default, false) as "isDefault",
          COALESCE((SELECT COUNT(*)::int FROM subscriber_contracts sc WHERE sc.plan_id = plans.plan_id), 0) as "contractCount",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"`;

export interface Plan {
  planId: number;
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceFourMonth?: number;
  priceSemester?: number;
  priceYearly?: number;
  currency: string;
  billingInterval: string;
  stripePriceIdMonthly?: string;
  stripePriceIdFourMonth?: string;
  stripePriceIdSemester?: string;
  stripePriceIdYearly?: string;
  stripeProductId?: string;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  isActive: boolean;
  isPopular: boolean;
  isDefault?: boolean;
  contractCount?: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanRequest {
  name: string;
  slug: string;
  description?: string;
  priceMonthly?: number;
  priceFourMonth?: number;
  priceSemester?: number;
  priceYearly?: number;
  currency?: string;
  billingInterval?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdFourMonth?: string;
  stripePriceIdSemester?: string;
  stripePriceIdYearly?: string;
  stripeProductId?: string;
  features: Record<string, unknown>;
  limits?: Record<string, unknown>;
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceFourMonth?: number;
  priceSemester?: number;
  priceYearly?: number;
  billingInterval?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdFourMonth?: string;
  stripePriceIdSemester?: string;
  stripePriceIdYearly?: string;
  features: Record<string, unknown>;
  limits?: Record<string, unknown>;
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

export class PlanService {
  private get db() {
    return getDatabase();
  }

  /**
   * Lista todos os planos ativos
   */
  async getPlans(includeInactive: boolean = false): Promise<Plan[]> {
    try {
      let whereClause = '';
      if (!includeInactive) {
        whereClause = 'WHERE is_active = true';
      }

      const plans = await this.db.findMany(`
        SELECT 
          ${PLAN_SELECT}
        FROM plans
        ${whereClause}
        ORDER BY COALESCE(is_default, false) DESC, sort_order ASC, name ASC
      `);

      return plans;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar planos', e.error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca plano por ID
   */
  async getPlanById(planId: number): Promise<Plan | null> {
    try {
      const plan = await this.db.findFirst(`
        SELECT 
          ${PLAN_SELECT}
        FROM plans
        WHERE plan_id = ?
      `, [planId]);

      return plan || null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar plano', e.error, { planId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Retorna o plano marcado como padrão (is_default = true) ou o primeiro ativo por sort_order
   */
  async getDefaultPlan(): Promise<Plan | null> {
    try {
      const plan = await this.db.findFirst(`
        SELECT 
          ${PLAN_SELECT}
        FROM plans
        WHERE is_active = true
        ORDER BY COALESCE(is_default, false) DESC, sort_order ASC NULLS LAST, plan_id ASC
        LIMIT 1
      `);
      return plan || null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar plano padrão', e.error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca plano por slug
   */
  async getPlanBySlug(slug: string): Promise<Plan | null> {
    try {
      const plan = await this.db.findFirst(`
        SELECT 
          ${PLAN_SELECT}
        FROM plans
        WHERE slug = ?
      `, [slug]);

      return plan || null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar plano por slug', e.error, { slug });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria novo plano
   */
  async createPlan(data: CreatePlanRequest): Promise<Plan> {
    try {
      const {
        name,
        slug,
        description,
        priceMonthly,
        priceFourMonth,
        priceSemester,
        priceYearly,
        currency = 'BRL',
        billingInterval = 'month',
        stripePriceIdMonthly,
        stripePriceIdFourMonth,
        stripePriceIdSemester,
        stripePriceIdYearly,
        stripeProductId,
        features = {},
        limits = {},
        isActive = true,
        isPopular = false,
        sortOrder = 0
      } = data;

      const defaultInterval = normalizeBillingInterval(billingInterval);
      if (!isBillingIntervalCode(defaultInterval)) {
        throw new Error('Intervalo de cobrança de referência inválido');
      }

      if (!name || !slug) {
        throw new Error('Nome e slug são obrigatórios');
      }
      validatePlanPriceConfiguration(
        { priceMonthly, priceFourMonth, priceSemester, priceYearly },
        defaultInterval
      );

      const insertPrice = (v: number | undefined) => (v != null && Number(v) > 0 ? v : null);

      // Verificar se slug já existe
      const existingPlan = await this.getPlanBySlug(slug);
      if (existingPlan) {
        throw new Error('Já existe um plano com este slug');
      }

      // Criar plano
      const result = await this.db.executeRaw(`
        INSERT INTO plans (
          name, slug, description, price_monthly, price_four_month, price_semester, price_yearly,
          currency, billing_interval,
          stripe_price_id_monthly, stripe_price_id_four_month, stripe_price_id_semester, stripe_price_id_yearly,
          stripe_product_id, features, limits, is_active, is_popular, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING plan_id
      `, [
        name,
        slug,
        description,
        insertPrice(priceMonthly),
        insertPrice(priceFourMonth),
        insertPrice(priceSemester),
        insertPrice(priceYearly),
        currency,
        defaultInterval,
        stripePriceIdMonthly,
        stripePriceIdFourMonth,
        stripePriceIdSemester,
        stripePriceIdYearly,
        stripeProductId,
        JSON.stringify(features),
        JSON.stringify(limits),
        isActive,
        isPopular,
        sortOrder
      ]);

      const planRow = result.rows?.[0];
      if (!planRow || !planRow.plan_id) {
        throw new Error('Erro ao criar plano');
      }

      const newPlan = await this.getPlanById(planRow.plan_id);
      if (!newPlan) {
        throw new Error('Erro ao buscar plano criado');
      }

      await logInfo('Plano criado com sucesso', { planId: newPlan.planId, slug });

      return newPlan;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar plano', e.error, { slug: data.slug });
      throw e.error;
    }
  }

  /**
   * Atualiza plano
   */
  async updatePlan(planId: number, data: UpdatePlanRequest): Promise<Plan> {
    try {
      // Verificar se plano existe
      const existingPlan = await this.getPlanById(planId);
      if (!existingPlan) {
        throw new Error('Plano não encontrado');
      }

      const hasContracts = Number(existingPlan.contractCount || 0) > 0;
      if (hasContracts) {
        const priceMonthlyChanged =
          data.priceMonthly !== undefined && Number(data.priceMonthly) !== Number(existingPlan.priceMonthly);
        const priceFourMonthChanged =
          data.priceFourMonth !== undefined &&
          Number(data.priceFourMonth || 0) !== Number(existingPlan.priceFourMonth || 0);
        const priceSemesterChanged =
          data.priceSemester !== undefined &&
          Number(data.priceSemester || 0) !== Number(existingPlan.priceSemester || 0);
        const priceYearlyChanged =
          data.priceYearly !== undefined && Number(data.priceYearly || 0) !== Number(existingPlan.priceYearly || 0);
        const billingIntervalChanged =
          data.billingInterval !== undefined &&
          normalizeBillingInterval(data.billingInterval) !==
            normalizeBillingInterval(existingPlan.billingInterval);
        const featuresChanged =
          data.features !== undefined && JSON.stringify(data.features ?? {}) !== JSON.stringify(existingPlan.features ?? {});
        const limitsChanged =
          data.limits !== undefined && JSON.stringify(data.limits ?? {}) !== JSON.stringify(existingPlan.limits ?? {});

        if (
          priceMonthlyChanged ||
          priceFourMonthChanged ||
          priceSemesterChanged ||
          priceYearlyChanged ||
          billingIntervalChanged ||
          featuresChanged ||
          limitsChanged
        ) {
          throw new Error(
            'Plano já possui contrato vinculado. Preço, recursos e limites não podem ser alterados; crie um novo plano para novas regras.'
          );
        }
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.priceMonthly !== undefined) {
        updates.push('price_monthly = ?');
        params.push(data.priceMonthly);
      }

      if (data.priceFourMonth !== undefined) {
        updates.push('price_four_month = ?');
        params.push(data.priceFourMonth);
      }

      if (data.priceSemester !== undefined) {
        updates.push('price_semester = ?');
        params.push(data.priceSemester);
      }

      if (data.priceYearly !== undefined) {
        updates.push('price_yearly = ?');
        params.push(data.priceYearly);
      }

      if (data.billingInterval !== undefined) {
        updates.push('billing_interval = ?');
        params.push(normalizeBillingInterval(data.billingInterval));
      }

      if (data.stripePriceIdMonthly !== undefined) {
        updates.push('stripe_price_id_monthly = ?');
        params.push(data.stripePriceIdMonthly);
      }

      if (data.stripePriceIdFourMonth !== undefined) {
        updates.push('stripe_price_id_four_month = ?');
        params.push(data.stripePriceIdFourMonth);
      }

      if (data.stripePriceIdSemester !== undefined) {
        updates.push('stripe_price_id_semester = ?');
        params.push(data.stripePriceIdSemester);
      }

      if (data.stripePriceIdYearly !== undefined) {
        updates.push('stripe_price_id_yearly = ?');
        params.push(data.stripePriceIdYearly);
      }

      if (data.features !== undefined) {
        updates.push('features = ?');
        params.push(JSON.stringify(data.features));
      }

      if (data.limits !== undefined) {
        updates.push('limits = ?');
        params.push(JSON.stringify(data.limits));
      }

      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(data.isActive);
      }

      if (data.isPopular !== undefined) {
        updates.push('is_popular = ?');
        params.push(data.isPopular);
      }

      if (data.sortOrder !== undefined) {
        updates.push('sort_order = ?');
        params.push(data.sortOrder);
      }

      if (!hasContracts) {
        validatePlanPriceConfiguration(
          {
            priceMonthly:
              data.priceMonthly !== undefined ? data.priceMonthly : existingPlan.priceMonthly,
            priceFourMonth:
              data.priceFourMonth !== undefined ? data.priceFourMonth : existingPlan.priceFourMonth,
            priceSemester:
              data.priceSemester !== undefined ? data.priceSemester : existingPlan.priceSemester,
            priceYearly:
              data.priceYearly !== undefined ? data.priceYearly : existingPlan.priceYearly,
          },
          data.billingInterval ?? existingPlan.billingInterval
        );
      }

      if (updates.length === 0) {
        return existingPlan;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(planId);

      // Atualizar plano
      await this.db.executeRaw(`
        UPDATE plans 
        SET ${updates.join(', ')}
        WHERE plan_id = ?
      `, params);

      const updatedPlan = await this.getPlanById(planId);
      if (!updatedPlan) {
        throw new Error('Erro ao buscar plano atualizado');
      }

      // Invalidar cache de limites dos subscribers (limites vêm dos planos)
      try {
        const cache = getCacheService();
        await cache.deletePattern('subscriber:*:max_limits');
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        await logError('Erro ao invalidar cache de limites após atualizar plano', e.error, { planId }).catch(() => {});
      }

      await logInfo('Plano atualizado com sucesso', { planId });

      return updatedPlan;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar plano', e.error, { planId });
      throw e.error;
    }
  }

  /**
   * Rede permitida pelo plano (locais/totens/TVs), respeitando compact_scope e plan_local_access.
   */
  async getPlanNetworkTopology(planId: number): Promise<{
    planId: number;
    planName: string;
    publishers: Array<{
      publisher_id: number;
      publisher_name: string;
      locals: Record<string, unknown>[];
      totems: Record<string, unknown>[];
      smartTvs: Record<string, unknown>[];
    }>;
  }> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    const accessRows = await this.db.findMany(
      `
        SELECT ppa.publisher_id, pub.name AS publisher_name, ppa.restrictions
        FROM plan_publisher_access ppa
        INNER JOIN publishers pub ON pub.publisher_id = ppa.publisher_id
        WHERE ppa.plan_id = $1
          AND ppa.is_allowed = true
          AND COALESCE(ppa.is_active, true) = true
        ORDER BY pub.name
      `,
      [planId]
    );

    const planLocalRows = await this.db.findMany(
      `
        SELECT local_id
        FROM plan_local_access
        WHERE plan_id = $1
          AND is_allowed = true
          AND COALESCE(is_active, true) = true
      `,
      [planId]
    );
    const planLocalIds = new Set<number>(
      planLocalRows.map((row: { local_id: number }) => Number(row.local_id))
    );

    const compactLocalIds = new Set<number>();
    const enabledTotemsByLocal = new Map<number, Set<number>>();
    let hasCompactScope = false;

    const parseRestrictions = (raw: unknown): Record<string, any> => {
      if (!raw) return {};
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as Record<string, any>;
        } catch {
          return {};
        }
      }
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, any>;
      }
      return {};
    };

    const pushPositiveInts = (target: Set<number>, values: unknown): void => {
      if (!Array.isArray(values)) return;
      for (const value of values) {
        const n = Number(value);
        if (Number.isInteger(n) && n > 0) target.add(n);
      }
    };

    for (const row of accessRows) {
      const compactScope = parseRestrictions(row.restrictions).compact_scope;
      if (!compactScope || typeof compactScope !== 'object') continue;

      const localIds = compactScope.local_ids;
      if (Array.isArray(localIds) && localIds.length > 0) {
        hasCompactScope = true;
        pushPositiveInts(compactLocalIds, localIds);
      }

      const enabledByLocal = compactScope.enabled_totem_ids_by_local;
      if (enabledByLocal && typeof enabledByLocal === 'object' && !Array.isArray(enabledByLocal)) {
        hasCompactScope = true;
        for (const [localKey, totemIds] of Object.entries(enabledByLocal)) {
          const localId = Number(localKey);
          if (!Number.isInteger(localId) || localId <= 0) continue;
          if (!enabledTotemsByLocal.has(localId)) {
            enabledTotemsByLocal.set(localId, new Set<number>());
          }
          pushPositiveInts(enabledTotemsByLocal.get(localId)!, totemIds);
        }
      }
    }

    const publishers: Array<{
      publisher_id: number;
      publisher_name: string;
      locals: Record<string, unknown>[];
      totems: Record<string, unknown>[];
      smartTvs: Record<string, unknown>[];
    }> = [];

    for (const row of accessRows) {
      const publisherId = Number(row.publisher_id);
      const allLocals = await this.db.findMany(
        `
          SELECT
            l.local_id,
            l.name,
            l.address,
            l.city,
            l.state,
            l.publisher_id,
            l.is_active
          FROM locals l
          WHERE l.publisher_id = $1
            AND COALESCE(l.is_active, true) = true
          ORDER BY l.name
        `,
        [publisherId]
      );

      let allowedLocals = allLocals;
      if (hasCompactScope && compactLocalIds.size > 0) {
        allowedLocals = allLocals.filter((local: { local_id: number }) =>
          compactLocalIds.has(Number(local.local_id))
        );
      } else if (planLocalIds.size > 0) {
        allowedLocals = allLocals.filter((local: { local_id: number }) =>
          planLocalIds.has(Number(local.local_id))
        );
      }

      const allowedLocalIds = allowedLocals.map((local: { local_id: number }) => Number(local.local_id));
      if (allowedLocalIds.length === 0) {
        publishers.push({
          publisher_id: publisherId,
          publisher_name: row.publisher_name,
          locals: [],
          totems: [],
          smartTvs: [],
        });
        continue;
      }

      const totems = await this.db.findMany(
        `
          SELECT
            t.totem_id,
            t.identifier,
            t.uin,
            t.device_id,
            t.name,
            t.description,
            t.model,
            t.manufacturer,
            t.status,
            t.is_active,
            t.local_id,
            l.name AS local_name
          FROM totems t
          INNER JOIN locals l ON l.local_id = t.local_id
          WHERE t.local_id = ANY($1::int[])
            AND COALESCE(t.is_active, true) = true
          ORDER BY l.name, t.name
        `,
        [allowedLocalIds]
      );

      const filteredTotems = totems.filter((totem: { totem_id: number; local_id: number }) => {
        if (!hasCompactScope) return true;
        const localId = Number(totem.local_id);
        if (compactLocalIds.size > 0 && !compactLocalIds.has(localId)) return false;
        const allowedTotems = enabledTotemsByLocal.get(localId);
        if (!allowedTotems || allowedTotems.size === 0) return true;
        return allowedTotems.has(Number(totem.totem_id));
      });

      const filteredTotemIds = new Set(
        filteredTotems.map((totem: { totem_id: number }) => Number(totem.totem_id))
      );

      const smartTvs = await this.db.findMany(
        `
          SELECT
            st.smart_tv_id,
            st.name,
            st.brand,
            st.model,
            st.is_active,
            st.totem_id,
            t.local_id,
            l.name AS local_name
          FROM smart_tvs st
          INNER JOIN totems t ON t.totem_id = st.totem_id
          INNER JOIN locals l ON l.local_id = t.local_id
          WHERE t.local_id = ANY($1::int[])
            AND COALESCE(st.is_active, true) = true
            AND COALESCE(t.is_active, true) = true
          ORDER BY l.name, st.name
        `,
        [allowedLocalIds]
      ).then((rows: Array<{ totem_id: number }>) =>
        rows.filter((tv) => filteredTotemIds.has(Number(tv.totem_id)))
      );

      publishers.push({
        publisher_id: publisherId,
        publisher_name: row.publisher_name,
        locals: allowedLocals,
        totems: filteredTotems,
        smartTvs,
      });
    }

    return {
      planId,
      planName: plan.name,
      publishers,
    };
  }

  /**
   * Remove plano
   */
  async deletePlan(planId: number): Promise<void> {
    try {
      // Verificar se plano existe
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plano não encontrado');
      }

      // Verificar se há assinaturas ativas usando este plano
      const activeSubscriptions = await this.db.findFirst(`
        SELECT COUNT(*)::int as count
        FROM subscriptions
        WHERE plan_id = ? AND status = 'active'
      `, [planId]);

      if (activeSubscriptions && activeSubscriptions.count > 0) {
        throw new Error('Não é possível remover plano com assinaturas ativas');
      }

      // Remover plano
      await this.db.executeRaw(`
        DELETE FROM plans WHERE plan_id = ?
      `, [planId]);

      await logInfo('Plano removido com sucesso', {
        planId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao remover plano', e.error, { planId });
      throw e.error;
    }
  }
}


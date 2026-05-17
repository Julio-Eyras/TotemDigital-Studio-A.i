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
  features: any;
  limits: any;
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
  features?: any;
  limits?: any;
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
  features?: any;
  limits?: any;
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

      return plans;

    } catch (error: any) {
      await logError('Erro ao buscar planos', error);
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

      return plan || null;

    } catch (error: any) {
      await logError('Erro ao buscar plano', error, { planId });
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
      return plan || null;
    } catch (error: any) {
      await logError('Erro ao buscar plano padrão', error);
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

      return plan || null;

    } catch (error: any) {
      await logError('Erro ao buscar plano por slug', error, { slug });
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

      return newPlan;

    } catch (error: any) {
      await logError('Erro ao criar plano', error, { slug: data.slug });
      throw error;
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
      const params: any[] = [];

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
      } catch (e) {
        await logError('Erro ao invalidar cache de limites após atualizar plano', e as Error, { planId }).catch(() => {});
      }

      await logInfo('Plano atualizado com sucesso', { planId });

      return updatedPlan;

    } catch (error: any) {
      await logError('Erro ao atualizar plano', error, { planId });
      throw error;
    }
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

      await logInfo('Plano removido com sucesso', { planId });

    } catch (error: any) {
      await logError('Erro ao remover plano', error, { planId });
      throw error;
    }
  }
}


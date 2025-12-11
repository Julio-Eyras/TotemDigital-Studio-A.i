/**
 * Plan Service - Smart Signage v2.1
 * Serviço para gerenciar planos de assinatura
 */

import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';

export interface Plan {
  planId: number;
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  currency: string;
  billingInterval: string;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  stripeProductId?: string;
  features: any;
  limits: any;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanRequest {
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  currency?: string;
  billingInterval?: string;
  stripePriceIdMonthly?: string;
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
  priceYearly?: number;
  stripePriceIdMonthly?: string;
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
          plan_id as "planId",
          name,
          slug,
          description,
          price_monthly as "priceMonthly",
          price_yearly as "priceYearly",
          currency,
          billing_interval as "billingInterval",
          stripe_price_id_monthly as "stripePriceIdMonthly",
          stripe_price_id_yearly as "stripePriceIdYearly",
          stripe_product_id as "stripeProductId",
          features,
          limits,
          is_active as "isActive",
          is_popular as "isPopular",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM plans
        ${whereClause}
        ORDER BY sort_order ASC, name ASC
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
          plan_id as "planId",
          name,
          slug,
          description,
          price_monthly as "priceMonthly",
          price_yearly as "priceYearly",
          currency,
          billing_interval as "billingInterval",
          stripe_price_id_monthly as "stripePriceIdMonthly",
          stripe_price_id_yearly as "stripePriceIdYearly",
          stripe_product_id as "stripeProductId",
          features,
          limits,
          is_active as "isActive",
          is_popular as "isPopular",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
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
   * Busca plano por slug
   */
  async getPlanBySlug(slug: string): Promise<Plan | null> {
    try {
      const plan = await this.db.findFirst(`
        SELECT 
          plan_id as "planId",
          name,
          slug,
          description,
          price_monthly as "priceMonthly",
          price_yearly as "priceYearly",
          currency,
          billing_interval as "billingInterval",
          stripe_price_id_monthly as "stripePriceIdMonthly",
          stripe_price_id_yearly as "stripePriceIdYearly",
          stripe_product_id as "stripeProductId",
          features,
          limits,
          is_active as "isActive",
          is_popular as "isPopular",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
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
        priceYearly,
        currency = 'BRL',
        billingInterval = 'month',
        stripePriceIdMonthly,
        stripePriceIdYearly,
        stripeProductId,
        features = {},
        limits = {},
        isActive = true,
        isPopular = false,
        sortOrder = 0
      } = data;

      // Validar campos obrigatórios
      if (!name || !slug || !priceMonthly) {
        throw new Error('Nome, slug e preço mensal são obrigatórios');
      }

      // Verificar se slug já existe
      const existingPlan = await this.getPlanBySlug(slug);
      if (existingPlan) {
        throw new Error('Já existe um plano com este slug');
      }

      // Criar plano
      const result = await this.db.executeRaw(`
        INSERT INTO plans (
          name, slug, description, price_monthly, price_yearly, currency,
          billing_interval, stripe_price_id_monthly, stripe_price_id_yearly,
          stripe_product_id, features, limits, is_active, is_popular, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING plan_id
      `, [
        name,
        slug,
        description,
        priceMonthly,
        priceYearly,
        currency,
        billingInterval,
        stripePriceIdMonthly,
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

      if (data.priceYearly !== undefined) {
        updates.push('price_yearly = ?');
        params.push(data.priceYearly);
      }

      if (data.stripePriceIdMonthly !== undefined) {
        updates.push('stripe_price_id_monthly = ?');
        params.push(data.stripePriceIdMonthly);
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


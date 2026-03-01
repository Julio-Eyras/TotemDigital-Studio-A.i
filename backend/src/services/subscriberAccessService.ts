/**
 * Subscriber Access Service - Smart Signage v2.0
 * Serviço para gerenciar e validar acesso de subscribers a publishers
 */

import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';

export interface SubscriberPublisherAccess {
  accessId: number;
  subscriberId: number;
  publisherId: number;
  contractId?: number;
  planId?: number;
  accessType: 'plan' | 'contract' | 'override';
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface PlanPublisherAccess {
  planId: number;
  publisherId: number;
  isAllowed: boolean;
  restrictions?: any;
}

export class SubscriberAccessService {
  private get db() {
    return getDatabase();
  }

  /**
   * Valida se um subscriber tem acesso ativo a um publisher
   * Usa a função SQL check_subscriber_publisher_access
   */
  async hasAccess(subscriberId: number, publisherId: number): Promise<boolean> {
    try {
      const result = await this.db.findFirst(`
        SELECT check_subscriber_publisher_access($1, $2) as has_access
      `, [subscriberId, publisherId]);

      return result?.has_access === true;
    } catch (error: any) {
      await logError('Erro ao validar acesso subscriber → publisher', error, {
        subscriberId,
        publisherId
      });
      return false;
    }
  }

  /**
   * Obtém todos os publishers que um subscriber pode acessar (apenas IDs)
   */
  async getAccessiblePublishers(subscriberId: number): Promise<number[]> {
    try {
      const access = await this.db.findMany(`
        SELECT DISTINCT publisher_id
        FROM subscriber_publisher_access_active
        WHERE subscriber_id = $1
        ORDER BY publisher_id
      `, [subscriberId]);

      return access.map(a => a.publisher_id);
    } catch (error: any) {
      await logError('Erro ao buscar publishers acessíveis', error, { subscriberId });
      return [];
    }
  }

  /**
   * Obtém todos os subscribers que podem acessar um publisher
   */
  async getAccessibleSubscribers(publisherId: number): Promise<number[]> {
    try {
      const access = await this.db.findMany(`
        SELECT DISTINCT subscriber_id
        FROM subscriber_publisher_access_active
        WHERE publisher_id = $1
        ORDER BY subscriber_id
      `, [publisherId]);

      return access.map(a => a.subscriber_id);
    } catch (error: any) {
      await logError('Erro ao buscar subscribers com acesso', error, { publisherId });
      return [];
    }
  }

  /**
   * Obtém informações completas de acesso
   */
  async getAccessDetails(
    subscriberId: number,
    publisherId: number
  ): Promise<SubscriberPublisherAccess | null> {
    try {
      const access = await this.db.findFirst(`
        SELECT 
          access_id as "accessId",
          subscriber_id as "subscriberId",
          publisher_id as "publisherId",
          contract_id as "contractId",
          plan_id as "planId",
          access_type as "accessType",
          granted_at as "grantedAt",
          expires_at as "expiresAt",
          is_active as "isActive"
        FROM subscriber_publisher_access
        WHERE subscriber_id = $1
          AND publisher_id = $2
          AND is_active = true
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY granted_at DESC
        LIMIT 1
      `, [subscriberId, publisherId]);

      return access || null;
    } catch (error: any) {
      await logError('Erro ao buscar detalhes de acesso', error, {
        subscriberId,
        publisherId
      });
      return null;
    }
  }

  /**
   * Concede acesso de subscriber a publisher via contrato
   */
  async grantAccess(
    subscriberId: number,
    publisherId: number,
    contractId: number,
    grantedBy: number,
    expiresAt?: Date,
    notes?: string
  ): Promise<SubscriberPublisherAccess> {
    try {
      // Buscar plan_id do contrato
      const contract = await this.db.findFirst(`
        SELECT plan_id
        FROM subscriber_contracts
        WHERE contract_id = $1
      `, [contractId]);

      const result = await this.db.executeRaw(`
        INSERT INTO subscriber_publisher_access (
          subscriber_id,
          publisher_id,
          contract_id,
          plan_id,
          access_type,
          granted_by,
          expires_at,
          notes,
          is_active
        )
        VALUES ($1, $2, $3, $4, 'contract', $5, $6, $7, true)
        RETURNING 
          access_id as "accessId",
          subscriber_id as "subscriberId",
          publisher_id as "publisherId",
          contract_id as "contractId",
          plan_id as "planId",
          access_type as "accessType",
          granted_at as "grantedAt",
          expires_at as "expiresAt",
          is_active as "isActive"
      `, [
        subscriberId,
        publisherId,
        contractId,
        contract?.plan_id || null,
        grantedBy,
        expiresAt || null,
        notes || null
      ]);

      await logInfo('Acesso subscriber → publisher concedido', {
        subscriberId,
        publisherId,
        contractId,
        grantedBy
      });

      return result;
    } catch (error: any) {
      await logError('Erro ao conceder acesso', error, {
        subscriberId,
        publisherId,
        contractId
      });
      throw new Error('Erro ao conceder acesso');
    }
  }

  /**
   * Revoga acesso de subscriber a publisher
   */
  async revokeAccess(
    subscriberId: number,
    publisherId: number,
    revokedBy: number,
    reason?: string
  ): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE subscriber_publisher_access
        SET 
          is_active = false,
          revoked_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes || E'\n', '') || $3
        WHERE subscriber_id = $1
          AND publisher_id = $2
          AND is_active = true
          AND revoked_at IS NULL
      `, [
        subscriberId,
        publisherId,
        `Revogado por user_id ${revokedBy} em ${new Date().toISOString()}. Motivo: ${reason || 'Não especificado'}`
      ]);

      await logInfo('Acesso subscriber → publisher revogado', {
        subscriberId,
        publisherId,
        revokedBy,
        reason
      });
    } catch (error: any) {
      await logError('Erro ao revogar acesso', error, {
        subscriberId,
        publisherId
      });
      throw new Error('Erro ao revogar acesso');
    }
  }

  /**
   * Configura acesso baseado em plano (plan_publisher_access)
   */
  async setPlanPublisherAccess(
    planId: number,
    publisherId: number,
    isAllowed: boolean,
    restrictions?: any
  ): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO plan_publisher_access (
          plan_id,
          publisher_id,
          is_allowed,
          restrictions
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (plan_id, publisher_id)
        DO UPDATE SET
          is_allowed = EXCLUDED.is_allowed,
          restrictions = EXCLUDED.restrictions,
          updated_at = CURRENT_TIMESTAMP
      `, [planId, publisherId, isAllowed, restrictions ? JSON.stringify(restrictions) : null]);

      await logInfo('Acesso plano → publisher configurado', {
        planId,
        publisherId,
        isAllowed
      });
    } catch (error: any) {
      await logError('Erro ao configurar acesso plano → publisher', error, {
        planId,
        publisherId
      });
      throw new Error('Erro ao configurar acesso');
    }
  }

  /**
   * Utility: Enfileira reconciliação imediata ao mudar plan_publisher_access (used by routes)
   */
  async enqueueReconcile(planId: number, publisherId: number): Promise<void> {
    try {
      await this.db.executeRaw(`SELECT enqueue_reconcile_plan_publisher($1, $2, 'upsert')`, [planId, publisherId]);
      await logInfo('Reconcile enqueued', { planId, publisherId });
    } catch (error: any) {
      await logError('Erro ao enfileirar reconcile', error, { planId, publisherId });
      throw error;
    }
  }

  /**
   * Valida se uma campanha pode ser associada a publishers específicos
   */
  async validateCampaignPublishers(
    subscriberId: number,
    publisherIds: number[]
  ): Promise<{ valid: boolean; invalidPublishers: number[] }> {
    const invalidPublishers: number[] = [];

    for (const publisherId of publisherIds) {
      const hasAccess = await this.hasAccess(subscriberId, publisherId);
      if (!hasAccess) {
        invalidPublishers.push(publisherId);
      }
    }

    return {
      valid: invalidPublishers.length === 0,
      invalidPublishers
    };
  }

  /**
   * Obtém publishers acessíveis com informações completas.
   * 1. Busca em subscriber_publisher_access_active (fonte principal).
   * 2. Se vazio, fallback: publishers via plan_publisher_access a partir dos contratos ativos do subscriber.
   *    Isso cobre o caso em que a reconciliação ainda não foi executada.
   */
  async getAccessiblePublishersWithDetails(subscriberId: number): Promise<any[]> {
    try {
      const publishers = await this.db.findMany(`
        SELECT DISTINCT
          spa.publisher_id,
          p.name as publisher_name,
          p.email as publisher_email,
          spa.contract_id,
          spa.plan_id,
          pl.name as plan_name,
          spa.access_type,
          spa.expires_at
        FROM subscriber_publisher_access_active spa
        JOIN publishers p ON spa.publisher_id = p.publisher_id
        LEFT JOIN plans pl ON spa.plan_id = pl.plan_id
        WHERE spa.subscriber_id = $1
        ORDER BY p.name
      `, [subscriberId]);

      if (publishers.length > 0) {
        return publishers;
      }

      // Fallback: publishers via plan_publisher_access a partir dos contratos ativos do subscriber
      const viaPlan = await this.db.findMany(`
        SELECT DISTINCT
          ppa.publisher_id,
          p.name as publisher_name,
          p.email as publisher_email,
          sc.contract_id as contract_id,
          sc.plan_id as plan_id,
          pl.name as plan_name,
          'plan' as access_type,
          sc.end_date as expires_at
        FROM subscriber_contracts sc
        INNER JOIN plan_publisher_access ppa ON sc.plan_id = ppa.plan_id AND ppa.is_allowed = true
        JOIN publishers p ON ppa.publisher_id = p.publisher_id
        LEFT JOIN plans pl ON sc.plan_id = pl.plan_id
        WHERE sc.subscriber_id = $1
          AND sc.status = 'active'
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND COALESCE(ppa.is_active, true) = true
          AND COALESCE(p.is_active, true) = true
        ORDER BY p.name
      `, [subscriberId]);

      return viaPlan;
    } catch (error: any) {
      await logError('Erro ao buscar publishers com detalhes', error, { subscriberId });
      return [];
    }
  }

  /**
   * Lista todos os acessos subscriber → publisher (ativos e inativos)
   */
  async getAllSubscriberPublisherAccess(params: {
    subscriberId?: number;
    publisherId?: number;
    contractId?: number;
    planId?: number;
    isActive?: boolean;
  } = {}): Promise<any[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.subscriberId) {
        whereClause += ` AND spa.subscriber_id = $${paramIndex}`;
        queryParams.push(params.subscriberId);
        paramIndex++;
      }

      if (params.publisherId) {
        whereClause += ` AND spa.publisher_id = $${paramIndex}`;
        queryParams.push(params.publisherId);
        paramIndex++;
      }

      if (params.contractId) {
        whereClause += ` AND spa.contract_id = $${paramIndex}`;
        queryParams.push(params.contractId);
        paramIndex++;
      }

      if (params.planId) {
        whereClause += ` AND spa.plan_id = $${paramIndex}`;
        queryParams.push(params.planId);
        paramIndex++;
      }

      if (params.isActive !== undefined) {
        whereClause += ` AND spa.is_active = $${paramIndex}`;
        queryParams.push(params.isActive);
        paramIndex++;
      }

      const access = await this.db.findMany(`
        SELECT 
          spa.access_id,
          spa.subscriber_id,
          s.name as subscriber_name,
          spa.publisher_id,
          p.name as publisher_name,
          spa.contract_id,
          sc.contract_number,
          spa.plan_id,
          pl.name as plan_name,
          spa.access_type,
          spa.granted_at,
          spa.expires_at,
          spa.revoked_at,
          spa.is_active,
          spa.granted_by,
          u.username as granted_by_name,
          spa.notes,
          spa.metadata,
          spa.created_at,
          spa.updated_at
        FROM subscriber_publisher_access spa
        JOIN subscribers s ON spa.subscriber_id = s.subscriber_id
        JOIN publishers p ON spa.publisher_id = p.publisher_id
        LEFT JOIN subscriber_contracts sc ON spa.contract_id = sc.contract_id
        LEFT JOIN plans pl ON spa.plan_id = pl.plan_id
        LEFT JOIN users u ON spa.granted_by = u.id
        ${whereClause}
        ORDER BY spa.created_at DESC
      `, queryParams);

      return access;
    } catch (error: any) {
      await logError('Erro ao listar acessos subscriber → publisher', error, params);
      return [];
    }
  }

  /**
   * Lista configurações de plan_publisher_access
   */
  async getPlanPublisherAccess(params: {
    planId?: number;
    publisherId?: number;
  } = {}): Promise<any[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.planId) {
        whereClause += ` AND ppa.plan_id = $${paramIndex}`;
        queryParams.push(params.planId);
        paramIndex++;
      }

      if (params.publisherId) {
        whereClause += ` AND ppa.publisher_id = $${paramIndex}`;
        queryParams.push(params.publisherId);
        paramIndex++;
      }

      const access = await this.db.findMany(`
        SELECT 
          ppa.plan_id,
          pl.name as plan_name,
          pl.slug as plan_slug,
          ppa.publisher_id,
          p.name as publisher_name,
          p.email as publisher_email,
          ppa.is_allowed,
          ppa.restrictions,
          ppa.notes,
          ppa.created_at,
          ppa.updated_at
        FROM plan_publisher_access ppa
        JOIN plans pl ON ppa.plan_id = pl.plan_id
        JOIN publishers p ON ppa.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY pl.sort_order ASC, pl.name ASC, p.name ASC
      `, queryParams);

      return access;
    } catch (error: any) {
      await logError('Erro ao listar acesso plano → publisher', error, params);
      return [];
    }
  }

  /**
   * Remove configuração de plan_publisher_access
   */
  async removePlanPublisherAccess(planId: number, publisherId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        DELETE FROM plan_publisher_access
        WHERE plan_id = $1 AND publisher_id = $2
      `, [planId, publisherId]);

      await logInfo('Acesso plano → publisher removido', {
        planId,
        publisherId
      });
    } catch (error: any) {
      await logError('Erro ao remover acesso plano → publisher', error, {
        planId,
        publisherId
      });
      throw new Error('Erro ao remover acesso');
    }
  }

  /**
   * Atualiza notes de plan_publisher_access
   */
  async updatePlanPublisherAccessNotes(planId: number, publisherId: number, notes: string): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE plan_publisher_access
        SET notes = $1, updated_at = CURRENT_TIMESTAMP
        WHERE plan_id = $2 AND publisher_id = $3
      `, [notes, planId, publisherId]);
    } catch (error: any) {
      await logError('Erro ao atualizar notes de acesso plano → publisher', error, {
        planId,
        publisherId
      });
      throw new Error('Erro ao atualizar notes');
    }
  }
}

// Singleton instance
let subscriberAccessServiceInstance: SubscriberAccessService | null = null;

export function getSubscriberAccessServiceInstance(): SubscriberAccessService {
  if (!subscriberAccessServiceInstance) {
    subscriberAccessServiceInstance = new SubscriberAccessService();
  }
  return subscriberAccessServiceInstance;
}


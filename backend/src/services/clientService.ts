/**
 * Client Service - Smart Signage v2.0
 * Serviço de gerenciamento de clientes
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface CreateClientRequest {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  wths?: string;
  active?: boolean;
}

export interface UpdateClientRequest {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  wths?: string;
  active?: boolean;
}

export interface ClientResponse {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  wths?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  campaignCount?: number;
  mediaCount?: number;
  totemCount?: number;
}

export interface ClientStats {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  totalUsers: number;
  totalCampaigns: number;
  totalMedia: number;
  totalTotems: number;
  recentActivity: {
    newClients: number;
    newCampaigns: number;
    newMedia: number;
  };
}

export class ClientService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista todos os clientes (alias para getClients)
   */
  async getAllClients(filters?: {
    active?: boolean;
    search?: string;
  }): Promise<ClientResponse[]> {
    const result = await this.getClients(1, 1000, filters || {});
    return result.clients;
  }

  /**
   * Lista clientes com paginação e filtros
   */
  async getClients(
    page: number = 1,
    limit: number = 20,
    filters: {
      active?: boolean;
      search?: string;
    } = {}
  ): Promise<{ clients: ClientResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.active !== undefined) {
        whereClause += ' AND c.active = ?';
        params.push(filters.active ? 1 : 0);
      }

      if (filters.search) {
        whereClause += ' AND (c.name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar clientes
      const clients = await this.db.findMany(`
        SELECT 
          c.client_id as id,
          c.name,
          c.contact_name as contactName,
          c.email,
          c.phone,
          c.wths,
          c.active,
          c.created_at as createdAt,
          c.updated_at as updatedAt
        FROM clients c
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM clients c
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Buscar estatísticas para cada cliente
      const clientsWithStats = await Promise.all(
        clients.map(async (client) => {
          const stats = await this.getClientStats(client.id);
          return { ...client, ...stats };
        })
      );

      return {
        clients: clientsWithStats,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar clientes:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca cliente por ID
   */
  async getClientById(clientId: number): Promise<ClientResponse | null> {
    try {
      const client = await this.db.findFirst(`
        SELECT 
          c.client_id as id,
          c.name,
          c.contact_name as contactName,
          c.email,
          c.phone,
          c.wths,
          c.active,
          c.created_at as createdAt,
          c.updated_at as updatedAt
        FROM clients c
        WHERE c.client_id = ?
      `, [clientId]);

      if (!client) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getClientStats(clientId);
      return { ...client, ...stats };

    } catch (error: any) {
      console.error('❌ Erro ao buscar cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca cliente por email
   */
  async getClientByEmail(email: string): Promise<ClientResponse | null> {
    try {
      const client = await this.db.findFirst(`
        SELECT 
          c.client_id as id,
          c.name,
          c.contact_name as contactName,
          c.email,
          c.phone,
          c.wths,
          c.active,
          c.created_at as createdAt,
          c.updated_at as updatedAt
        FROM clients c
        WHERE c.email = ?
      `, [email]);

      if (!client) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getClientStats(client.id);
      return { ...client, ...stats };

    } catch (error: any) {
      console.error('❌ Erro ao buscar cliente por email:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria novo cliente
   */
  async createClient(data: CreateClientRequest, createdBy: number): Promise<ClientResponse> {
    try {
      const { name, contactName, email, phone, wths, active = true } = data;

      // Verificar se email já existe (se fornecido)
      if (email) {
        const existingClient = await this.db.findFirst(`
          SELECT client_id FROM clients WHERE email = ?
        `, [email]);

        if (existingClient) {
          throw new Error('Email já está em uso por outro cliente');
        }
      }

      // Criar cliente
      const result = await this.db.executeRaw(`
        INSERT INTO clients (name, contact_name, email, phone, wths, active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [name, contactName, email, phone, wths, active ? 1 : 0]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar cliente');
      }

      // Buscar cliente criado
      const newClient = await this.getClientById(result.lastInsertRowid);
      if (!newClient) {
        throw new Error('Erro ao buscar cliente criado');
      }

      // Log de auditoria
      await this.getAuditService().log('client', 'created', createdBy, {
        clientId: newClient.id,
        name: newClient.name,
        email: newClient.email
      });

      return newClient;

    } catch (error: any) {
      console.error('❌ Erro ao criar cliente:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza cliente
   */
  async updateClient(clientId: number, data: UpdateClientRequest, updatedBy: number): Promise<ClientResponse> {
    try {
      // Verificar se cliente existe
      const existingClient = await this.getClientById(clientId);
      if (!existingClient) {
        throw new Error('Cliente não encontrado');
      }

      // Verificar se email já existe (se estiver sendo alterado)
      if (data.email && data.email !== existingClient.email) {
        const emailExists = await this.db.findFirst(`
          SELECT client_id FROM clients WHERE email = ? AND client_id != ?
        `, [data.email, clientId]);

        if (emailExists) {
          throw new Error('Email já está em uso por outro cliente');
        }
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.contactName !== undefined) {
        updates.push('contact_name = ?');
        params.push(data.contactName);
      }

      if (data.email !== undefined) {
        updates.push('email = ?');
        params.push(data.email);
      }

      if (data.phone !== undefined) {
        updates.push('phone = ?');
        params.push(data.phone);
      }

      if (data.wths !== undefined) {
        updates.push('wths = ?');
        params.push(data.wths);
      }

      if (data.active !== undefined) {
        updates.push('active = ?');
        params.push(data.active ? 1 : 0);
      }

      if (updates.length === 0) {
        return existingClient;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(clientId);

      // Atualizar cliente
      await this.db.executeRaw(`
        UPDATE clients 
        SET ${updates.join(', ')}
        WHERE client_id = ?
      `, params);

      // Buscar cliente atualizado
      const updatedClient = await this.getClientById(clientId);
      if (!updatedClient) {
        throw new Error('Erro ao buscar cliente atualizado');
      }

      // Log de auditoria
      await this.getAuditService().log('client', 'updated', updatedBy, {
        clientId,
        changes: data
      });

      return updatedClient;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar cliente:', error.message);
      throw error;
    }
  }

  /**
   * Desativa cliente
   */
  async deactivateClient(clientId: number, deactivatedBy: number): Promise<void> {
    try {
      // Verificar se cliente existe
      const client = await this.getClientById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      if (!client.active) {
        throw new Error('Cliente já está inativo');
      }

      // Desativar cliente
      await this.db.executeRaw(`
        UPDATE clients 
        SET active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = ?
      `, [clientId]);

      // Desativar usuários do cliente
      await this.db.executeRaw(`
        UPDATE users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = ?
      `, [clientId]);

      // Desativar campanhas do cliente
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = ?
      `, [clientId]);

      // Log de auditoria
      await this.getAuditService().log('client', 'deactivated', deactivatedBy, {
        clientId,
        name: client.name
      });

    } catch (error: any) {
      console.error('❌ Erro ao desativar cliente:', error.message);
      throw error;
    }
  }

  /**
   * Ativa cliente
   */
  async activateClient(clientId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se cliente existe
      const client = await this.getClientById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      if (client.active) {
        throw new Error('Cliente já está ativo');
      }

      // Ativar cliente
      await this.db.executeRaw(`
        UPDATE clients 
        SET active = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = ?
      `, [clientId]);

      // Log de auditoria
      await this.getAuditService().log('client', 'activated', activatedBy, {
        clientId,
        name: client.name
      });

    } catch (error: any) {
      console.error('❌ Erro ao ativar cliente:', error.message);
      throw error;
    }
  }

  /**
   * Remove cliente (soft delete)
   */
  async deleteClient(clientId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se cliente existe
      const client = await this.getClientById(clientId);
      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      // Verificar se tem dados associados
      const hasUsers = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM users WHERE client_id = ?
      `, [clientId]);

      const hasCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE client_id = ?
      `, [clientId]);

      const hasMedia = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias WHERE client_id = ?
      `, [clientId]);

      if (hasUsers.count > 0 || hasCampaigns.count > 0 || hasMedia.count > 0) {
        throw new Error('Não é possível remover cliente com dados associados. Desative-o primeiro.');
      }

      // Desativar cliente (soft delete)
      await this.db.executeRaw(`
        UPDATE clients 
        SET active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = ?
      `, [clientId]);

      // Log de auditoria
      await this.getAuditService().log('client', 'deleted', deletedBy, {
        clientId,
        name: client.name
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover cliente:', error.message);
      throw error;
    }
  }

  /**
   * Busca estatísticas de um cliente
   */
  async getClientStats(clientId: number): Promise<{
    userCount: number;
    campaignCount: number;
    mediaCount: number;
    totemCount: number;
  }> {
    try {
      // Contar usuários
      const userCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM users WHERE client_id = ? AND is_active = 1
      `, [clientId]);

      // Contar campanhas
      const campaignCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE client_id = ? AND is_active = 1
      `, [clientId]);

      // Contar mídia
      const mediaCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias WHERE client_id = ?
      `, [clientId]);

      // Contar totems (via campanhas)
      const totemCountResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT ct.totem_id) as count
        FROM campaign_totems ct
        JOIN campaigns c ON ct.campaign_id = c.campaign_id
        WHERE c.client_id = ? AND c.is_active = 1
      `, [clientId]);

      return {
        userCount: userCountResult?.count || 0,
        campaignCount: campaignCountResult?.count || 0,
        mediaCount: mediaCountResult?.count || 0,
        totemCount: totemCountResult?.count || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas do cliente:', error.message);
      return {
        userCount: 0,
        campaignCount: 0,
        mediaCount: 0,
        totemCount: 0
      };
    }
  }

  /**
   * Busca estatísticas gerais de clientes
   */
  async getClientsStats(): Promise<ClientStats> {
    try {
      // Total de clientes
      const totalClientsResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM clients
      `);

      // Clientes ativos
      const activeClientsResult = await this.db.findFirst(`
        SELECT COUNT(*) as active FROM clients WHERE active = 1
      `);

      // Clientes inativos
      const inactiveClientsResult = await this.db.findFirst(`
        SELECT COUNT(*) as inactive FROM clients WHERE active = 0
      `);

      // Total de usuários
      const totalUsersResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM users WHERE is_active = 1
      `);

      // Total de campanhas
      const totalCampaignsResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM campaigns WHERE is_active = 1
      `);

      // Total de mídia
      const totalMediaResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM medias
      `);

      // Total de totems
      const totalTotemsResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM totems WHERE active = 1
      `);

      // Atividade recente (últimos 7 dias)
      const recentClientsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM clients WHERE created_at >= datetime('now', '-7 days')
      `);

      const recentCampaignsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE created_at >= datetime('now', '-7 days')
      `);

      const recentMediaResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias WHERE created_at >= datetime('now', '-7 days')
      `);

      return {
        totalClients: totalClientsResult?.total || 0,
        activeClients: activeClientsResult?.active || 0,
        inactiveClients: inactiveClientsResult?.inactive || 0,
        totalUsers: totalUsersResult?.total || 0,
        totalCampaigns: totalCampaignsResult?.total || 0,
        totalMedia: totalMediaResult?.total || 0,
        totalTotems: totalTotemsResult?.total || 0,
        recentActivity: {
          newClients: recentClientsResult?.count || 0,
          newCampaigns: recentCampaignsResult?.count || 0,
          newMedia: recentMediaResult?.count || 0
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas gerais:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca clientes por nome (autocomplete)
   */
  async searchClients(query: string, limit: number = 10): Promise<ClientResponse[]> {
    try {
      const clients = await this.db.findMany(`
        SELECT 
          c.client_id as id,
          c.name,
          c.contact_name as contactName,
          c.email,
          c.phone,
          c.wths,
          c.active,
          c.created_at as createdAt,
          c.updated_at as updatedAt
        FROM clients c
        WHERE c.active = 1 AND (
          c.name LIKE ? OR 
          c.contact_name LIKE ? OR 
          c.email LIKE ?
        )
        ORDER BY c.name
        LIMIT ?
      `, [`%${query}%`, `%${query}%`, `%${query}%`, limit]);

      return clients;

    } catch (error: any) {
      console.error('❌ Erro ao buscar clientes:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca histórico de atividades do cliente
   */
  async getClientActivity(clientId: number, limit: number = 50): Promise<any[]> {
    try {
      const activities = await this.db.findMany(`
        SELECT 
          al.action,
          al.entity,
          al.entity_id,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.user_id
        WHERE al.entity = 'client' AND al.entity_id = ?
        ORDER BY al.timestamp DESC
        LIMIT ?
      `, [clientId, limit]);

      return activities;

    } catch (error: any) {
      console.error('❌ Erro ao buscar atividades do cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totems de um cliente
   */
  async getClientTotems(clientId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.location,
          t.uin,
          t.is_active as isActive,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt
        FROM totems t
        WHERE t.client_id = ?
        ORDER BY t.name
      `, [clientId]);

      return totems;
    } catch (error: any) {
      console.error('❌ Erro ao buscar totems do cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanhas de um cliente
   */
  async getClientCampaigns(clientId: number): Promise<any[]> {
    try {
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.name,
          c.description,
          c.status,
          c.start_date as startDate,
          c.end_date as endDate,
          c.created_at as createdAt
        FROM campaigns c
        WHERE c.client_id = ?
        ORDER BY c.created_at DESC
      `, [clientId]);

      return campaigns;
    } catch (error: any) {
      console.error('❌ Erro ao buscar campanhas do cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca analytics de um cliente
   */
  async getClientAnalytics(clientId: number, filters: any): Promise<any> {
    try {
      // Implementação básica de analytics
      const stats = await this.db.findFirst(`
        SELECT 
          COUNT(DISTINCT t.totem_id) as totalTotems,
          COUNT(DISTINCT c.campaign_id) as totalCampaigns,
          COUNT(DISTINCT m.media_id) as totalMedia
        FROM clients cl
        LEFT JOIN totems t ON cl.client_id = t.client_id
        LEFT JOIN campaigns c ON cl.client_id = c.client_id
        LEFT JOIN media m ON cl.client_id = m.client_id
        WHERE cl.client_id = ?
      `, [clientId]);

      return {
        clientId,
        stats,
        period: filters.period || '30d'
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar analytics do cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Publisher {
  publisher_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  is_subscriber: boolean;
  is_publisher: boolean;
  client_type: 'subscriber' | 'publisher' | 'both';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePublisherRequest {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
}

export interface UpdatePublisherRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
  active?: boolean;
}

export interface PublisherListResponse {
  data: Publisher[];
  total: number;
  page: number;
  limit: number;
}

export class PublisherService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar publishers (publicadores) com paginação e filtros
   */
  async getAllPublishers(params: {
    page?: number;
    limit?: number;
    search?: string;
    client_type?: 'subscriber' | 'publisher' | 'both';
    active_only?: boolean;
  }): Promise<PublisherListResponse> {
    try {
      const { page = 1, limit = 10, search, client_type, active_only = true } = params;
      const offset = (page - 1) * limit;

      let whereClause = active_only ? 'WHERE p.active = true' : 'WHERE 1=1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (p.name ILIKE $' + (queryParams.length + 1) + ' OR p.email ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      if (client_type) {
        whereClause += ' AND p.client_type = $' + (queryParams.length + 1);
        queryParams.push(client_type);
      }

      // Buscar publishers
      const publishers = await this.db.findMany(`
        SELECT 
          p.publisher_id,
          p.name,
          p.contact_name,
          p.email,
          p.phone,
          p.whatsapp,
          p.description,
          p.is_subscriber,
          p.is_publisher,
          p.client_type,
          p.active,
          p.created_at,
          p.updated_at
        FROM publishers p
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM publishers p
        ${whereClause}
      `, queryParams);

      return {
        data: publishers,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar publishers', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter publisher por ID
   */
  async getPublisherById(id: number): Promise<Publisher | null> {
    try {
      const publisher = await this.db.findFirst(`
        SELECT 
          p.publisher_id,
          p.name,
          p.contact_name,
          p.email,
          p.phone,
          p.whatsapp,
          p.description,
          p.is_subscriber,
          p.is_publisher,
          p.client_type,
          p.active,
          p.created_at,
          p.updated_at
        FROM publishers p
        WHERE p.publisher_id = $1
      `, [id]);

      return publisher;
    } catch (error: any) {
      await logError('Erro ao obter publisher', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo publisher (publicador)
   */
  async createPublisher(data: CreatePublisherRequest): Promise<Publisher> {
    try {
      const { 
        name, 
        contact_name, 
        email, 
        phone, 
        whatsapp, 
        description,
        is_subscriber = false,
        is_publisher = true,
        client_type = 'publisher'
      } = data;

      // Validar client_type baseado nos flags
      let finalClientType = client_type;
      if (is_subscriber && is_publisher) {
        finalClientType = 'both';
      } else if (is_subscriber) {
        finalClientType = 'subscriber';
      } else if (is_publisher) {
        finalClientType = 'publisher';
      }

      // Verificar se publisher já existe
      const existingPublisher = await this.db.findFirst(`
        SELECT publisher_id FROM publishers WHERE name = $1
      `, [name]);

      if (existingPublisher) {
        throw new Error('Publisher com este nome já existe');
      }

      // Criar publisher
      const result = await this.db.executeRaw(`
        INSERT INTO publishers (
          name, contact_name, email, phone, whatsapp, description,
          is_subscriber, is_publisher, client_type, active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING publisher_id
      `, [name, contact_name, email, phone, whatsapp, description, is_subscriber, is_publisher, finalClientType]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar publisher');
      }

      const publisherId = result.rows[0].publisher_id;
      const newPublisher = await this.getPublisherById(publisherId);

      if (!newPublisher) {
        throw new Error('Erro ao buscar publisher criado');
      }

      return newPublisher;
    } catch (error: any) {
      await logError('Erro ao criar publisher', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar publisher
   */
  async updatePublisher(id: number, data: UpdatePublisherRequest): Promise<Publisher> {
    try {
      const { 
        name, 
        contact_name, 
        email, 
        phone, 
        whatsapp, 
        description,
        is_subscriber,
        is_publisher,
        client_type,
        active 
      } = data;

      // Verificar se publisher existe
      const existingPublisher = await this.getPublisherById(id);
      if (!existingPublisher) {
        throw new Error('Publisher não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingPublisher.name) {
        const publisherWithSameName = await this.db.findFirst(`
          SELECT publisher_id FROM publishers WHERE name = $1 AND publisher_id != $2
        `, [name, id]);

        if (publisherWithSameName) {
          throw new Error('Publisher com este nome já existe');
        }
      }

      // Determinar client_type final
      let finalClientType = client_type || existingPublisher.client_type;
      if (is_subscriber !== undefined || is_publisher !== undefined) {
        const finalIsSubscriber = is_subscriber !== undefined ? is_subscriber : existingPublisher.is_subscriber;
        const finalIsPublisher = is_publisher !== undefined ? is_publisher : existingPublisher.is_publisher;
        
        if (finalIsSubscriber && finalIsPublisher) {
          finalClientType = 'both';
        } else if (finalIsSubscriber) {
          finalClientType = 'subscriber';
        } else if (finalIsPublisher) {
          finalClientType = 'publisher';
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(name);
        paramIndex++;
      }

      if (contact_name !== undefined) {
        updateFields.push(`contact_name = $${paramIndex}`);
        updateParams.push(contact_name);
        paramIndex++;
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex}`);
        updateParams.push(email);
        paramIndex++;
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateParams.push(phone);
        paramIndex++;
      }

      if (whatsapp !== undefined) {
        updateFields.push(`whatsapp = $${paramIndex}`);
        updateParams.push(whatsapp);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(description);
        paramIndex++;
      }

      if (is_subscriber !== undefined) {
        updateFields.push(`is_subscriber = $${paramIndex}`);
        updateParams.push(is_subscriber);
        paramIndex++;
      }

      if (is_publisher !== undefined) {
        updateFields.push(`is_publisher = $${paramIndex}`);
        updateParams.push(is_publisher);
        paramIndex++;
      }

      if (client_type || is_subscriber !== undefined || is_publisher !== undefined) {
        updateFields.push(`client_type = $${paramIndex}`);
        updateParams.push(finalClientType);
        paramIndex++;
      }

      if (active !== undefined) {
        updateFields.push(`active = $${paramIndex}`);
        updateParams.push(active);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE publishers 
        SET ${updateFields.join(', ')}
        WHERE publisher_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedPublisher = await this.getPublisherById(id);
      if (!updatedPublisher) {
        throw new Error('Erro ao buscar publisher atualizado');
      }

      return updatedPublisher;
    } catch (error: any) {
      await logError('Erro ao atualizar publisher', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir publisher (soft delete)
   */
  async deletePublisher(id: number): Promise<void> {
    try {
      // Verificar se publisher existe
      const existingPublisher = await this.getPublisherById(id);
      if (!existingPublisher) {
        throw new Error('Publisher não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE publishers 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE publisher_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir publisher', error, { id });
      throw error;
    }
  }
}

// Instância global do serviço
let publisherServiceInstance: PublisherService;

export function getPublisherService(): PublisherService {
  if (!publisherServiceInstance) {
    publisherServiceInstance = new PublisherService();
  }
  return publisherServiceInstance;
}


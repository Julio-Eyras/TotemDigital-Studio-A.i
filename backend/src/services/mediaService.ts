/**
 * Media Service - Smart Signage v2.1
 * Serviço de gerenciamento de mídia
 * 
 * Logging: Usa arquivos locais para logs operacionais
 */

import fs from 'fs';
import sharp from 'sharp';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { StorageService } from './storageService';
import { logError, logWarn } from '../utils/loggerHelper';

export interface CreateMediaRequest {
  name: string;
  description?: string;
  tags?: string[];
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  subscriberId: number; // FK para subscribers (anunciante)
  createdBy: number; // User ID que está criando
}

export interface UpdateMediaRequest {
  name?: string;
  description?: string;
  tags?: string[];
  status?: string; // draft, pending_approval, approved, rejected, archived
  approvalStatus?: string; // pending, approved, rejected
  rejectionReason?: string;
}

export interface MediaResponse {
  id: number;
  subscriberId: number; // FK para subscribers
  subscriberName?: string; // Nome do subscriber (anunciante)
  subscriberEmail?: string;
  subscriberPhone?: string;
  subscriberAddress?: string;
  subscriberIsActive?: boolean;
  
  name: string;
  description?: string;
  tags: string[]; // TEXT[] array
  
  filePath: string;
  fileName: string; // Nome do arquivo original
  fileSizeBytes: number; // BIGINT
  
  mediaType: string; // video, image, html, widget, iframe, audio, pdf
  mimeType?: string;
  
  durationSeconds?: number; // Para vídeos
  width?: number; // Para imagens/vídeos
  height?: number; // Para imagens/vídeos
  
  thumbnailUrl?: string;
  previewUrl?: string;
  
  status: string; // draft, pending_approval, approved, rejected, archived
  approvalStatus?: string; // pending, approved, rejected
  rejectionReason?: string;
  
  approvedBy?: number; // FK para users (tenant user que aprovou)
  approvedByName?: string; // Nome do usuário que aprovou
  approvedAt?: string; // Timestamp de aprovação
  
  metadata?: any; // JSONB metadados adicionais
  isActive: boolean;
  
  createdAt: string;
  updatedAt: string;
  
  // URLs calculadas
  downloadUrl?: string;
  thumbnailUrlComputed?: string; // Alias para thumbnailUrl
}

export interface MediaStats {
  total: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  totalSize: number;
  recentActivity: {
    newMedia: number;
    published: number;
    archived: number;
  };
}

export class MediaService {
  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }
  
  private getStorageService(): StorageService {
    if (!(global as any).storageServiceInstance) {
      (global as any).storageServiceInstance = new StorageService();
    }
    return (global as any).storageServiceInstance;
  }

  /**
   * Lista toda a mídia (alias para getMedia)
   * @param filters Filtros de busca
   * @param subscriberId Subscriber ID para isolamento (se fornecido, filtra apenas mídias deste subscriber)
   * @param isAdmin Se true, ignora isolamento e mostra todas as mídias
   */
  async getAllMedia(filters: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    subscriberId?: number;
  }, subscriberId?: number, isAdmin: boolean = false): Promise<any> {
    if (!this.db) {
      throw new Error('Database não inicializado. Chame initializeDatabase() primeiro.');
    }
    const result = await this.getMedia(
      filters.page || 1,
      filters.limit || 1000,
      {
        subscriberId: filters.subscriberId,
        mediaType: filters.type,
        search: filters.search
      },
      subscriberId,
      isAdmin
    );
    return result;
  }

  /**
   * Lista mídia com paginação e filtros
   * @param page Página atual
   * @param limit Itens por página
   * @param filters Filtros de busca
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para isolamento)
   * @param isAdmin Se true, ignora isolamento e mostra todas as mídias
   */
  async getMedia(
    page: number = 1,
    limit: number = 20,
    filters: {
      subscriberId?: number;
      mediaType?: string;
      status?: string;
      search?: string;
    } = {},
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<{ media: MediaResponse[]; total: number; page: number; limit: number }> {
    if (!this.db) {
      throw new Error('Database não inicializado. Chame initializeDatabase() primeiro.');
    }
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar isolamento por subscriber (exceto para admin)
      if (!isAdmin && requestSubscriberId) {
        whereClause += ' AND m.subscriber_id = $' + (params.length + 1);
        params.push(requestSubscriberId);
      } else if (filters.subscriberId) {
        // Se admin especificou um subscriberId, filtrar por ele
        whereClause += ' AND m.subscriber_id = $' + (params.length + 1);
        params.push(filters.subscriberId);
      }

      if (filters.mediaType) {
        whereClause += ' AND m.media_type = $' + (params.length + 1);
        params.push(filters.mediaType);
      }

      if (filters.status) {
        whereClause += ' AND m.status = $' + (params.length + 1);
        params.push(filters.status);
      }

      if (filters.search) {
        whereClause += ' AND (m.name ILIKE $' + (params.length + 1) + ' OR m.description ILIKE $' + (params.length + 2) + ')';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar mídia com todos os campos do schema v2
      const media = await this.db.findMany(`
        SELECT 
          m.media_id as id,
          m.subscriber_id as "subscriberId",
          m.name,
          m.description,
          m.tags,
          m.file_path as "filePath",
          m.file_name as "fileName",
          m.file_size_bytes as "fileSizeBytes",
          m.media_type as "mediaType",
          m.mime_type as "mimeType",
          m.duration_seconds as "durationSeconds",
          m.width,
          m.height,
          m.thumbnail_url as "thumbnailUrl",
          m.preview_url as "previewUrl",
          m.status,
          m.approval_status as "approvalStatus",
          m.rejection_reason as "rejectionReason",
          m.approved_by as "approvedBy",
          m.approved_at as "approvedAt",
          m.metadata,
          m.is_active as "isActive",
          m.created_at as "createdAt",
          m.updated_at as "updatedAt",
          -- Dados do subscriber
          s.name as "subscriberName",
          s.email as "subscriberEmail",
          s.phone as "subscriberPhone",
          s.address as "subscriberAddress",
          s.is_active as "subscriberIsActive",
          -- Dados do usuário que aprovou
          u.username as "approvedByName"
        FROM medias m
        LEFT JOIN subscribers s ON m.subscriber_id = s.subscriber_id
        LEFT JOIN users u ON m.approved_by = u.id
        ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM medias m
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar mídia - mapear campos do banco para interface MediaResponse
      const processedMedia = media.map(item => {
        // Processar tags (TEXT[] array do PostgreSQL)
        let processedTags: string[] = [];
        if (item.tags) {
          if (Array.isArray(item.tags)) {
            processedTags = item.tags;
          } else if (typeof item.tags === 'string') {
            try {
              // Tentar parsear se for JSON
              processedTags = JSON.parse(item.tags);
            } catch {
              // Se não for JSON, tratar como string simples ou array separado por vírgula
              processedTags = item.tags.includes(',') ? item.tags.split(',').map((t: string) => t.trim()) : [item.tags];
            }
          }
        }

        // Processar metadata (JSONB)
        let processedMetadata: any = null;
        if (item.metadata) {
          if (typeof item.metadata === 'string') {
            try {
              processedMetadata = JSON.parse(item.metadata);
            } catch {
              processedMetadata = item.metadata;
            }
          } else {
            processedMetadata = item.metadata;
          }
        }

        const filePath = item.filePath || item.filepath || null;
        const downloadUrl = filePath ? this.getDownloadUrl(filePath) : '';
        const thumbnailUrl = item.thumbnailUrl || item.thumbnailurl || (filePath ? this.getThumbnailUrl(filePath, item.mediaType || item.mediaType) : '');
        
        return {
          id: item.id,
          subscriberId: item.subscriberId || item.subscriber_id,
          subscriberName: item.subscriberName || item.subscribername,
          subscriberEmail: item.subscriberEmail || item.subscriberemail,
          subscriberPhone: item.subscriberPhone || item.subscriberphone,
          subscriberAddress: item.subscriberAddress || item.subscriberaddress,
          subscriberIsActive: item.subscriberIsActive !== undefined ? item.subscriberIsActive : (item.subscriberisactive !== undefined ? item.subscriberisactive : true),
          name: item.name,
          description: item.description || null,
          tags: processedTags,
          filePath: filePath,
          fileName: item.fileName || item.filename || null,
          fileSizeBytes: item.fileSizeBytes || item.filesizebytes || item.sizeBytes || 0,
          mediaType: item.mediaType || item.mediatype || null,
          mimeType: item.mimeType || item.mimetype || null,
          durationSeconds: item.durationSeconds || item.durationseconds || null,
          width: item.width || null,
          height: item.height || null,
          thumbnailUrl: thumbnailUrl,
          previewUrl: item.previewUrl || item.previewurl || thumbnailUrl,
          status: item.status || 'draft',
          approvalStatus: item.approvalStatus || item.approvalstatus || null,
          rejectionReason: item.rejectionReason || item.rejectionreason || null,
          approvedBy: item.approvedBy || item.approvedby || null,
          approvedByName: item.approvedByName || item.approvedbyname || null,
          approvedAt: item.approvedAt || item.approvedat || null,
          metadata: processedMetadata,
          isActive: item.isActive !== undefined ? item.isActive : (item.isactive !== undefined ? item.isactive : true),
          createdAt: item.createdAt || item.createdat || new Date().toISOString(),
          updatedAt: item.updatedAt || item.updatedat || new Date().toISOString(),
          downloadUrl: downloadUrl,
          thumbnailUrlComputed: thumbnailUrl
        } as MediaResponse;
      });

      return {
        media: processedMedia,
        total,
        page,
        limit
      };

    } catch (error: any) {
      await logError('Erro ao buscar mídia', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca mídia por ID
   * @param mediaId ID da mídia
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para validação de ownership)
   * @param isAdmin Se true, ignora validação de ownership
   */
  async getMediaById(mediaId: number, requestSubscriberId?: number, isAdmin: boolean = false): Promise<MediaResponse | null> {
    try {
      const media = await this.db.findFirst(`
        SELECT 
          m.media_id as id,
          m.subscriber_id as "subscriberId",
          m.name,
          m.description,
          m.tags,
          m.file_path as "filePath",
          m.file_name as "fileName",
          m.file_size_bytes as "fileSizeBytes",
          m.media_type as "mediaType",
          m.mime_type as "mimeType",
          m.duration_seconds as "durationSeconds",
          m.width,
          m.height,
          m.thumbnail_url as "thumbnailUrl",
          m.preview_url as "previewUrl",
          m.status,
          m.approval_status as "approvalStatus",
          m.rejection_reason as "rejectionReason",
          m.approved_by as "approvedBy",
          m.approved_at as "approvedAt",
          m.metadata,
          m.is_active as "isActive",
          m.created_at as "createdAt",
          m.updated_at as "updatedAt",
          -- Dados do subscriber
          s.name as "subscriberName",
          s.email as "subscriberEmail",
          s.phone as "subscriberPhone",
          s.address as "subscriberAddress",
          s.is_active as "subscriberIsActive",
          -- Dados do usuário que aprovou
          u.username as "approvedByName"
        FROM medias m
        LEFT JOIN subscribers s ON m.subscriber_id = s.subscriber_id
        LEFT JOIN users u ON m.approved_by = u.id
        WHERE m.media_id = $1
      `, [mediaId]);

      if (!media) {
        return null;
      }

      // Validar ownership (exceto para admin)
      if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: mídia não pertence a este subscriber');
      }

      // Processar tags (TEXT[] array)
      let processedTags: string[] = [];
      if (media.tags) {
        if (Array.isArray(media.tags)) {
          processedTags = media.tags;
        } else if (typeof media.tags === 'string') {
          try {
            processedTags = JSON.parse(media.tags);
          } catch {
            processedTags = media.tags.includes(',') ? media.tags.split(',').map((t: string) => t.trim()) : [media.tags];
          }
        }
      }

      // Processar metadata (JSONB)
      let processedMetadata: any = null;
      if (media.metadata) {
        if (typeof media.metadata === 'string') {
          try {
            processedMetadata = JSON.parse(media.metadata);
          } catch {
            processedMetadata = media.metadata;
          }
        } else {
          processedMetadata = media.metadata;
        }
      }

      const filePath = media.filePath || media.filepath || null;
      const downloadUrl = filePath ? this.getDownloadUrl(filePath) : '';
      const thumbnailUrl = media.thumbnailUrl || media.thumbnailurl || (filePath ? this.getThumbnailUrl(filePath, media.mediaType || media.mediaType) : '');

      return {
        id: media.id,
        subscriberId: media.subscriberId || media.subscriber_id,
        subscriberName: media.subscriberName || media.subscribername,
        subscriberEmail: media.subscriberEmail || media.subscriberemail,
        subscriberPhone: media.subscriberPhone || media.subscriberphone,
        subscriberAddress: media.subscriberAddress || media.subscriberaddress,
        subscriberIsActive: media.subscriberIsActive !== undefined ? media.subscriberIsActive : (media.subscriberisactive !== undefined ? media.subscriberisactive : true),
        name: media.name,
        description: media.description || null,
        tags: processedTags,
        filePath: filePath,
        fileName: media.fileName || media.filename || null,
        fileSizeBytes: media.fileSizeBytes || media.filesizebytes || 0,
        mediaType: media.mediaType || media.mediatype || null,
        mimeType: media.mimeType || media.mimetype || null,
        durationSeconds: media.durationSeconds || media.durationseconds || null,
        width: media.width || null,
        height: media.height || null,
        thumbnailUrl: thumbnailUrl,
        previewUrl: media.previewUrl || media.previewurl || thumbnailUrl,
        status: media.status || 'draft',
        approvalStatus: media.approvalStatus || media.approvalstatus || null,
        rejectionReason: media.rejectionReason || media.rejectionreason || null,
        approvedBy: media.approvedBy || media.approvedby || null,
        approvedByName: media.approvedByName || media.approvedbyname || null,
        approvedAt: media.approvedAt || media.approvedat || null,
        metadata: processedMetadata,
        isActive: media.isActive !== undefined ? media.isActive : (media.isactive !== undefined ? media.isactive : true),
        createdAt: media.createdAt || media.createdat || new Date().toISOString(),
        updatedAt: media.updatedAt || media.updatedat || new Date().toISOString(),
        downloadUrl: downloadUrl,
        thumbnailUrlComputed: thumbnailUrl
      } as MediaResponse;

    } catch (error: any) {
      await logError('Erro ao buscar mídia por ID', error, { mediaId });
      throw error.message?.includes('Acesso negado') ? error : new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria múltiplas mídias
   * @param files Array de arquivos
   * @param subscriberId Subscriber ID (obrigatório)
   * @param createdBy User ID que está criando
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para validação)
   * @param isAdmin Se true, ignora validação de ownership
   */
  async createMultipleMedia(
    files: any[], 
    subscriberId: number, 
    createdBy: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse[]> {
    try {
      // Validar ownership (exceto para admin)
      if (!isAdmin && requestSubscriberId && subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: não é possível criar mídia para outro subscriber');
      }

      const results: MediaResponse[] = [];
      
      for (const file of files) {
        const mediaData: CreateMediaRequest = {
          name: file.originalname,
          description: '',
          tags: [],
          file: file,
          subscriberId: subscriberId,
          createdBy: createdBy
        };
        
        const media = await this.createMedia(mediaData, requestSubscriberId, isAdmin);
        results.push(media);
      }
      
      return results;
    } catch (error: any) {
      await logError('Erro ao criar múltiplas mídias', error, { count: files.length, subscriberId });
      throw error;
    }
  }

  /**
   * Cria nova mídia
   * @param data Dados da mídia
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para validação)
   * @param isAdmin Se true, ignora validação de ownership
   */
  async createMedia(
    data: CreateMediaRequest, 
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse> {
    try {
      const { name, description, tags, file, subscriberId, createdBy } = data;

      // Validar que subscriberId foi fornecido
      if (!subscriberId || subscriberId <= 0) {
        throw new Error('subscriber_id é obrigatório para criar mídia');
      }

      // Validar ownership (exceto para admin)
      if (!isAdmin && requestSubscriberId && subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: não é possível criar mídia para outro subscriber');
      }

      // Verificar se subscriber existe e está ativo
      const subscriber = await this.db.findFirst(`
        SELECT subscriber_id, is_active FROM subscribers WHERE subscriber_id = $1
      `, [subscriberId]);

      if (!subscriber) {
        throw new Error('Subscriber não encontrado');
      }

      if (!subscriber.is_active) {
        throw new Error('Subscriber não está ativo');
      }

      // Verificar se nome já existe para o subscriber
      const existingMedia = await this.db.findFirst(`
        SELECT media_id FROM medias WHERE name = $1 AND subscriber_id = $2
      `, [name, subscriberId]);

      if (existingMedia) {
        throw new Error('Nome de mídia já existe para este subscriber');
      }

      // Determinar tipo de mídia
      const mediaType = this.getMediaType(file.mimetype);

      // Salvar arquivo
      const filePath = await this.getStorageService().saveMediaFile(file, subscriberId, name);

      // Processar mídia (gerar thumbnail, extrair metadados)
      const metadata = await this.processMedia(file.buffer, file.mimetype, filePath);

      // Processar tags (TEXT[] array)
      let processedTags: string[] | null = null;
      if (tags && tags.length > 0) {
        processedTags = Array.isArray(tags) ? tags : [tags];
      }

      // Criar registro no banco (schema v2)
      const result = await this.db.executeRaw(`
        INSERT INTO medias (
          subscriber_id, name, description, tags,
          preview_url, status, approved_by, file_path, file_name, media_type,
          duration_seconds, file_size_bytes, mime_type, width, height
        )
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING media_id
      `, [
        subscriberId,
        name,
        description || null,
        processedTags,
        metadata.previewUrl || null,
        null, // approved_by inicialmente null
        filePath,
        file.originalname, // file_name
        mediaType,
        metadata.durationSeconds || null,
        file.size,
        file.mimetype,
        metadata.width || null,
        metadata.height || null
      ]);

      const insertedMedia = result?.rows?.[0];
      if (!insertedMedia?.media_id) {
        throw new Error('Erro ao criar mídia');
      }

      // Buscar mídia criada
      const newMedia = await this.getMediaById(insertedMedia.media_id, requestSubscriberId, isAdmin);
      if (!newMedia) {
        throw new Error('Erro ao buscar mídia criada');
      }

      // Log de auditoria
      await this.getAuditService().log('media', 'created', createdBy, {
        mediaId: newMedia.id,
        name: newMedia.name,
        mediaType: newMedia.mediaType,
        size: newMedia.fileSizeBytes,
        subscriberId: subscriberId
      });

      return newMedia;

    } catch (error: any) {
      await logError('Erro ao criar mídia', error, { name: data.name, subscriberId: data.subscriberId });
      throw error;
    }
  }

  /**
   * Atualiza mídia
   * @param mediaId ID da mídia
   * @param data Dados para atualizar
   * @param updatedBy User ID que está atualizando
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para validação)
   * @param isAdmin Se true, ignora validação de ownership
   */
  async updateMedia(
    mediaId: number, 
    data: UpdateMediaRequest, 
    updatedBy: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse> {
    try {
      // Verificar se mídia existe e validar ownership
      const existingMedia = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!existingMedia) {
        throw new Error('Mídia não encontrada');
      }

      // Validar ownership (exceto para admin)
      if (!isAdmin && requestSubscriberId && existingMedia.subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: mídia não pertence a este subscriber');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description);
      }

      if (data.tags !== undefined) {
        // tags é TEXT[] array no PostgreSQL
        updates.push(`tags = $${paramIndex++}`);
        params.push(Array.isArray(data.tags) ? data.tags : [data.tags]);
      }

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(data.status);
      }

      if (data.approvalStatus !== undefined) {
        updates.push(`approval_status = $${paramIndex++}`);
        params.push(data.approvalStatus);
      }

      if (data.rejectionReason !== undefined) {
        updates.push(`rejection_reason = $${paramIndex++}`);
        params.push(data.rejectionReason);
      }

      if (updates.length === 0) {
        return existingMedia;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(mediaId);

      // Atualizar mídia
      await this.db.executeRaw(`
        UPDATE medias 
        SET ${updates.join(', ')}
        WHERE media_id = $${paramIndex}
      `, params);

      // Buscar mídia atualizada
      const updatedMedia = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!updatedMedia) {
        throw new Error('Erro ao buscar mídia atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('media', 'updated', updatedBy, {
        mediaId,
        changes: data,
        subscriberId: existingMedia.subscriberId
      });

      return updatedMedia;

    } catch (error: any) {
      await logError('Erro ao atualizar mídia', error, { mediaId, updateData: data });
      throw error;
    }
  }

  /**
   * Remove mídia
   * @param mediaId ID da mídia
   * @param deletedBy User ID que está deletando
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para validação)
   * @param isAdmin Se true, ignora validação de ownership
   */
  async deleteMedia(
    mediaId: number, 
    deletedBy: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se mídia existe e validar ownership
      const media = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!media) {
        throw new Error('Mídia não encontrada');
      }

      // Validar ownership (exceto para admin)
      if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: mídia não pertence a este subscriber');
      }

      // Verificar se está sendo usada em playlists
      const playlistUsage = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlist_items WHERE media_id = $1
      `, [mediaId]);

      if (playlistUsage && parseInt(playlistUsage.count) > 0) {
        throw new Error('Não é possível remover mídia que está sendo usada em playlists');
      }

      // Remover arquivo físico
      if (media.filePath) {
        await this.getStorageService().deleteMediaFile(media.filePath);
      }

      // Remover do banco
      await this.db.executeRaw(`
        DELETE FROM medias WHERE media_id = $1
      `, [mediaId]);

      // Log de auditoria
      await this.getAuditService().log('media', 'deleted', deletedBy, {
        mediaId,
        name: media.name,
        filePath: media.filePath,
        subscriberId: media.subscriberId
      });

    } catch (error: any) {
      await logError('Erro ao remover mídia', error, { mediaId });
      throw error;
    }
  }

  /**
   * Processa mídia (extrai metadados, gera thumbnail)
   */
  private async processMedia(buffer: Buffer, mimetype: string, filePath: string): Promise<{
    width?: number;
    height?: number;
    durationSeconds?: number;
    previewUrl?: string;
  }> {
    try {
      const result: any = {};

      if (mimetype.startsWith('image/')) {
        // Processar imagem
        const image = new sharp(buffer);
        const metadata = await (image as any).metadata();
        
        result.width = metadata.width;
        result.height = metadata.height;

        // Gerar thumbnail
        const thumbnailPath = await this.generateThumbnail(buffer, filePath);
        result.previewUrl = this.getThumbnailUrl(thumbnailPath, 'image');

      } else if (mimetype.startsWith('video/')) {
        // Para vídeo, você pode usar ffmpeg para extrair metadados
        // Por enquanto, vamos usar valores padrão
        result.durationSeconds = 0; // Implementar com ffmpeg
        result.width = 1920; // Implementar com ffmpeg
        result.height = 1080; // Implementar com ffmpeg

        // Gerar thumbnail do vídeo
        const thumbnailPath = await this.generateVideoThumbnail(buffer, filePath);
        result.previewUrl = this.getThumbnailUrl(thumbnailPath, 'video');

      } else if (mimetype.startsWith('audio/')) {
        // Para áudio, extrair duração
        result.durationSeconds = 0; // Implementar com ffmpeg
      }

      return result;

    } catch (error: any) {
      await logError('Erro ao processar mídia', error, { filePath, mimetype });
      return {};
    }
  }

  /**
   * Gera thumbnail de imagem
   */
  private async generateThumbnail(buffer: Buffer, filePath: string): Promise<string> {
    try {
      const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      
      await new sharp(buffer)
        .resize(300, 300)
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;

    } catch (error: any) {
      await logError('Erro ao gerar thumbnail', error, { filePath });
      return filePath;
    }
  }

  /**
   * Gera thumbnail de vídeo
   * Nota: Requer ffmpeg instalado no sistema para funcionar completamente
   */
  private async generateVideoThumbnail(_buffer: Buffer, filePath: string): Promise<string> {
    try {
      const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      
      // Verificar se ffmpeg está disponível
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        // Tentar usar ffmpeg para extrair frame do vídeo
        // Extrai frame no segundo 1 do vídeo
        await execAsync(`ffmpeg -i "${filePath}" -ss 00:00:01 -vframes 1 -vf "scale=300:300:force_original_aspect_ratio=decrease" "${thumbnailPath}"`);
        
        // Verificar se thumbnail foi criado
        if (fs.existsSync(thumbnailPath)) {
          return thumbnailPath;
        }
      } catch (ffmpegError: any) {
        // ffmpeg não disponível ou erro na execução
        await logWarn('ffmpeg não disponível. Thumbnail de vídeo não pode ser gerado', {
          filePath,
          suggestion: 'Instale ffmpeg para suporte completo: sudo apt-get install ffmpeg'
        });
        
        // Retornar caminho original como fallback
        return filePath;
      }

      return filePath;

    } catch (error: any) {
      await logError('Erro ao gerar thumbnail de vídeo', error, { filePath });
      return filePath;
    }
  }

  /**
   * Determina tipo de mídia baseado no MIME type
   */
  private getMediaType(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'other';
  }

  /**
   * Gera checksum do arquivo
   * @deprecated Não usado no schema v2.0 - removido checksum da tabela medias
   */
  // private async generateChecksum(buffer: Buffer): Promise<string> {
  //   const crypto = require('crypto');
  //   return crypto.createHash('md5').update(buffer).digest('hex');
  // }

  /**
   * Gera URL de download
   * Converte caminho absoluto para URL relativa que o Nginx pode servir
   * Exemplos:
   *   /opt/smart-signage/public/assets/uploads/file.jpg -> /assets/uploads/file.jpg
   *   /home/user/project/public/assets/uploads/uploads/file.jpg -> /assets/uploads/file.jpg
   *   /assets/uploads/file.jpg -> /assets/uploads/file.jpg (já está correto)
   */
  private getDownloadUrl(filePath: string | null | undefined): string {
    if (!filePath) {
      return '';
    }
    
    // Se já começa com /assets/, limpar e retornar
    if (filePath.startsWith('/assets/')) {
      // Remover duplicações de /assets/ no início e normalizar
      let cleaned = filePath.replace(/^\/assets+\//, '/assets/');
      // Remover duplicações de uploads/ no caminho
      cleaned = cleaned.replace(/uploads\/+/g, 'uploads/');
      return cleaned;
    }
    
    // Tentar extrair parte relativa após /public/assets/ ou /assets/
    let relativePath = filePath;
    
    // Caso 1: Caminho contém /public/assets/ (ex: /opt/smart-signage/public/assets/uploads/...)
    if (relativePath.includes('/public/assets/')) {
      const parts = relativePath.split('/public/assets/');
      if (parts.length > 1) {
        relativePath = parts[1];
      }
    }
    // Caso 2: Caminho contém /assets/ mas não /public/assets/ (ex: /home/user/project/assets/uploads/...)
    else if (relativePath.includes('/assets/')) {
      const parts = relativePath.split('/assets/');
      if (parts.length > 1) {
        relativePath = parts[1];
      }
    }
    // Caso 3: Caminho absoluto sem /assets/ - manter apenas o nome do arquivo ou último diretório
    else {
      // Extrair apenas a parte final relevante (client-X/medias/filename)
      const pathParts = relativePath.split('/');
      const assetsIndex = pathParts.findIndex(part => part === 'assets' || part === 'uploads');
      if (assetsIndex >= 0 && assetsIndex < pathParts.length - 1) {
        relativePath = pathParts.slice(assetsIndex).join('/');
      } else {
        // Último recurso: extrair apenas após 'uploads'
        const uploadsIndex = relativePath.indexOf('uploads');
        if (uploadsIndex >= 0) {
          relativePath = relativePath.substring(uploadsIndex);
        }
      }
    }
    
    // Limpar o caminho: remover duplicações de uploads/ e barras duplas
    relativePath = relativePath.replace(/uploads\/+/g, 'uploads/');
    relativePath = relativePath.replace(/\/+/g, '/');
    
    // Garantir que comece com /assets/ e não tenha duplicações
    if (!relativePath.startsWith('/assets/')) {
      relativePath = `/assets/${relativePath}`;
    }
    
    // Remover duplicações finais
    relativePath = relativePath.replace(/^\/assets+\//, '/assets/');
    relativePath = relativePath.replace(/uploads\/+/g, 'uploads/');
    relativePath = relativePath.replace(/\/+/g, '/');
    
    return relativePath;
  }

  /**
   * Gera URL de thumbnail
   */
  private getThumbnailUrl(filePath: string | null | undefined, mediaType: string): string {
    if (!filePath) {
      return '';
    }
    if (mediaType === 'image') {
      const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      return this.getDownloadUrl(thumbnailPath);
    }
    return this.getDownloadUrl(filePath);
  }

  /**
   * Busca thumbnail de mídia
   */
  async getThumbnail(mediaId: number): Promise<string | null> {
    try {
      const media = await this.getMediaById(mediaId);
      if (!media || !media.filePath) {
        return null;
      }
      
      // Construir caminho do thumbnail
      const thumbnailPath = media.filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      
      // Verificar se arquivo existe
      if (fs.existsSync(thumbnailPath)) {
        return thumbnailPath;
      }
      
      return null;
    } catch (error: any) {
      await logError('Erro ao buscar thumbnail', error, { mediaId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Processa mídia existente (gera thumbnails, otimiza, redimensiona)
   */
  async processMediaById(
    mediaId: number,
    options: {
      generateThumbnail?: boolean;
      optimize?: boolean;
      resize?: { width?: number; height?: number; fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' };
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    thumbnailUrl?: string;
    optimized?: boolean;
    resized?: boolean;
    metadata?: {
      width?: number;
      height?: number;
      size?: number;
    };
  }> {
    try {
      const media = await this.getMediaById(mediaId);
      if (!media || !media.filePath) {
        throw new Error('Mídia não encontrada ou sem caminho de arquivo');
      }

      // Verificar se arquivo existe
      if (!fs.existsSync(media.filePath)) {
        throw new Error('Arquivo de mídia não encontrado no sistema de arquivos');
      }

      const result: any = {
        success: true,
        message: 'Mídia processada com sucesso',
        optimized: false,
        resized: false
      };

      // Ler arquivo
      const fileBuffer = fs.readFileSync(media.filePath);

      // Processar apenas imagens por enquanto
      if (media.mediaType === 'image') {
        let image = (sharp as any)(fileBuffer);
        let metadata = await image.metadata();
        let processed = false;

        // Redimensionar se solicitado
        if (options.resize && (options.resize.width || options.resize.height)) {
          const width = options.resize.width || undefined;
          const height = options.resize.height || undefined;
          const fit = options.resize.fit || 'inside'; // Manter proporção por padrão

          image = image.resize(width, height, {
            fit: fit,
            withoutEnlargement: true // Não aumentar se menor
          });

          // Reprocessar para obter novos metadados
          metadata = await image.metadata();
          processed = true;
          result.resized = true;
          result.metadata = {
            width: metadata.width,
            height: metadata.height
          };
        }

        // Otimizar imagem
        if (options.optimize !== false) {
          const outputPath = media.filePath;
          
          // Determinar formato de saída baseado no original
          if (media.mimeType === 'image/jpeg' || media.mimeType === 'image/jpg') {
            image = image.jpeg({ quality: 85, progressive: true });
          } else if (media.mimeType === 'image/png') {
            image = image.png({ compressionLevel: 9, adaptiveFiltering: true });
          } else if (media.mimeType === 'image/webp') {
            image = image.webp({ quality: 85 });
          }

          // Salvar imagem otimizada
          await image.toFile(outputPath);
          processed = true;
          result.optimized = true;

          // Atualizar tamanho no banco
          const stats = fs.statSync(outputPath);
          await this.db.executeRaw(`
            UPDATE medias
            SET file_size_bytes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE media_id = ?
          `, [stats.size, mediaId]);

          result.metadata = {
            ...result.metadata,
            size: stats.size
          };
        }

        // Gerar thumbnail se solicitado ou se não existir
        if (options.generateThumbnail !== false) {
          const thumbnailPath = media.filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
          
          // Verificar se já existe
          if (!fs.existsSync(thumbnailPath) || options.generateThumbnail === true) {
            await (sharp as any)(fileBuffer)
              .resize(300, 300, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: 80, progressive: true })
              .toFile(thumbnailPath);

            result.thumbnailUrl = this.getThumbnailUrl(thumbnailPath, 'image');
            processed = true;
          } else {
            result.thumbnailUrl = this.getThumbnailUrl(thumbnailPath, 'image');
          }
        }

        // Atualizar metadados no banco se processado
        if (processed && result.metadata) {
          await this.db.executeRaw(`
            UPDATE medias
            SET width = ?, height = ?, file_size_bytes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE media_id = ?
          `, [
            result.metadata.width || metadata.width,
            result.metadata.height || metadata.height,
            result.metadata.size || metadata.size || 0,
            mediaId
          ]);
        }

        result.message = 'Imagem processada com sucesso';
        return result;

      } else if (media.mediaType === 'video') {
        // Para vídeos, apenas gerar thumbnail se solicitado
        if (options.generateThumbnail !== false) {
          const thumbnailPath = await this.generateVideoThumbnail(fileBuffer, media.filePath);
          if (thumbnailPath && thumbnailPath !== media.filePath) {
            result.thumbnailUrl = this.getThumbnailUrl(thumbnailPath, 'video');
            result.message = 'Thumbnail de vídeo gerado (requer ffmpeg para processamento completo)';
          } else {
            result.message = 'Processamento de vídeo requer ffmpeg. Thumbnail não gerado.';
          }
        } else {
          result.message = 'Processamento de vídeo requer ffmpeg. Apenas otimização de imagens está disponível.';
        }
        return result;

      } else {
        return {
          success: false,
          message: `Processamento não suportado para tipo de mídia: ${media.mediaType}`
        };
      }

    } catch (error: any) {
      await logError('Erro ao processar mídia', error, { mediaId });
      return {
        success: false,
        message: `Erro ao processar mídia: ${error.message}`
      };
    }
  }

  /**
   * Busca estatísticas de armazenamento
   */
  async getStorageStats(): Promise<any> {
    try {
      const stats = await this.db.findFirst(`
        SELECT
          COUNT(*) as totalFiles,
          SUM(size) as totalSize,
          AVG(size) as averageSize,
          MAX(size) as maxSize,
          MIN(size) as minSize
        FROM media
      `);

      return {
        totalFiles: stats.totalFiles || 0,
        totalSize: stats.totalSize || 0,
        averageSize: stats.averageSize || 0,
        maxSize: stats.maxSize || 0,
        minSize: stats.minSize || 0
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de armazenamento', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas de mídia
   * @param subscriberId Subscriber ID para filtrar (opcional)
   * @param requestSubscriberId Subscriber ID do usuário autenticado (para isolamento)
   * @param isAdmin Se true, ignora isolamento
   */
  async getMediaStats(
    subscriberId?: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaStats> {
    try {
      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      // Aplicar isolamento por subscriber (exceto para admin)
      if (!isAdmin && requestSubscriberId) {
        whereClause = `WHERE subscriber_id = $${paramIndex++}`;
        params.push(requestSubscriberId);
      } else if (subscriberId) {
        // Se admin especificou um subscriberId, filtrar por ele
        whereClause = `WHERE subscriber_id = $${paramIndex++}`;
        params.push(subscriberId);
      }

      // Total de mídia
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM medias ${whereClause}
      `, params);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT media_type as type, COUNT(*) as count
        FROM medias ${whereClause}
        GROUP BY media_type
        ORDER BY count DESC
      `, params);

      // Por status
      const byStatus = await this.db.findMany(`
        SELECT status, COUNT(*) as count
        FROM medias ${whereClause}
        GROUP BY status
        ORDER BY count DESC
      `, params);

      // Tamanho total
      const totalSizeResult = await this.db.findFirst(`
        SELECT SUM(file_size_bytes) as total FROM medias ${whereClause}
      `, params);

      // Atividade recente (últimos 7 dias) - PostgreSQL syntax
      const recentWhereClause = whereClause ? `${whereClause} AND` : 'WHERE';
      const recentMediaResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${recentWhereClause} created_at >= NOW() - INTERVAL '7 days'
      `, params);

      const publishedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${recentWhereClause} status = 'approved' AND updated_at >= NOW() - INTERVAL '7 days'
      `, params);

      const archivedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${recentWhereClause} status = 'archived' AND updated_at >= NOW() - INTERVAL '7 days'
      `, params);

      return {
        total: totalResult?.total || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count })),
        byStatus: byStatus.map(s => ({ status: s.status, count: s.count })),
        totalSize: totalSizeResult?.total || 0,
        recentActivity: {
          newMedia: recentMediaResult?.count || 0,
          published: publishedResult?.count || 0,
          archived: archivedResult?.count || 0
        }
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de mídia', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca mídia por tags
   */
  async getMediaByTags(tags: string[], clientId?: number): Promise<MediaResponse[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (clientId) {
        whereClause += ' AND m.subscriber_id = ?';
        params.push(clientId);
      }

      // Buscar mídia que contenha qualquer uma das tags
      const tagConditions = tags.map(() => 'm.tags LIKE ?').join(' OR ');
      whereClause += ` AND (${tagConditions})`;

      // Adicionar parâmetros para cada tag
      tags.forEach(tag => {
        params.push(`%"${tag}"%`);
      });

      const media = await this.db.findMany(`
        SELECT 
          m.media_id as id,
          m.name,
          m.name as title,
          m.description,
          m.tags,
          1 as version,
          '' as checksum,
          m.preview_url as previewUrl,
          m.status,
          m.approved_by as createdBy,
          m.file_path as filePath,
          m.media_type as mediaType,
          m.duration_seconds as durationSeconds,
          m.file_size_bytes as sizeBytes,
          m.mime_type as mimeType,
          m.width,
          m.height,
          m.created_at as createdAt,
          m.updated_at as updatedAt,
          s.name as clientName,
          u.username as authorName
        FROM medias m
        LEFT JOIN subscribers s ON m.subscriber_id = s.subscriber_id
        LEFT JOIN users u ON m.approved_by = u.id
        ${whereClause}
        ORDER BY m.created_at DESC
      `, params);

      return media.map(item => ({
        ...item,
        tags: item.tags ? (Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? (() => { try { return JSON.parse(item.tags); } catch { return item.tags.includes(',') ? item.tags.split(',').map((t: string) => t.trim()) : [item.tags]; } })() : [])) : [],
        downloadUrl: item.filePath ? this.getDownloadUrl(item.filePath) : '',
        thumbnailUrl: item.filePath ? this.getThumbnailUrl(item.filePath, item.mediaType) : ''
      }));

    } catch (error: any) {
      await logError('Erro ao buscar mídia por tags', error, { tags });
      throw new Error('Erro interno do servidor');
    }
  }
}


/**
 * Media Service - Smart Signage v2.1
 * Serviço de gerenciamento de mídia
 * 
 * Logging: Usa arquivos locais para logs operacionais
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { StorageService } from './storageService';
import { getCacheService } from './cacheService';
import { logError, logWarn } from '../utils/loggerHelper';
import { normalizeDownloadUrl, generateThumbnailUrl } from '../utils/pathHelper';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

const execFileAsync = promisify(execFile);

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
  
  private isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  /**
   * Normaliza previewUrl/thumbnailUrl vindos do banco:
   * - Mantém URLs absolutas (http/https) e endpoints internos (/api/...)
   * - Ignora caminhos legacy como /previews/* e /thumbnails/* (não garantidos no backend)
   * - Caso inválido/indesejado, cai para o fallback (tipicamente /api/media/:id/thumbnail)
   */
  private normalizePreviewUrl(raw: unknown, fallback: string): string {
    const v = (typeof raw === 'string' ? raw.trim() : '');
    if (!v) return fallback;
    if (v.startsWith('/api/')) return v;
    if (this.isAbsoluteUrl(v)) return v;
    if (v.startsWith('/previews/') || v.startsWith('/thumbnails/')) return fallback;
    return v;
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
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      createdFrom?: string;
      createdTo?: string;
      includeInactiveSubscribers?: boolean;
    } = {},
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<{ media: MediaResponse[]; total: number; page: number; limit: number }> {
    if (!this.db) {
      throw new Error('Database não inicializado. Chame initializeDatabase() primeiro.');
    }
    try {
      const offset = (page - 1) * limit;
      const includeInactiveSubscribers = !!filters.includeInactiveSubscribers;
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
        whereClause += ' AND LOWER(m.media_type) = LOWER($' + (params.length + 1) + ')';
        params.push(filters.mediaType);
      }

      if (filters.status) {
        whereClause += ' AND m.status = $' + (params.length + 1);
        params.push(filters.status);
      }

      if (filters.search) {
        whereClause += ' AND (m.name ILIKE $' + (params.length + 1) + ' OR m.description ILIKE $' + (params.length + 2) + ' OR m.file_name ILIKE $' + (params.length + 3) + ')';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Filtros de data de criação
      if (filters.createdFrom) {
        whereClause += ' AND m.created_at >= $' + (params.length + 1);
        params.push(filters.createdFrom);
      }
      if (filters.createdTo) {
        whereClause += ' AND m.created_at <= $' + (params.length + 1);
        params.push(filters.createdTo);
      }

      // Apenas mídias ativas
      whereClause += ' AND m.is_active = true';

      // Subscribers ativos por padrão; em modo diagnóstico (includeInactiveSubscribers=true) permitimos inativos
      if (!includeInactiveSubscribers) {
        whereClause += ' AND s.is_active = true';
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'name': 'm.name',
        'created_at': 'm.created_at',
        'updated_at': 'm.updated_at',
        'file_size_bytes': 'm.file_size_bytes',
        'media_type': 'm.media_type'
      };
      const sortBy = filters.sortBy || 'created_at';
      const sortField = validSortFields[sortBy] || 'm.created_at';
      const orderDirection = (filters.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
        JOIN subscribers s ON m.subscriber_id = s.subscriber_id
        LEFT JOIN users u ON m.approved_by = u.id
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM medias m
        JOIN subscribers s ON m.subscriber_id = s.subscriber_id
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
        // Para o frontend: sempre preferir endpoints da API (independente do layout de /assets no SO)
        const downloadUrl = item.id ? `/api/media/${item.id}/download` : (filePath ? normalizeDownloadUrl(filePath) : '');
        const thumbnailUrl = item.id ? `/api/media/${item.id}/thumbnail` : (item.thumbnailUrl || item.thumbnailurl || (filePath ? generateThumbnailUrl(filePath, item.mediaType || 'image') : ''));
        
        const previewUrl = this.normalizePreviewUrl(item.previewUrl || item.previewurl, thumbnailUrl);

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
          // previewUrl deve apontar para um recurso de preview/thumbnail (imagem/vídeo embed),
          // e NÃO para o endpoint de download.
          previewUrl,
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

  /** Apenas `subscriber_id` da mídia (para checagem de escopo na rota, sem expor o payload completo). */
  async getSubscriberIdForMedia(mediaId: number): Promise<number | null> {
    try {
      const row = await this.db.findFirst(
        `SELECT subscriber_id FROM medias WHERE media_id = $1`,
        [mediaId]
      );
      if (row == null || (row as any).subscriber_id == null) return null;
      const n = Number((row as any).subscriber_id);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch (error: any) {
      await logError('Erro ao resolver subscriber da mídia', error, { mediaId });
      return null;
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
      // Para o frontend: sempre preferir endpoints da API
      const downloadUrl = media.id ? `/api/media/${media.id}/download` : (filePath ? normalizeDownloadUrl(filePath) : '');
      const thumbnailUrl = media.id ? `/api/media/${media.id}/thumbnail` : (media.thumbnailUrl || media.thumbnailurl || (filePath ? generateThumbnailUrl(filePath, media.mediaType || 'image') : ''));
      const previewUrl = this.normalizePreviewUrl(media.previewUrl || media.previewurl, thumbnailUrl);

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
        previewUrl,
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

      // Modo TotemDigital compacto: mídia entra já aprovada (menos passos no PoC / instalação única).
      const initialStatus = TOTEMDIGITAL_COMPACT ? 'approved' : 'draft';
      const approvedByInitial = TOTEMDIGITAL_COMPACT ? createdBy : null;

      // Criar registro no banco (schema v2). Trigger sync_media_approval_status preenche approval_status / approved_at.
      const result = await this.db.executeRaw(`
        INSERT INTO medias (
          subscriber_id, name, description, tags,
          preview_url, status, approved_by, file_path, file_name, media_type,
          duration_seconds, file_size_bytes, mime_type, width, height
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING media_id
      `, [
        subscriberId,
        name,
        description || null,
        processedTags,
        metadata.previewUrl || null,
        initialStatus,
        approvedByInitial,
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

      // Invalidar cache
      await getCacheService().invalidateEntity('media', newMedia.id).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', subscriberId).catch(() => {});

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

      // Invalidar cache
      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', existingMedia.subscriberId).catch(() => {});

      return updatedMedia;

    } catch (error: any) {
      await logError('Erro ao atualizar mídia', error, { mediaId, updateData: data });
      throw error;
    }
  }

  /**
   * Rotaciona a mídia e grava definitivamente em formato vertical 9:16.
   * Imagens usam sharp; vídeos usam ffmpeg instalado no sistema.
   */
  async transformMediaToPortrait(
    mediaId: number,
    options: { rotationDegrees: number; fit?: '9:16' },
    updatedBy: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse> {
    const media = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
    if (!media || !media.filePath) {
      throw new Error('Mídia não encontrada ou sem arquivo físico');
    }

    if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
      throw new Error('Acesso negado: mídia não pertence a este subscriber');
    }

    const sourcePath = this.resolveExistingMediaPath(media.filePath);
    if (!sourcePath) {
      throw new Error('Arquivo físico da mídia não encontrado');
    }

    const normalizedRotation = this.normalizeRotation(options.rotationDegrees);
    if (normalizedRotation === 0) {
      return media;
    }

    const mediaType = String(media.mediaType || '').toLowerCase();
    if (mediaType !== 'image' && mediaType !== 'video') {
      throw new Error('Transformação disponível apenas para imagens e vídeos');
    }

    const ext = mediaType === 'video' ? '.mp4' : this.getImageOutputExtension(media.mimeType, sourcePath);
    const outputPath = this.getTransformedOutputPath(sourcePath, ext);
    const thumbnailPath = outputPath.replace(/\.[^/.]+$/, '_thumb.jpg');

    try {
      if (mediaType === 'image') {
        await this.transformImageToPortrait(sourcePath, outputPath, normalizedRotation, media.mimeType);
      } else {
        await this.transformVideoToPortrait(sourcePath, outputPath, normalizedRotation);
      }

      const stats = await fs.promises.stat(outputPath);
      const dimensions =
        mediaType === 'image'
          ? await (sharp as any)(outputPath).metadata()
          : { width: 1080, height: 1920 };

      if (mediaType === 'image') {
        const outputBuffer = await fs.promises.readFile(outputPath);
        await this.generateThumbnail(outputBuffer, outputPath);
      } else {
        await this.generateVideoThumbnail(Buffer.alloc(0), outputPath);
      }

      const nextMimeType = mediaType === 'video' ? 'video/mp4' : this.getImageMimeTypeFromExtension(ext);
      const nextFileName = path.basename(outputPath);
      const previewUrl = generateThumbnailUrl(thumbnailPath, mediaType);

      await this.db.executeRaw(`
        UPDATE medias
        SET file_path = $1,
            file_name = $2,
            file_size_bytes = $3,
            mime_type = $4,
            width = $5,
            height = $6,
            preview_url = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE media_id = $8
      `, [
        outputPath,
        nextFileName,
        stats.size,
        nextMimeType,
        dimensions.width || 1080,
        dimensions.height || 1920,
        previewUrl,
        mediaId,
      ]);

      await this.removeFileIfExists(sourcePath);
      await this.removeFileIfExists(sourcePath.replace(/\.[^/.]+$/, '_thumb.jpg'));

      await this.getAuditService().log('media', 'transformed', updatedBy, {
        mediaId,
        rotationDegrees: normalizedRotation,
        fit: options.fit || '9:16',
        subscriberId: media.subscriberId,
      });

      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', media.subscriberId).catch(() => {});

      const updatedMedia = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!updatedMedia) {
        throw new Error('Erro ao buscar mídia transformada');
      }
      return updatedMedia;
    } catch (error: any) {
      await this.removeFileIfExists(outputPath);
      await this.removeFileIfExists(thumbnailPath);
      await logError('Erro ao transformar mídia para 9:16', error, { mediaId, mediaType, sourcePath });
      throw error.message?.includes('ffmpeg')
        ? new Error('Não foi possível processar o vídeo. Verifique se o ffmpeg está instalado no servidor.')
        : error;
    }
  }

  private normalizeRotation(rotationDegrees: number): number {
    const n = Number(rotationDegrees);
    if (!Number.isFinite(n)) return 0;
    const normalized = ((Math.round(n / 90) * 90) % 360 + 360) % 360;
    return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
  }

  private resolveExistingMediaPath(filePath: string): string | null {
    if (fs.existsSync(filePath)) return filePath;
    const altPath = filePath
      .replace(/client-(\d+)/, 'subscriber-$1')
      .replace(/subscriber-(\d+)/, 'client-$1');
    if (altPath !== filePath && fs.existsSync(altPath)) return altPath;
    return null;
  }

  private getTransformedOutputPath(sourcePath: string, extension: string): string {
    const dir = path.dirname(sourcePath);
    const base = path.basename(sourcePath, path.extname(sourcePath));
    return path.join(dir, `${base}_portrait_${Date.now()}${extension}`);
  }

  private getImageOutputExtension(mimeType?: string, sourcePath?: string): string {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';

    const ext = path.extname(sourcePath || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
    return '.jpg';
  }

  private getImageMimeTypeFromExtension(extension: string): string {
    switch (extension.toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private async transformImageToPortrait(
    sourcePath: string,
    outputPath: string,
    rotationDegrees: number,
    mimeType?: string
  ): Promise<void> {
    let pipeline = (sharp as any)(sourcePath)
      .rotate(rotationDegrees)
      .resize(1080, 1920, { fit: 'cover', position: 'center' });

    const ext = this.getImageOutputExtension(mimeType, outputPath);
    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: 85 });
    } else {
      pipeline = pipeline.jpeg({ quality: 88, progressive: true });
    }

    await pipeline.toFile(outputPath);
  }

  private async transformVideoToPortrait(
    sourcePath: string,
    outputPath: string,
    rotationDegrees: number
  ): Promise<void> {
    const rotationFilters = this.getFfmpegRotationFilters(rotationDegrees);
    const filters = [
      ...rotationFilters,
      'scale=1080:1920:force_original_aspect_ratio=increase',
      'crop=1080:1920',
      'setsar=1',
    ].join(',');

    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      sourcePath,
      '-vf',
      filters,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }

  private getFfmpegRotationFilters(rotationDegrees: number): string[] {
    switch (rotationDegrees) {
      case 90:
        return ['transpose=1'];
      case 180:
        return ['transpose=1', 'transpose=1'];
      case 270:
        return ['transpose=2'];
      default:
        return [];
    }
  }

  private async removeFileIfExists(filePath?: string | null): Promise<void> {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Remoção best-effort: não falhar a transformação por limpeza de arquivo antigo.
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

      // Verificar se está sendo usada em playlists, campanhas ou totem playlists
      const [playlistUsage, campaignUsage, totemUsage] = await Promise.all([
        this.db.findFirst(`SELECT COUNT(*) as count FROM playlist_items WHERE media_id = $1`, [mediaId]),
        this.db.findFirst(`SELECT COUNT(*) as count FROM campaign_medias WHERE media_id = $1`, [mediaId]),
        this.db.findFirst(`SELECT COUNT(*) as count FROM totem_playlist_items WHERE media_id = $1`, [mediaId])
      ]);

      const inPlaylist = playlistUsage && parseInt(String(playlistUsage.count), 10) > 0;
      const inCampaign = campaignUsage && parseInt(String(campaignUsage.count), 10) > 0;
      const inTotem = totemUsage && parseInt(String(totemUsage.count), 10) > 0;
      if (inPlaylist) {
        throw new Error('Não é possível remover mídia que está sendo usada em playlists');
      }
      if (inCampaign) {
        throw new Error('Não é possível remover mídia que está sendo usada em campanhas');
      }
      if (inTotem) {
        throw new Error('Não é possível remover mídia que está sendo usada em playlists de totem');
      }

      // Remover arquivo físico (filePath pode vir como filePath ou file_path do banco)
      const filePathToDelete = media.filePath || (media as any).file_path;
      if (filePathToDelete) {
        await this.getStorageService().deleteMediaFile(filePathToDelete);
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

      // Invalidar cache
      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', media.subscriberId).catch(() => {});

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
        result.previewUrl = generateThumbnailUrl(thumbnailPath, 'image');

      } else if (mimetype.startsWith('video/')) {
        // Para vídeo, você pode usar ffmpeg para extrair metadados
        // Por enquanto, vamos usar valores padrão
        result.durationSeconds = 0; // Implementar com ffmpeg
        result.width = 1920; // Implementar com ffmpeg
        result.height = 1080; // Implementar com ffmpeg

        // Gerar thumbnail do vídeo
        const thumbnailPath = await this.generateVideoThumbnail(buffer, filePath);
        result.previewUrl = generateThumbnailUrl(thumbnailPath, 'video');

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

  // Métodos getDownloadUrl() e getThumbnailUrl() removidos - usar helpers de pathHelper.ts

  /**
   * Busca thumbnail de mídia
   * Compatível com caminhos antigos (client-X) e novos (subscriber-X)
   */
  async getThumbnail(mediaId: number): Promise<string | null> {
    try {
      const tmpDir = path.join(os.tmpdir(), 'smartsignage', 'thumbnails');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const placeholderPath = path.join(tmpDir, `placeholder-${mediaId}.jpg`);
      const generatedThumbPath = path.join(tmpDir, `media-${mediaId}.jpg`);

      const media = await this.getMediaById(mediaId);
      if (!media || !media.filePath) {
        return await this.ensurePlaceholderImage(placeholderPath);
      }

      // Função helper para verificar caminho com compatibilidade client-X/subscriber-X
      const checkFilePath = (filePath: string): string | null => {
        if (fs.existsSync(filePath)) {
          return filePath;
        }
        // Tentar caminho alternativo (client-X -> subscriber-X ou vice-versa)
        const altPath = filePath.replace(/client-(\d+)/, 'subscriber-$1').replace(/subscriber-(\d+)/, 'client-$1');
        if (altPath !== filePath && fs.existsSync(altPath)) {
          return altPath;
        }
        return null;
      };

      // 1) Se existir thumbnail ao lado do arquivo, usar
      const siblingThumb = media.filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      const existingSiblingThumb = checkFilePath(siblingThumb);
      if (existingSiblingThumb) {
        return existingSiblingThumb;
      }

      // 2) Se arquivo original existir e for imagem, gerar thumbnail em cache temporário
      const existingFilePath = checkFilePath(media.filePath);
      if (media.mediaType === 'image' && existingFilePath) {
        if (fs.existsSync(generatedThumbPath)) {
          return generatedThumbPath;
        }
        await (sharp as any)(existingFilePath)
          .resize(320, 180, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toFile(generatedThumbPath);
        return generatedThumbPath;
      }

      // 3) Fallback: placeholder
      return await this.ensurePlaceholderImage(placeholderPath);
    } catch (error: any) {
      await logError('Erro ao buscar thumbnail', error, { mediaId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera (ou reutiliza) um placeholder de thumbnail para evitar 404 no frontend.
   */
  private async ensurePlaceholderImage(outputPath: string): Promise<string> {
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    await (sharp as any)({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: { r: 45, g: 45, b: 45 }
      }
    })
      .jpeg({ quality: 80, progressive: true })
      .toFile(outputPath);
    return outputPath;
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

      // Ler arquivo de forma assíncrona para não bloquear event loop
      const fileBuffer = await fs.promises.readFile(media.filePath);

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
            SET file_size_bytes = $1, updated_at = CURRENT_TIMESTAMP
            WHERE media_id = $2
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

            result.thumbnailUrl = generateThumbnailUrl(thumbnailPath, 'image');
            processed = true;
          } else {
            result.thumbnailUrl = generateThumbnailUrl(thumbnailPath, 'image');
          }
        }

        // Atualizar metadados no banco se processado
        if (processed && result.metadata) {
          await this.db.executeRaw(`
            UPDATE medias
            SET width = $1, height = $2, file_size_bytes = $3, updated_at = CURRENT_TIMESTAMP
            WHERE media_id = $4
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
            result.thumbnailUrl = generateThumbnailUrl(thumbnailPath, 'video');
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
   * Schema v2: tabela medias com file_size_bytes
   */
  async getStorageStats(): Promise<any> {
    try {
      const stats = await this.db.findFirst(`
        SELECT
          COUNT(*)::bigint as totalFiles,
          COALESCE(SUM(file_size_bytes), 0)::bigint as totalSize,
          COALESCE(AVG(file_size_bytes), 0)::double precision as averageSize,
          COALESCE(MAX(file_size_bytes), 0)::bigint as maxSize,
          COALESCE(MIN(file_size_bytes), 0)::bigint as minSize
        FROM medias
        WHERE COALESCE(is_active, true) = true
      `);

      return {
        totalFiles: Number(stats?.totalFiles || 0),
        totalSize: Number(stats?.totalSize || 0),
        averageSize: Number(stats?.averageSize || 0),
        maxSize: Number(stats?.maxSize || 0),
        minSize: Number(stats?.minSize || 0)
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
   * PostgreSQL: tags é TEXT[], usa operador && para overlap ou ILIKE em unnest
   */
  async getMediaByTags(tags: string[], subscriberId?: number): Promise<MediaResponse[]> {
    try {
      let whereClause = 'WHERE COALESCE(m.is_active, true) = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (subscriberId) {
        whereClause += ` AND m.subscriber_id = $${paramIndex++}`;
        params.push(subscriberId);
      }

      // Buscar mídia que contenha qualquer uma das tags (PostgreSQL TEXT[] overlap)
      if (tags.length > 0) {
        whereClause += ` AND m.tags && $${paramIndex++}::text[]`;
        params.push(tags);
      }

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
        downloadUrl: item.filePath ? normalizeDownloadUrl(item.filePath) : '',
        thumbnailUrl: item.filePath ? generateThumbnailUrl(item.filePath, item.mediaType || 'image') : ''
      }));

    } catch (error: any) {
      await logError('Erro ao buscar mídia por tags', error, { tags });
      throw new Error('Erro interno do servidor');
    }
  }
}

// Lazy singleton accessor (padroniza com outros serviços e facilita testes/mocks)
export function getMediaService(): MediaService {
  if (!(global as any).mediaServiceInstance) {
    (global as any).mediaServiceInstance = new MediaService();
  }
  return (global as any).mediaServiceInstance;
}



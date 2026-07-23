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
import { isStudioRuntime } from '../config/installationRuntime';
import { isDirectTotemMode } from '../config/directTotemMode';
import { resolveSinglePublisherId } from './directTotemOrgService';
import { getMediaTotemSyncService } from './mediaTotemSyncService';
import {
  htmlBoardThumbPathForFile,
  writeHtmlBoardThumbnail,
} from './htmlBoardThumbnail';
import { findPublishPreset } from '../config/publishBoardDefaults';
import type { PublishBoardPresetType } from './publishBoardRenderService';
import {
  getMediaDeletionService,
  MediaInUseError,
  type ForceDeleteMediaResult,
  type MediaInUseConflictPayload,
} from './mediaDeletionService';

export type { ForceDeleteMediaResult, MediaInUseConflictPayload };
export { MediaInUseError };

const execFileAsync = promisify(execFile);

/** Entrega neutra (bake v5): pixels em pé; canvas portrait/landscape com cover (crop, sem pad). */
const TOTEM_PORTRAIT_WIDTH = 1080;
const TOTEM_PORTRAIT_HEIGHT = 1920;
const TOTEM_LANDSCAPE_WIDTH = 1920;
const TOTEM_LANDSCAPE_HEIGHT = 1080;
/** Legado (bake ≤2): canvas único 16:9. */
/** Bake ≥3: UI sempre portrait; cada totem aplica displayRotation + cache local. */
/** Bake ≥5: vídeo/imagem em cover (crop) em vez de contain (pad com barras). */
const DELIVERY_BAKE_VERSION_TAG = '_delivery_bake:5';
const DELIVERY_BAKE_VERSION = 5;
/** Pré-visualização UI / thumbnail: moldura 9:16 contain (landscape upright, igual ao olho). */
const TOTEM_THUMB_WIDTH = 540;
const TOTEM_THUMB_HEIGHT = 960;
const DELIVERY_ROTATION_TAG_PREFIX = '_delivery_rotation:';
/** Vídeo ainda em re-encode de entrega — não enviar ao player / não tratar como 16:9 final. */
const TOTEM_DELIVERY_PENDING_TAG = '_totem_delivery_pending';

export interface CreateMediaRequest {
  name: string;
  description?: string;
  tags?: string[];
  file: {
    buffer?: Buffer;
    diskPath?: string;
    originalname: string;
    mimetype: string;
    size: number;
  };
  subscriberId?: number; // Legado Pro
  publisherId?: number; // Biblioteca da organização (modo Publicar em Totem)
  createdBy: number; // User ID que está criando
}

export interface UpdateMediaRequest {
  name?: string;
  description?: string;
  tags?: string[];
  status?: string; // draft, pending_approval, approved, rejected, archived
  approvalStatus?: string; // pending, approved, rejected
  rejectionReason?: string;
  isActive?: boolean;
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
  /** Graus aplicados no ficheiro 16:9 de entrega (90 ou 180). */
  deliveryRotation?: number | null;
  /** Graus para desfazer na UI (hover/preview CSS). */
  deliveryPreviewRotation?: number | null;
  /** Nº de totens que usam esta mídia (só preenchido no modo direct totem). */
  totemCount?: number;
  /** Nomes dos totens que usam esta mídia (modo direct totem). */
  totemNames?: string[];
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
  /** Re-encode totem em curso (vídeo após upload). Chave = media_id. */
  private pendingDeliveryNormalization = new Map<number, Promise<void>>();

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
      const directMode = isDirectTotemMode();
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (directMode) {
        const publisherId = await resolveSinglePublisherId();
        whereClause += ' AND m.publisher_id = $' + (params.length + 1);
        params.push(publisherId);
      } else if (!isAdmin && requestSubscriberId) {
        whereClause += ' AND m.subscriber_id = $' + (params.length + 1);
        params.push(requestSubscriberId);
      } else if (filters.subscriberId) {
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

      // Apenas mídias ativas (modo direto lista também inativas para reativar na UI)
      if (!directMode) {
        whereClause += ' AND m.is_active = true';
      }

      // Subscribers ativos por padrão (modo legado)
      if (!directMode && !includeInactiveSubscribers) {
        whereClause += ' AND (s.subscriber_id IS NULL OR s.is_active = true)';
      }

      const totemCountSelect = directMode
        ? `, (
            SELECT COUNT(DISTINCT tp.totem_id)::int
            FROM totem_playlist_items tpi
            JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
            WHERE tpi.media_id = m.media_id
              AND COALESCE(tpi.is_active, true) = true
              AND COALESCE(tp.is_active, true) = true
              AND tp.status = 'active'
          ) AS "totemCount",
          (
            SELECT COALESCE(
              json_agg(sorted.name ORDER BY sorted.name),
              '[]'::json
            )
            FROM (
              SELECT DISTINCT COALESCE(
                NULLIF(TRIM(t.name), ''),
                NULLIF(TRIM(t.identifier), ''),
                NULLIF(TRIM(t.uin), ''),
                'Totem'
              ) AS name
              FROM totem_playlist_items tpi
              JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
              JOIN totems t ON t.totem_id = tp.totem_id
              WHERE tpi.media_id = m.media_id
                AND COALESCE(tpi.is_active, true) = true
                AND COALESCE(tp.is_active, true) = true
                AND tp.status = 'active'
            ) sorted
          ) AS "totemNames"`
        : '';

      const subscriberJoin = directMode
        ? 'LEFT JOIN subscribers s ON m.subscriber_id = s.subscriber_id'
        : 'JOIN subscribers s ON m.subscriber_id = s.subscriber_id';

      const validSortFields: { [key: string]: string } = {
        name: 'm.name',
        created_at: 'm.created_at',
        updated_at: 'm.updated_at',
        file_size_bytes: 'm.file_size_bytes',
        media_type: 'm.media_type',
      };
      const sortBy = filters.sortBy || 'created_at';
      const sortField = validSortFields[sortBy] || 'm.created_at';
      const orderDirection = (filters.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Buscar mídia com todos os campos do schema v2
      const media = await this.db.findMany(`
        SELECT 
          m.media_id as id,
          m.subscriber_id as "subscriberId",
          m.publisher_id as "publisherId",
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
          s.name as "subscriberName",
          s.email as "subscriberEmail",
          s.phone as "subscriberPhone",
          s.address as "subscriberAddress",
          s.is_active as "subscriberIsActive",
          u.username as "approvedByName"
          ${totemCountSelect}
        FROM medias m
        ${subscriberJoin}
        LEFT JOIN users u ON m.approved_by = u.id
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM medias m
        ${subscriberJoin}
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
        const deliveryPreview = this.enrichDeliveryPreviewFields(processedTags);

        let totemNames: string[] = [];
        if (directMode && item.totemNames != null) {
          if (Array.isArray(item.totemNames)) {
            totemNames = item.totemNames.map(String).filter(Boolean);
          } else if (typeof item.totemNames === 'string') {
            try {
              const parsed = JSON.parse(item.totemNames);
              if (Array.isArray(parsed)) totemNames = parsed.map(String).filter(Boolean);
            } catch {
              totemNames = [];
            }
          }
        }

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
          thumbnailUrlComputed: thumbnailUrl,
          deliveryRotation: deliveryPreview.deliveryRotation,
          deliveryPreviewRotation: deliveryPreview.deliveryPreviewRotation,
          ...(directMode
            ? {
                totemCount: Number(item.totemCount ?? item.totemcount ?? 0),
                totemNames,
              }
            : {}),
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
      const directMode = isDirectTotemMode();
      const media = await this.db.findFirst(`
        SELECT 
          m.media_id as id,
          m.subscriber_id as "subscriberId",
          m.publisher_id as "publisherId",
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

      if (directMode) {
        const expectedPublisherId = await resolveSinglePublisherId();
        if (media.publisherId && Number(media.publisherId) !== expectedPublisherId) {
          throw new Error('Acesso negado: mídia não pertence à biblioteca desta organização');
        }
      } else if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
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
      const deliveryPreview = this.enrichDeliveryPreviewFields(processedTags);

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
        thumbnailUrlComputed: thumbnailUrl,
        deliveryRotation: deliveryPreview.deliveryRotation,
        deliveryPreviewRotation: deliveryPreview.deliveryPreviewRotation,
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
    createdBy: number,
    options: {
      subscriberId?: number;
      publisherId?: number;
      requestSubscriberId?: number;
      isAdmin?: boolean;
    } = {}
  ): Promise<MediaResponse[]> {
    try {
      const { subscriberId, publisherId, requestSubscriberId, isAdmin = false } = options;
      const directMode = isDirectTotemMode();

      if (!directMode) {
        if (!subscriberId || subscriberId <= 0) {
          throw new Error('subscriber_id é obrigatório para criar mídia');
        }
        if (!isAdmin && requestSubscriberId && subscriberId !== requestSubscriberId) {
          throw new Error('Acesso negado: não é possível criar mídia para outro subscriber');
        }
      }

      const results: MediaResponse[] = [];

      for (const file of files) {
        const mediaData: CreateMediaRequest = {
          name: file.originalname,
          description: '',
          tags: [],
          file,
          subscriberId,
          publisherId,
          createdBy,
        };

        const media = await this.createMedia(mediaData, requestSubscriberId, isAdmin);
        results.push(media);
      }

      return results;
    } catch (error: any) {
      await logError('Erro ao criar múltiplas mídias', error, {
        count: files.length,
        subscriberId: options.subscriberId,
        publisherId: options.publisherId,
      });
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
      const { name, description, tags, file, subscriberId, publisherId, createdBy } = data;
      const directMode = isDirectTotemMode();
      let resolvedPublisherId = publisherId;
      let resolvedSubscriberId = subscriberId;

      if (directMode) {
        resolvedPublisherId = resolvedPublisherId ?? (await resolveSinglePublisherId());
        resolvedSubscriberId = undefined;
        if (!resolvedPublisherId || resolvedPublisherId <= 0) {
          throw new Error('publisher_id é obrigatório para criar mídia na biblioteca da organização');
        }
        const publisher = await this.db.findFirst(
          `SELECT publisher_id, is_active FROM publishers WHERE publisher_id = $1`,
          [resolvedPublisherId]
        );
        if (!publisher?.is_active) {
          throw new Error('Organização não encontrada ou inativa');
        }
        const existingMedia = await this.db.findFirst(
          `SELECT media_id, name FROM medias WHERE name = $1 AND publisher_id = $2 AND is_active = true`,
          [name, resolvedPublisherId]
        );
        if (existingMedia) {
          throw new Error(
            `Nome de mídia «${name}» já existe na biblioteca desta organização`
          );
        }
      } else {
        if (!resolvedSubscriberId || resolvedSubscriberId <= 0) {
          throw new Error('subscriber_id é obrigatório para criar mídia');
        }
        if (!isAdmin && requestSubscriberId && resolvedSubscriberId !== requestSubscriberId) {
          throw new Error('Acesso negado: não é possível criar mídia para outro subscriber');
        }
        const subscriber = await this.db.findFirst(
          `SELECT subscriber_id, is_active FROM subscribers WHERE subscriber_id = $1`,
          [resolvedSubscriberId]
        );
        if (!subscriber) {
          throw new Error('Subscriber não encontrado');
        }
        if (!subscriber.is_active) {
          throw new Error('Subscriber não está ativo');
        }
        const existingMedia = await this.db.findFirst(
          `SELECT media_id, name FROM medias WHERE name = $1 AND subscriber_id = $2`,
          [name, resolvedSubscriberId]
        );
        if (existingMedia) {
          throw new Error(`Nome de mídia «${name}» já existe para este subscriber`);
        }
      }

      // Validar ownership (exceto para admin) — modo legado já validado acima
      if (!directMode && !isAdmin && requestSubscriberId && resolvedSubscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: não é possível criar mídia para outro subscriber');
      }

      // Determinar tipo de mídia
      const mediaType = this.getMediaType(file.mimetype);

      // Salvar arquivo
      let filePath = directMode
        ? await this.getStorageService().savePublisherMediaFile(file, resolvedPublisherId!, name)
        : await this.getStorageService().saveMediaFile(file, resolvedSubscriberId!, name);
      let storedMimeType = file.mimetype;

      // Imagem: normalização 9:16 síncrona (sharp, rápido). Vídeo: ffmpeg em background (evita 502/timeout).
      let uploadDeliveryRotation: number | null = null;
      if (mediaType === 'image') {
        try {
          const normalized = await this.normalizeNewUploadToTotemPortrait(
            filePath,
            'image',
            file.mimetype
          );
          filePath = normalized.filePath;
          storedMimeType = normalized.mimeType ?? storedMimeType;
          uploadDeliveryRotation = normalized.deliveryRotation;
        } catch (normErr: any) {
          await logWarn('Normalização 9:16 no upload falhou; mantém ficheiro original', {
            filePath,
            mediaType,
            error: normErr?.message,
          });
        }
      }

      // Vídeo: thumbnail rápido em pé a partir do original; adequação 16:9 fica em background.
      // Não marcar como entrega final (1920×1080 / _delivery_rotation) antes do re-encode —
      // isso evitava thumbs/CSS e o player a mostrarem o ficheiro virado.
      let processedTags: string[] | null = null;
      if (tags && tags.length > 0) {
        processedTags = Array.isArray(tags) ? tags : [tags];
      }
      if (uploadDeliveryRotation != null) {
        processedTags = this.mergeDeliveryBakeVersionTag(
          this.mergeDeliveryRotationTag(processedTags, uploadDeliveryRotation)
        );
      }

      if (mediaType === 'video') {
        try {
          await this.generatePortraitThumbnailFromVideoFile(filePath, processedTags);
        } catch (thumbErr: any) {
          await logWarn('Thumbnail de vídeo no upload falhou', {
            filePath,
            error: thumbErr?.message,
          });
        }
        if (directMode) {
          processedTags = this.withTotemDeliveryPendingTag(processedTags);
        }
      }

      // Metadados leves no upload; vídeo: sem re-encode síncrono (evita 502/timeout).
      const metadata = await this.processMedia(
        file.buffer ?? Buffer.alloc(0),
        storedMimeType,
        filePath,
        { deferVideoFfmpeg: mediaType === 'video' }
      );
      if (mediaType === 'video') {
        const thumbPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
        if (fs.existsSync(thumbPath)) {
          metadata.previewUrl = generateThumbnailUrl(thumbPath, 'video');
        }
        // Mantém width/height reais do ficheiro até completeVideoPortraitNormalization.
        // (Antes forçava 1920×1080 cedo → UI/player tratavam original como entrega final.)
      }
      let storedSize = file.size;
      try {
        const st = await fs.promises.stat(filePath);
        storedSize = st.size;
      } catch {
        // mantém tamanho original
      }

      // Processar tags (TEXT[] array) — processedTags já inicializado acima para vídeo/imagem

      // Modo TotemDigital compacto: mídia entra já aprovada (menos passos no PoC / instalação única).
      const initialStatus = directMode || isStudioRuntime() ? 'approved' : 'draft';
      const approvedByInitial = directMode || isStudioRuntime() ? createdBy : null;

      // Criar registro no banco (schema v2). Trigger sync_media_approval_status preenche approval_status / approved_at.
      const result = await this.db.executeRaw(`
        INSERT INTO medias (
          subscriber_id, publisher_id, name, description, tags,
          preview_url, status, approved_by, file_path, file_name, media_type,
          duration_seconds, file_size_bytes, mime_type, width, height
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING media_id
      `, [
        resolvedSubscriberId ?? null,
        directMode ? resolvedPublisherId : null,
        name,
        description || null,
        processedTags,
        metadata.previewUrl || null,
        initialStatus,
        approvedByInitial,
        filePath,
        path.basename(filePath),
        mediaType,
        metadata.durationSeconds || null,
        storedSize,
        storedMimeType,
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
        subscriberId: directMode ? undefined : resolvedSubscriberId,
        publisherId: directMode ? resolvedPublisherId : undefined,
      });

      // Invalidar cache
      await getCacheService().invalidateEntity('media', newMedia.id).catch(() => {});
      if (resolvedSubscriberId) {
        await getCacheService().invalidateEntity('subscriber', resolvedSubscriberId).catch(() => {});
      }

      if (mediaType === 'video') {
        this.scheduleVideoPortraitNormalizationAfterUpload(
          newMedia.id,
          filePath,
          storedMimeType,
          createdBy
        );
      }

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

      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(Boolean(data.isActive));
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
   * Substitui o conteúdo do ficheiro de uma mídia existente (ex.: re-gerar HTML publish-board).
   */
  async replaceMediaFileContent(
    mediaId: number,
    file: { buffer: Buffer; mimetype: string; size: number },
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse> {
    const existingMedia = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
    if (!existingMedia) {
      throw new Error('Mídia não encontrada');
    }
    if (!isAdmin && requestSubscriberId && existingMedia.subscriberId !== requestSubscriberId) {
      throw new Error('Acesso negado: mídia não pertence a este subscriber');
    }
    const rawPath = existingMedia.filePath || (existingMedia as any).file_path;
    if (!rawPath || !fs.existsSync(rawPath)) {
      throw new Error('Ficheiro da mídia não encontrado no servidor');
    }

    await fs.promises.writeFile(rawPath, file.buffer);
    try {
      fs.chmodSync(rawPath, 0o644);
    } catch {
      /* noop */
    }

    await this.db.executeRaw(
      `
      UPDATE medias
      SET file_size_bytes = $1,
          mime_type = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE media_id = $3
    `,
      [file.size, file.mimetype, mediaId]
    );

    await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
    await getCacheService().invalidateEntity('subscriber', existingMedia.subscriberId).catch(() => {});

    const updated = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
    if (!updated) {
      throw new Error('Erro ao buscar mídia atualizada');
    }

    await getMediaTotemSyncService()
      .notifyAffectedTotems(mediaId, {
        reason: 'file_content',
        filePath: rawPath,
        fileSizeBytes: file.size,
        updatedAt: updated.updatedAt,
      })
      .catch((e) => logError('Falha ao notificar totens após substituir ficheiro', e, { mediaId }));

    return updated;
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
    const fitPortrait = String(options.fit || '') === '9:16';
    // Sem rotação e sem pedido explícito de 9:16: não alterar ficheiro (comportamento legado).
    if (normalizedRotation === 0 && !fitPortrait) {
      return media;
    }

    const mediaType = String(media.mediaType || '').toLowerCase();
    if (mediaType !== 'image' && mediaType !== 'video') {
      throw new Error('Transformação disponível apenas para imagens e vídeos');
    }

    const streamInfo =
      mediaType === 'image'
        ? await this.probeImageStreamInfo(sourcePath)
        : await this.probeVideoStreamInfo(sourcePath);

    // Guard: entrega já normalizada + sem rotação pedida pelo utilizador → não re-bake
    if (
      normalizedRotation === 0 &&
      this.isTotemDeliverySize(streamInfo.width, streamInfo.height)
    ) {
      const existing =
        this.parseDeliveryRotationFromTags(media.tags) ??
        (await this.readDeliveryRotationMetadata(sourcePath));
      if (existing != null) {
        await logWarn('transformMediaToPortrait: ficheiro já é entrega totem — skip', {
          mediaId,
          existing,
        });
        return media;
      }
    }

    const resolvedPreviewRotation = this.resolvePreviewRotationDegrees(
      streamInfo.displayWidth,
      streamInfo.displayHeight,
      normalizedRotation
    );
    const resolvedDeliveryRotation = this.resolveDeliveryRotationFromStream(
      streamInfo.width,
      streamInfo.height,
      streamInfo.rotation,
      normalizedRotation
    );

    const ext = mediaType === 'video' ? '.mp4' : this.getImageOutputExtension(media.mimeType, sourcePath);
    const outputPath = this.getTransformedOutputPath(sourcePath, ext);
    const thumbnailPath = outputPath.replace(/\.[^/.]+$/, '_thumb.jpg');

    try {
      let dimensions = { width: TOTEM_PORTRAIT_WIDTH, height: TOTEM_PORTRAIT_HEIGHT };
      // Rotação manual na UI: contain (sem crop/zoom). fit 9:16 força canvas portrait.
      if (mediaType === 'image') {
        dimensions = await this.normalizeImageToTotemDelivery(
          sourcePath,
          outputPath,
          resolvedDeliveryRotation,
          media.mimeType,
          { fit: 'contain', forcePortrait: fitPortrait }
        );
        await this.generatePortraitThumbnailFromDeliveryImage(outputPath, 0);
      } else {
        dimensions = await this.normalizeVideoToTotemDelivery(
          sourcePath,
          outputPath,
          resolvedDeliveryRotation,
          streamInfo.rotation,
          true,
          { fit: 'contain', forcePortrait: fitPortrait }
        );
        await this.generatePortraitThumbnailFromDeliveryVideo(outputPath, 0);
      }

      const stats = await fs.promises.stat(outputPath);
      // Bake v3: deliveryRotation=0 (neutro); montagem no player
      const nextTags = this.mergeDeliveryBakeVersionTag(
        this.mergeDeliveryRotationTag(media.tags, 0)
      );

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
            tags = $8,
            updated_at = CURRENT_TIMESTAMP
        WHERE media_id = $9
      `, [
        outputPath,
        nextFileName,
        stats.size,
        nextMimeType,
        dimensions.width,
        dimensions.height,
        previewUrl,
        nextTags,
        mediaId,
      ]);

      await this.removeFileIfExists(sourcePath);
      await this.removeFileIfExists(sourcePath.replace(/\.[^/.]+$/, '_thumb.jpg'));

      await this.getAuditService().log('media', 'transformed', updatedBy, {
        mediaId,
        rotationDegrees: resolvedDeliveryRotation,
        rotationRequested: normalizedRotation,
        previewRotationDegrees: resolvedPreviewRotation,
        fit: options.fit || '9:16',
        subscriberId: media.subscriberId,
      });

      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', media.subscriberId).catch(() => {});

      const updatedMedia = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!updatedMedia) {
        throw new Error('Erro ao buscar mídia transformada');
      }

      await getMediaTotemSyncService()
        .notifyAffectedTotems(mediaId, {
          reason: 'transform',
          updatedBy,
          updatedAt: updatedMedia.updatedAt,
          filePath: updatedMedia.filePath,
          fileSizeBytes: updatedMedia.fileSizeBytes,
        })
        .catch((e) => logError('Falha ao notificar totens após transformar mídia', e, { mediaId }));

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

  /**
   * Rotação para **thumbnail/preview** na UI (9:16 em pé — o que o cliente vê).
   */
  private resolvePreviewRotationDegrees(
    displayWidth: number,
    displayHeight: number,
    userRotationDegrees: number
  ): number {
    return this.resolveAutoRotationDegrees(displayWidth, displayHeight, userRotationDegrees, true);
  }

  /**
   * Rotação pedida pelo utilizador na UI transform; auto = 0 (neutro — sem bake de montagem).
   * Bake v3: EXIF/stream corrige pixels uma vez; deliveryRotation tag fica 0.
   */
  private resolveDeliveryRotationFromStream(
    _rawWidth: number,
    _rawHeight: number,
    _streamRotation: number,
    userRotationDegrees: number
  ): number {
    const user = this.normalizeRotation(userRotationDegrees);
    return user !== 0 ? user : 0;
  }

  /** Canvas de entrega após EXIF/stream: portrait 9:16 ou landscape 16:9. */
  private resolveDeliveryCanvas(
    displayWidth: number,
    displayHeight: number
  ): { width: number; height: number; portrait: boolean } {
    if (displayHeight >= displayWidth && displayWidth > 0) {
      return {
        width: TOTEM_PORTRAIT_WIDTH,
        height: TOTEM_PORTRAIT_HEIGHT,
        portrait: true,
      };
    }
    return {
      width: TOTEM_LANDSCAPE_WIDTH,
      height: TOTEM_LANDSCAPE_HEIGHT,
      portrait: false,
    };
  }

  private exifOrientationToDegrees(orientation: number): number {
    switch (orientation) {
      case 6:
      case 5:
        return 90;
      case 3:
        return 180;
      case 8:
      case 7:
        return 270;
      default:
        return 0;
    }
  }

  private async probeImageStreamInfo(sourcePath: string): Promise<{
    width: number;
    height: number;
    rotation: number;
    displayWidth: number;
    displayHeight: number;
  }> {
    try {
      const meta = await (sharp as any)(sourcePath).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      const rotation = this.exifOrientationToDegrees(Number(meta.orientation ?? 1));
      let displayWidth = width;
      let displayHeight = height;
      if (rotation === 90 || rotation === 270) {
        displayWidth = height;
        displayHeight = width;
      }
      return { width, height, rotation, displayWidth, displayHeight };
    } catch {
      return { width: 0, height: 0, rotation: 0, displayWidth: 0, displayHeight: 0 };
    }
  }

  private resolveDeliveryPreviewUndoRotation(deliveryRotationDegrees: number): number {
    const delivery = this.normalizeRotation(deliveryRotationDegrees);
    return this.normalizeRotation(360 - delivery);
  }

  private mergeDeliveryRotationTag(
    existingTags: string[] | null | undefined,
    deliveryRotation: number
  ): string[] {
    const filtered = (existingTags || []).filter(
      (t) =>
        !String(t).startsWith(DELIVERY_ROTATION_TAG_PREFIX) &&
        String(t) !== TOTEM_DELIVERY_PENDING_TAG
    );
    return [...filtered, `${DELIVERY_ROTATION_TAG_PREFIX}${this.normalizeRotation(deliveryRotation)}`];
  }

  private mergeDeliveryBakeVersionTag(existingTags: string[] | null | undefined): string[] {
    const filtered = (existingTags || []).filter(
      (t) => !String(t).startsWith('_delivery_bake:')
    );
    return [...filtered, DELIVERY_BAKE_VERSION_TAG];
  }

  private hasDeliveryBakeV3(tags: string[] | null | undefined): boolean {
    for (const t of tags || []) {
      const raw = String(t);
      if (!raw.startsWith('_delivery_bake:')) continue;
      const ver = Number(raw.slice('_delivery_bake:'.length));
      if (Number.isFinite(ver) && ver >= DELIVERY_BAKE_VERSION) return true;
    }
    return false;
  }

  private withTotemDeliveryPendingTag(existingTags: string[] | null | undefined): string[] {
    const filtered = (existingTags || []).filter((t) => String(t) !== TOTEM_DELIVERY_PENDING_TAG);
    return [...filtered, TOTEM_DELIVERY_PENDING_TAG];
  }

  private withoutTotemDeliveryPendingTag(existingTags: string[] | null | undefined): string[] {
    return (existingTags || []).filter((t) => String(t) !== TOTEM_DELIVERY_PENDING_TAG);
  }

  /** True se a mídia ainda não está pronta para o player (adequação de entrega em curso). */
  isTotemDeliveryPending(tags?: string[] | null): boolean {
    return (tags || []).some((t) => String(t) === TOTEM_DELIVERY_PENDING_TAG);
  }

  private enrichDeliveryPreviewFields(
    tags: string[] | null | undefined
  ): { deliveryRotation: number | null; deliveryPreviewRotation: number | null } {
    const delivery = this.parseDeliveryRotationFromTags(tags);
    if (delivery == null) {
      return { deliveryRotation: null, deliveryPreviewRotation: null };
    }
    return {
      deliveryRotation: delivery,
      deliveryPreviewRotation: this.resolveDeliveryPreviewUndoRotation(delivery),
    };
  }

  private parseDeliveryRotationFromTags(tags?: string[] | null): number | null {
    if (!tags?.length) return null;
    for (const tag of tags) {
      if (!String(tag).startsWith(DELIVERY_ROTATION_TAG_PREFIX)) continue;
      const raw = String(tag).slice(DELIVERY_ROTATION_TAG_PREFIX.length);
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return this.normalizeRotation(parsed);
      }
    }
    return null;
  }

  /** Lê só o metadado delivery_rotation do ficheiro; null se ausente. */
  private async readDeliveryRotationMetadata(filePath: string): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format_tags=delivery_rotation',
          '-of',
          'json',
          filePath,
        ],
        { timeout: 15_000 }
      );
      const raw = JSON.parse(stdout)?.format?.tags?.delivery_rotation;
      if (raw != null && String(raw).trim() !== '') {
        return this.normalizeRotation(Number(raw));
      }
    } catch {
      /* metadado opcional */
    }
    return null;
  }

  /**
   * Entrega totem = 1920×1080 com metadado delivery_rotation (pixels já rodados).
   * Não confundir com vídeo de telemóvel 1920×1080 + stream rotate=90/270.
   */
  private async isNormalizedTotemDeliveryVideo(
    filePath: string,
    width: number,
    height: number
  ): Promise<boolean> {
    if (!this.isTotemDeliverySize(width, height)) return false;
    const deliveryMeta = await this.readDeliveryRotationMetadata(filePath);
    return deliveryMeta != null;
  }

  /** Vídeo 1920×1080 de entrega totem (metadado no ficheiro ou tag _delivery_rotation). */
  private async isTotemDeliveryVideoForThumbnail(
    filePath: string,
    width: number,
    height: number,
    tags?: string[] | null
  ): Promise<boolean> {
    if (await this.isNormalizedTotemDeliveryVideo(filePath, width, height)) return true;
    return (
      this.isTotemDeliverySize(width, height) &&
      this.parseDeliveryRotationFromTags(tags) != null
    );
  }

  /**
   * Se pedido 9:16 sem rotação manual e o conteúdo efectivo é landscape, roda 90° para ficar em pé (só preview).
   */
  private resolveAutoRotationDegrees(
    displayWidth: number,
    displayHeight: number,
    userRotationDegrees: number,
    fitPortrait: boolean
  ): number {
    const user = this.normalizeRotation(userRotationDegrees);
    if (!fitPortrait || user !== 0) return user;
    if (displayWidth > 0 && displayHeight > 0 && displayWidth > displayHeight) {
      return 90;
    }
    return 0;
  }

  private async probeImageEffectiveSize(
    sourcePath: string
  ): Promise<{ displayWidth: number; displayHeight: number }> {
    try {
      const meta = await (sharp as any)(sourcePath).rotate().metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      return { displayWidth: w, displayHeight: h };
    } catch {
      return { displayWidth: 0, displayHeight: 0 };
    }
  }

  private async probeVideoStreamInfo(sourcePath: string): Promise<{
    width: number;
    height: number;
    rotation: number;
    displayWidth: number;
    displayHeight: number;
  }> {
    let width = 0;
    let height = 0;
    let rotation = 0;
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=width,height',
          '-show_entries',
          'stream_tags=rotate',
          '-show_entries',
          'stream_side_data=rotation',
          '-show_entries',
          'format_tags=rotate',
          '-of',
          'json',
          sourcePath,
        ],
        { timeout: 30_000 }
      );
      const parsed = JSON.parse(stdout);
      const stream = parsed?.streams?.[0];
      width = Number(stream?.width) || 0;
      height = Number(stream?.height) || 0;
      const rotRaw =
        stream?.tags?.rotate ??
        stream?.tags?.ROTATE ??
        parsed?.format?.tags?.rotate ??
        parsed?.format?.tags?.ROTATE;
      if (rotRaw != null && String(rotRaw).trim() !== '') {
        rotation = this.normalizeRotation(Number(rotRaw));
      }
      if (rotation === 0) {
        const sideList = stream?.side_data_list;
        if (Array.isArray(sideList)) {
          for (const side of sideList) {
            const sideRot = side?.rotation ?? side?.rotate;
            if (sideRot != null && String(sideRot).trim() !== '') {
              rotation = this.normalizeRotation(Number(sideRot));
              if (rotation !== 0) break;
            }
          }
        }
      }
    } catch {
      // dimensões opcionais
    }
    let displayWidth = width;
    let displayHeight = height;
    if (rotation === 90 || rotation === 270) {
      displayWidth = height;
      displayHeight = width;
    }
    return { width, height, rotation, displayWidth, displayHeight };
  }

  /**
   * Re-encode de vídeo para entrega totem após o upload responder (ffmpeg é pesado no HTTP síncrono).
   * Regista a Promise de imediato: ao adicionar ao totem o notify do player é adiado até este trabalho terminar.
   */
  private scheduleVideoPortraitNormalizationAfterUpload(
    mediaId: number,
    filePath: string,
    mimeType: string,
    updatedBy: number
  ): void {
    const existing = this.pendingDeliveryNormalization.get(mediaId);
    if (existing) {
      return;
    }

    const work = new Promise<void>((resolve) => {
      setImmediate(() => {
        this.completeVideoPortraitNormalizationAfterUpload(mediaId, filePath, mimeType, updatedBy)
          .catch((error) =>
            logError('Normalização 9:16 de vídeo em background falhou', error, { mediaId, filePath })
          )
          .finally(() => resolve());
      });
    });

    this.pendingDeliveryNormalization.set(mediaId, work);
    void work.finally(() => {
      if (this.pendingDeliveryNormalization.get(mediaId) === work) {
        this.pendingDeliveryNormalization.delete(mediaId);
      }
    });
  }

  /** True enquanto o re-encode/rotação de entrega ainda corre (após upload de vídeo). */
  hasPendingDeliveryNormalization(mediaId: number): boolean {
    return this.pendingDeliveryNormalization.has(mediaId);
  }

  /**
   * False se a adequação de entrega ainda não terminou (memória ou tag persistida).
   * Usado para não notificar o player com o ficheiro original virado.
   */
  async isTotemDeliveryReadyForPlayer(mediaId: number): Promise<boolean> {
    if (this.hasPendingDeliveryNormalization(mediaId)) return false;
    const row = await this.db.findFirst(`SELECT tags FROM medias WHERE media_id = $1`, [mediaId]);
    return !this.isTotemDeliveryPending(row?.tags);
  }

  private async completeVideoPortraitNormalizationAfterUpload(
    mediaId: number,
    filePath: string,
    mimeType: string,
    updatedBy: number
  ): Promise<void> {
    try {
      const normalized = await this.normalizeNewUploadToTotemPortrait(filePath, 'video', mimeType, {
        existingTags: (await this.getMediaById(mediaId))?.tags,
      });
      const newPath = normalized.filePath;
      const stats = await fs.promises.stat(newPath);
      const thumbPath = newPath.replace(/\.[^/.]+$/, '_thumb.jpg');
      await this.generatePortraitThumbnailFromDeliveryVideo(newPath, 0);
      const previewUrl = generateThumbnailUrl(thumbPath, 'video');
      const current = await this.getMediaById(mediaId);
      const nextTags = this.mergeDeliveryBakeVersionTag(
        this.mergeDeliveryRotationTag(
          this.withoutTotemDeliveryPendingTag(current?.tags),
          0
        )
      );

      await this.db.executeRaw(
        `
        UPDATE medias
        SET file_path = $1,
            file_name = $2,
            file_size_bytes = $3,
            mime_type = $4,
            width = $5,
            height = $6,
            preview_url = $7,
            tags = $8,
            updated_at = CURRENT_TIMESTAMP
        WHERE media_id = $9
      `,
        [
          newPath,
          path.basename(newPath),
          stats.size,
          normalized.mimeType ?? 'video/mp4',
          normalized.width,
          normalized.height,
          previewUrl,
          nextTags,
          mediaId,
        ]
      );

      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      const refreshed = await this.getMediaById(mediaId);
      await getMediaTotemSyncService()
        .notifyAffectedTotems(mediaId, {
          reason: 'process',
          updatedBy,
          updatedAt: refreshed?.updatedAt,
          filePath: newPath,
          fileSizeBytes: stats.size,
        })
        .catch((e) => logError('Falha ao notificar totens após normalizar vídeo', e, { mediaId }));
    } catch (error: any) {
      await logWarn('Normalização 9:16 de vídeo em background falhou; mantém original', {
        mediaId,
        filePath,
        error: error?.message,
      });
      try {
        const current = await this.getMediaById(mediaId);
        const cleared = this.withoutTotemDeliveryPendingTag(current?.tags);
        await this.db.executeRaw(
          `UPDATE medias SET tags = $1, updated_at = CURRENT_TIMESTAMP WHERE media_id = $2`,
          [cleared, mediaId]
        );
      } catch {
        /* ignore */
      }
      // Mesmo com falha: se já estiver na playlist do totem, o player precisa do 1º plano.
      await getMediaTotemSyncService()
        .notifyAffectedTotems(mediaId, {
          reason: 'process',
          updatedBy,
          filePath,
        })
        .catch((e) =>
          logError('Falha ao notificar totens após falha na normalização de vídeo', e, { mediaId })
        );
    }
  }

  /**
   * Re-aplica normalização totem (1920×1080 cover + rotação de entrega).
   * Vídeo: se já é entrega v1 (sem stream EXIF no bake), aplica +stream residual típico (90°)
   * para paridade com imagens e marca `_delivery_bake:2`.
   */
  async reprocessTotemDelivery(
    mediaId: number,
    updatedBy: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<MediaResponse> {
    const media = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
    if (!media) {
      throw new Error('Mídia não encontrada');
    }
    if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
      throw new Error('Acesso negado: mídia não pertence a este subscriber');
    }
    if (media.mediaType !== 'video' && media.mediaType !== 'image') {
      throw new Error('Reprocessamento totem só está disponível para imagem ou vídeo');
    }
    const filePath = this.resolveExistingMediaPath(media.filePath || '');
    if (!filePath) {
      throw new Error('Ficheiro de mídia não encontrado no servidor');
    }

    if (media.mediaType === 'video') {
      await this.completeVideoPortraitNormalizationAfterUpload(
        mediaId,
        filePath,
        media.mimeType || 'video/mp4',
        updatedBy
      );
    } else {
      await this.reprocessImageTotemDelivery(mediaId, filePath, media.mimeType, updatedBy);
    }

    const refreshed = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
    if (!refreshed) {
      throw new Error('Erro ao buscar mídia reprocessada');
    }
    return refreshed;
  }

  /** Re-bake imagem existente para bake v3 neutro (EXIF + cover portrait/landscape). */
  private async reprocessImageTotemDelivery(
    mediaId: number,
    filePath: string,
    mimeType: string | undefined,
    updatedBy: number
  ): Promise<void> {
    const probe = await this.probeImageStreamInfo(filePath);
    const dir = path.dirname(filePath);
    const stamp = Date.now();
    const tempOut = path.join(
      dir,
      `${path.basename(filePath, path.extname(filePath))}_totem_${stamp}${path.extname(filePath) || '.jpg'}`
    );

    // Se já é 16:9 legado, força +90° para canvas portrait (telemóvel típico).
    const migrateRot =
      this.isTotemDeliverySize(probe.width, probe.height) && probe.width > probe.height ? 90 : 0;
    const dimensions = await this.normalizeImageToTotemDelivery(
      filePath,
      tempOut,
      migrateRot,
      mimeType
    );

    await this.removeFileIfExists(filePath);
    await this.removeFileIfExists(filePath.replace(/\.[^/.]+$/, '_thumb.jpg'));
    const finalPath = filePath;
    if (tempOut !== finalPath) {
      await fs.promises.rename(tempOut, finalPath);
    }

    await this.generatePortraitThumbnailFromDeliveryImage(finalPath, 0);
    const stats = await fs.promises.stat(finalPath);
    const current = await this.getMediaById(mediaId);
    const nextTags = this.mergeDeliveryBakeVersionTag(
      this.mergeDeliveryRotationTag(current?.tags, 0)
    );
    const previewUrl = generateThumbnailUrl(
      finalPath.replace(/\.[^/.]+$/, '_thumb.jpg'),
      'image'
    );

    await this.db.executeRaw(
      `
      UPDATE medias
      SET file_path = $1,
          file_name = $2,
          file_size_bytes = $3,
          width = $4,
          height = $5,
          preview_url = $6,
          tags = $7,
          updated_at = CURRENT_TIMESTAMP
      WHERE media_id = $8
    `,
      [
        finalPath,
        path.basename(finalPath),
        stats.size,
        dimensions.width,
        dimensions.height,
        previewUrl,
        nextTags,
        mediaId,
      ]
    );

    await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
    const refreshed = await this.getMediaById(mediaId);
    await getMediaTotemSyncService()
      .notifyAffectedTotems(mediaId, {
        reason: 'process',
        updatedBy,
        updatedAt: refreshed?.updatedAt,
        filePath: finalPath,
        fileSizeBytes: stats.size,
      })
      .catch((e) => logError('Falha ao notificar totens após reprocessar imagem', e, { mediaId }));
  }

  /**
   * Normaliza ficheiro: bake v3 neutro (EXIF/stream + cover portrait/landscape).
   * deliveryRotation=0 — montagem fica no Player-AD.
   */
  private async normalizeNewUploadToTotemPortrait(
    sourcePath: string,
    mediaType: 'image' | 'video',
    mimeType?: string,
    options?: { existingTags?: string[] | null }
  ): Promise<{
    filePath: string;
    mimeType?: string;
    deliveryRotation: number;
    width: number;
    height: number;
  }> {
    if (mediaType === 'image') {
      const probe = await this.probeImageStreamInfo(sourcePath);
      if (
        this.isTotemDeliverySize(probe.width, probe.height) &&
        this.hasDeliveryBakeV3(options?.existingTags)
      ) {
        try {
          await this.generatePortraitThumbnailFromDeliveryImage(sourcePath, 0);
        } catch {
          /* thumb best-effort */
        }
        return {
          filePath: sourcePath,
          mimeType,
          deliveryRotation: 0,
          width: probe.width,
          height: probe.height,
        };
      }
    }

    const dir = path.dirname(sourcePath);
    const stamp = Date.now();
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const tempOut =
      mediaType === 'video'
        ? path.join(dir, `${baseName}_totem_${stamp}.mp4`)
        : path.join(dir, `${baseName}_totem_${stamp}${path.extname(sourcePath) || '.jpg'}`);

    let dimensions = { width: TOTEM_PORTRAIT_WIDTH, height: TOTEM_PORTRAIT_HEIGHT };

    try {
      if (mediaType === 'image') {
        dimensions = await this.normalizeImageToTotemDelivery(sourcePath, tempOut, 0, mimeType);
      } else {
        const info = await this.probeVideoStreamInfo(sourcePath);
        const alreadyDelivery = this.isTotemDeliverySize(info.width, info.height);
        if (alreadyDelivery && this.hasDeliveryBakeV3(options?.existingTags)) {
          dimensions = await this.normalizeVideoToTotemDelivery(sourcePath, tempOut, 0, 0);
        } else if (alreadyDelivery) {
          // Legado 16:9 → portrait neutro (caso típico telemóvel)
          const migrateRot = info.width > info.height ? 90 : 0;
          dimensions = await this.normalizeVideoToTotemDelivery(sourcePath, tempOut, migrateRot, 0);
        } else {
          dimensions = await this.normalizeVideoToTotemDelivery(sourcePath, tempOut, 0, info.rotation);
        }
      }

      await this.removeFileIfExists(sourcePath);
      await this.removeFileIfExists(sourcePath.replace(/\.[^/.]+$/, '_thumb.jpg'));

      const finalPath =
        mediaType === 'video' ? sourcePath.replace(/\.[^/.]+$/, '.mp4') : sourcePath;
      if (finalPath !== tempOut) {
        await fs.promises.rename(tempOut, finalPath);
      }

      if (mediaType === 'image') {
        await this.generatePortraitThumbnailFromDeliveryImage(finalPath, 0);
      } else {
        await this.generatePortraitThumbnailFromDeliveryVideo(finalPath, 0);
      }

      return {
        filePath: finalPath,
        mimeType: mediaType === 'video' ? 'video/mp4' : mimeType,
        deliveryRotation: 0,
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch (error) {
      await this.removeFileIfExists(tempOut);
      await this.removeFileIfExists(tempOut.replace(/\.[^/.]+$/, '_thumb.jpg'));
      throw error;
    }
  }

  private getTotemDeliveryVideoFilterChain(
    rotationDegrees: number,
    targetW: number = TOTEM_LANDSCAPE_WIDTH,
    targetH: number = TOTEM_LANDSCAPE_HEIGHT,
    fit: 'cover' | 'contain' = 'cover'
  ): string {
    const rotationFilters = this.getFfmpegRotationFilters(rotationDegrees);
    if (fit === 'contain') {
      // Mantém área total (letterbox/pillarbox) — sem zoom/crop.
      return [
        ...rotationFilters,
        `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`,
        `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`,
        'setsar=1',
      ].join(',');
    }
    // cover: escala com increase + crop centrado (sem pad/letterbox no ficheiro)
    return [
      ...rotationFilters,
      `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`,
      `crop=${targetW}:${targetH}`,
      'setsar=1',
    ].join(',');
  }

  private getTotemPreviewVideoFilterChain(
    rotationDegrees: number,
    targetW: number = TOTEM_THUMB_WIDTH,
    targetH: number = TOTEM_THUMB_HEIGHT,
    fit: 'cover' | 'contain' = 'contain'
  ): string {
    return this.getTotemDeliveryVideoFilterChain(rotationDegrees, targetW, targetH, fit);
  }

    /**
     * Bake v3+ imagem: EXIF uma vez (+ rotação UI) → canvas portrait/landscape.
     * fit cover = preenche (corta); contain = área total com letterbox.
     */
    private async normalizeImageToTotemDelivery(
      sourcePath: string,
      outputPath: string,
      rotationDegrees: number,
      mimeType?: string,
      options?: { fit?: 'cover' | 'contain'; forcePortrait?: boolean }
    ): Promise<{ width: number; height: number }> {
      const userRot = this.normalizeRotation(rotationDegrees);
      const fit = options?.fit ?? 'cover';
      const probe = await this.probeImageStreamInfo(sourcePath);
      let pipeline = (sharp as any)(sourcePath).rotate();
      if (userRot !== 0) {
        pipeline = pipeline.rotate(userRot);
      }
      const oriented = await pipeline.toBuffer();
      const meta = await (sharp as any)(oriented).metadata();
      const ow = Number(meta?.width ?? 0);
      const oh = Number(meta?.height ?? 0);

      // Telemóvel portrait (EXIF 90/270) → sempre 1080×1920
      const phonePortraitMeta =
        (probe.rotation === 90 || probe.rotation === 270) && probe.width >= probe.height;
      const canvas =
        options?.forcePortrait || phonePortraitMeta
          ? { width: TOTEM_PORTRAIT_WIDTH, height: TOTEM_PORTRAIT_HEIGHT, portrait: true }
          : this.resolveDeliveryCanvas(ow, oh);

      let out = (sharp as any)(oriented).resize(canvas.width, canvas.height, {
        fit,
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      });

      const ext = this.getImageOutputExtension(mimeType, outputPath);
      if (ext === '.png') {
        out = out.png({ compressionLevel: 9, adaptiveFiltering: true });
      } else if (ext === '.webp') {
        out = out.webp({ quality: 85 });
      } else {
        out = out.jpeg({ quality: 88, progressive: true });
      }

      await out.toFile(outputPath);
      return { width: canvas.width, height: canvas.height };
    }

  /**
   * Bake v3+ vídeo: ffmpeg **autorotate** (rotate/matrix do telemóvel) uma vez,
   * depois cover/contain para canvas portrait (9:16) ou landscape (16:9).
   * NÃO usar -noautorotate + transpose do stream (causava letterbox / conteúdo deitado).
   * userOrDeliveryRotationDegrees = rotação extra da UI (transform manual).
   */
  private async normalizeVideoToTotemDelivery(
    sourcePath: string,
    outputPath: string,
    userOrDeliveryRotationDegrees: number,
    _streamRotationDegrees: number = 0,
    _applyDeliveryOnPixels: boolean = true,
    options?: { fit?: 'cover' | 'contain'; forcePortrait?: boolean }
  ): Promise<{ width: number; height: number }> {
    const userRot = this.normalizeRotation(userOrDeliveryRotationDegrees);
    const fit = options?.fit ?? 'cover';
    const info = await this.probeVideoStreamInfo(sourcePath);

    let dispW = info.displayWidth || info.width;
    let dispH = info.displayHeight || info.height;
    if (userRot === 90 || userRot === 270) {
      const t = dispW;
      dispW = dispH;
      dispH = t;
    }

    // Telemóvel em portrait: pixels landscape + rotate 90/270 → forçar canvas 9:16
    const phonePortraitMeta =
      (info.rotation === 90 || info.rotation === 270) && info.width >= info.height;
    const canvas =
      options?.forcePortrait || phonePortraitMeta
        ? { width: TOTEM_PORTRAIT_WIDTH, height: TOTEM_PORTRAIT_HEIGHT, portrait: true }
        : this.resolveDeliveryCanvas(dispW, dispH);

    // Só transpose extra da UI; a orientação do telemóvel vem do autorotate do ffmpeg
    const filters = this.getTotemDeliveryVideoFilterChain(
      userRot,
      canvas.width,
      canvas.height,
      fit
    );

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        sourcePath,
        '-vf',
        filters,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-threads',
        '2',
        '-crf',
        '28',
        '-maxrate',
        '4M',
        '-bufsize',
        '8M',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'main',
        '-level',
        '4.0',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        '-metadata:s:v:0',
        'rotate=0',
        '-metadata',
        'delivery_rotation=0',
        '-metadata',
        `delivery_bake=${DELIVERY_BAKE_VERSION}`,
        outputPath,
      ],
      { timeout: 600_000 }
    );
    return { width: canvas.width, height: canvas.height };
  }

  private async generatePreviewThumbnailFromImageSource(
    sourcePath: string,
    rotationDegrees: number
  ): Promise<string> {
    const thumbnailPath = sourcePath.replace(/\.[^/.]+$/, '_thumb.jpg');
    let pipeline = (sharp as any)(sourcePath).rotate();
    if (rotationDegrees !== 0) {
      pipeline = pipeline.rotate(rotationDegrees);
    }
    await pipeline
      .resize(TOTEM_THUMB_WIDTH, TOTEM_THUMB_HEIGHT, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .jpeg({ quality: 82, progressive: true })
      .toFile(thumbnailPath);
    return thumbnailPath;
  }

  private async generatePreviewThumbnailFromVideoSource(
    sourcePath: string,
    rotationDegrees: number
  ): Promise<string> {
    const thumbnailPath = sourcePath.replace(/\.[^/.]+$/, '_thumb.jpg');
    await this.removeFileIfExists(thumbnailPath);
    const rot = this.normalizeRotation(rotationDegrees);
    const filters = this.getTotemPreviewVideoFilterChain(rot);
    // rotationDegrees==0 → deixar ffmpeg autorotar metadado do telemóvel
    // rotationDegrees!=0 → -noautorotate (transpose explícito da UI / landscape→thumb)
    const args = ['-y'];
    if (rot !== 0) {
      args.push('-noautorotate');
    }
    args.push(
      '-ss',
      '00:00:01',
      '-i',
      sourcePath,
      '-vframes',
      '1',
      '-vf',
      filters,
      '-q:v',
      '3',
      thumbnailPath
    );
    await execFileAsync('ffmpeg', args, { timeout: 60_000 });
    return thumbnailPath;
  }

  private isTotemDeliverySize(width: number, height: number): boolean {
    return (
      (width === TOTEM_LANDSCAPE_WIDTH && height === TOTEM_LANDSCAPE_HEIGHT) ||
      (width === TOTEM_PORTRAIT_WIDTH && height === TOTEM_PORTRAIT_HEIGHT)
    );
  }

  private async generatePortraitThumbnailFromDeliveryImage(
    filePath: string,
    _deliveryRotation?: number
  ): Promise<string> {
    // UI alinhada ao preview (olho): landscape upright + contain/letterbox na moldura 9:16.
    // Não aplicar +90° — isso deixava o card deitado enquanto o ficheiro de entrega aparece certo.
    return this.generatePreviewThumbnailFromImageSource(filePath, 0);
  }

  private async generatePortraitThumbnailFromDeliveryVideo(
    filePath: string,
    _deliveryRotation?: number
  ): Promise<string> {
    // Mesmo critério da imagem: 9:16 com contain, sem rotação de montagem no JPEG.
    return this.generatePreviewThumbnailFromVideoSource(filePath, 0);
  }

  /** Thumbnail 9:16 a partir do ficheiro original (antes da entrega 16:9). */
  private async generatePortraitThumbnailFromVideoFile(
    filePath: string,
    tags?: string[] | null
  ): Promise<string> {
    const info = await this.probeVideoStreamInfo(filePath);
    if (await this.isNormalizedTotemDeliveryVideo(filePath, info.width, info.height)) {
      return this.generatePortraitThumbnailFromDeliveryVideo(filePath);
    }
    if (this.isTotemDeliverySize(info.width, info.height)) {
      const fromTag = this.parseDeliveryRotationFromTags(tags);
      if (fromTag != null) {
        return this.generatePortraitThumbnailFromDeliveryVideo(filePath, fromTag);
      }
    }
    // Telemóvel: deixar autorotate do ffmpeg + cover 9:16 (sem somar stream+preview)
    return this.generatePreviewThumbnailFromVideoSource(filePath, 0);
  }

  private async generatePortraitThumbnailFromImageFile(filePath: string): Promise<string> {
    const meta = await (sharp as any)(filePath).rotate().metadata().catch(() => null);
    const w = meta?.width ?? 0;
    const h = meta?.height ?? 0;
    if (this.isTotemDeliverySize(w, h)) {
      return this.generatePortraitThumbnailFromDeliveryImage(filePath);
    }
    // EXIF via sharp.rotate() no pipeline; sem auto +90° landscape (igual ao diálogo olho).
    return this.generatePreviewThumbnailFromImageSource(filePath, 0);
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
    isAdmin: boolean = false,
    options?: { forceDetach?: boolean }
  ): Promise<ForceDeleteMediaResult | void> {
    try {
      const media = await this.getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!media) {
        throw new Error('Mídia não encontrada');
      }

      if (!isAdmin && requestSubscriberId && media.subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: mídia não pertence a este subscriber');
      }

      const deletionService = getMediaDeletionService();
      const usage = await deletionService.getMediaUsage(mediaId);
      const inUse = deletionService.hasUsage(usage);

      if (inUse && !options?.forceDetach) {
        throw new MediaInUseError(
          deletionService.buildConflictPayload(mediaId, media.name, usage)
        );
      }

      if (inUse && options?.forceDetach) {
        return deletionService.forceDetachAndDelete({
          mediaId,
          mediaName: media.name,
          filePath: media.filePath || (media as any).file_path,
          subscriberId: media.subscriberId,
          deletedBy,
        });
      }

      // Sem referências — exclusão simples
      const filePathToDelete = media.filePath || (media as any).file_path;
      if (filePathToDelete) {
        await this.getStorageService().deleteMediaFile(filePathToDelete);
      }

      await this.db.executeRaw(`
        DELETE FROM medias WHERE media_id = $1
      `, [mediaId]);

      await this.getAuditService().log('media', 'deleted', deletedBy, {
        mediaId,
        name: media.name,
        filePath: media.filePath,
        subscriberId: media.subscriberId
      });

      await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', media.subscriberId).catch(() => {});

    } catch (error: any) {
      if (error instanceof MediaInUseError) {
        throw error;
      }
      await logError('Erro ao remover mídia', error, { mediaId });
      throw error;
    }
  }

  /**
   * Processa mídia (extrai metadados, gera thumbnail)
   */
  private async processMedia(
    buffer: Buffer,
    mimetype: string,
    filePath: string,
    options?: { deferVideoFfmpeg?: boolean }
  ): Promise<{
    width?: number;
    height?: number;
    durationSeconds?: number;
    previewUrl?: string;
  }> {
    try {
      const result: any = {};

      if (mimetype.startsWith('image/')) {
        const meta = await (sharp as any)(filePath).metadata().catch(async () =>
          (sharp as any)(buffer).metadata()
        );
        const w = meta?.width ?? 0;
        const h = meta?.height ?? 0;
        if (this.isTotemDeliverySize(w, h)) {
          result.width = w;
          result.height = h;
        } else {
          const effective = await this.probeImageEffectiveSize(filePath);
          result.width = effective.displayWidth || w;
          result.height = effective.displayHeight || h;
        }

        const thumbPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
        if (!fs.existsSync(thumbPath)) {
          await this.generatePortraitThumbnailFromImageFile(filePath);
        }
        result.previewUrl = generateThumbnailUrl(thumbPath, 'image');

      } else if (mimetype.startsWith('video/')) {
        const probed = await this.probeMediaWithFfprobe(filePath, mimetype);
        result.durationSeconds = probed.durationSeconds ?? 0;
        if (this.isTotemDeliverySize(probed.width || 0, probed.height || 0)) {
          result.width = probed.width;
          result.height = probed.height;
        } else {
          const info = await this.probeVideoStreamInfo(filePath);
          result.width = info.displayWidth || probed.width;
          result.height = info.displayHeight || probed.height;
        }

        const thumbPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
        if (!options?.deferVideoFfmpeg) {
          if (!fs.existsSync(thumbPath)) {
            await this.generatePortraitThumbnailFromVideoFile(filePath);
          }
          result.previewUrl = generateThumbnailUrl(thumbPath, 'video');
        }

      } else if (mimetype.startsWith('audio/')) {
        const probed = await this.probeMediaWithFfprobe(filePath, mimetype);
        result.durationSeconds = probed.durationSeconds ?? 0;
      }

      return result;

    } catch (error: any) {
      await logError('Erro ao processar mídia', error, { filePath, mimetype });
      return {};
    }
  }

  /**
   * Extrai duração (e dimensões de vídeo) via ffprobe. Retorna vazio se ffprobe indisponível.
   */
  private async probeMediaWithFfprobe(
    filePath: string,
    mimetype: string
  ): Promise<{ durationSeconds?: number; width?: number; height?: number }> {
    const result: { durationSeconds?: number; width?: number; height?: number } = {};

    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          filePath,
        ],
        { timeout: 30_000 }
      );
      const dur = Math.round(Number(String(stdout).trim()));
      if (Number.isFinite(dur) && dur > 0) {
        result.durationSeconds = dur;
      }
    } catch (error: any) {
      await logWarn('ffprobe não extraiu duração do arquivo', { filePath, error: error?.message });
    }

    if (mimetype.startsWith('video/')) {
      try {
        const { stdout } = await execFileAsync(
          'ffprobe',
          [
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height',
            '-of',
            'json',
            filePath,
          ],
          { timeout: 30_000 }
        );
        const stream = JSON.parse(stdout)?.streams?.[0];
        if (stream?.width) result.width = Number(stream.width);
        if (stream?.height) result.height = Number(stream.height);
      } catch {
        // dimensões opcionais
      }
    }

    return result;
  }

  /**
   * Gera thumbnail de vídeo (frame em 9:16, alinhado ao ficheiro totem).
   */
  private async generateVideoThumbnail(_buffer: Buffer, filePath: string): Promise<string> {
    try {
      return await this.generatePortraitThumbnailFromVideoFile(filePath);
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
    if (mimetype === 'text/html' || mimetype === 'application/xhtml+xml') return 'html';
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
  async getThumbnail(mediaId: number, options?: { regenerate?: boolean }): Promise<string | null> {
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

      // 1) Vídeo: gerar/regerar thumbnail 9:16 (corrige thumbs antigos de entrega 16:9)
      const existingFilePath = checkFilePath(media.filePath);
      if (media.mediaType === 'video' && existingFilePath) {
        try {
          const info = await this.probeVideoStreamInfo(existingFilePath);
          if (
            await this.isTotemDeliveryVideoForThumbnail(
              existingFilePath,
              info.width,
              info.height,
              media.tags
            )
          ) {
            const fromTag = this.parseDeliveryRotationFromTags(media.tags);
            const fromFile = await this.readDeliveryRotationMetadata(existingFilePath);
            const delivery = fromTag ?? fromFile ?? 90;
            if (fromTag == null && fromFile != null) {
              const nextTags = this.mergeDeliveryRotationTag(media.tags, delivery);
              await this.db.executeRaw(
                `UPDATE medias SET tags = $1, updated_at = CURRENT_TIMESTAMP WHERE media_id = $2`,
                [nextTags, mediaId]
              ).catch(() => {});
            }
            const thumbPath = await this.generatePortraitThumbnailFromDeliveryVideo(
              existingFilePath,
              delivery
            );
            if (thumbPath && fs.existsSync(thumbPath)) {
              return thumbPath;
            }
          } else {
            const thumbPath = await this.generatePortraitThumbnailFromVideoFile(
              existingFilePath,
              media.tags
            );
            if (thumbPath && fs.existsSync(thumbPath)) {
              return thumbPath;
            }
          }
        } catch (error: any) {
          await logWarn('Falha ao gerar thumbnail de vídeo on-demand', {
            mediaId,
            error: error?.message,
          });
        }
      }

      // 2) Thumbnail ao lado do ficheiro (imagens e fallback)
      const siblingThumb = media.filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      const existingSiblingThumb = options?.regenerate ? null : checkFilePath(siblingThumb);
      if (existingSiblingThumb) {
        return existingSiblingThumb;
      }

      // 3b) HTML publish-board: thumbnail 9:16 ao lado do ficheiro
      if (media.mediaType === 'html' && existingFilePath) {
        const htmlThumb = htmlBoardThumbPathForFile(existingFilePath);
        if (options?.regenerate && fs.existsSync(htmlThumb)) {
          try {
            fs.unlinkSync(htmlThumb);
          } catch {
            /* noop */
          }
        }
        const existingHtmlThumb = options?.regenerate ? null : checkFilePath(htmlThumb);
        if (existingHtmlThumb) {
          return existingHtmlThumb;
        }
        try {
          const layoutMeta = await this.resolvePublishBoardThumbMeta(media);
          const generated = await writeHtmlBoardThumbnail(htmlThumb, {
            boardTitle: layoutMeta.boardTitle,
            accentColor: layoutMeta.accentColor,
            presetLabel: layoutMeta.presetLabel,
            footerLabel: 'HTML ao vivo',
          });
          if (generated) return generated;
        } catch {
          /* fallback abaixo */
        }
      }

      // 3) Imagem: thumbnail 9:16 ao lado do ficheiro ou cache
      if (media.mediaType === 'image' && existingFilePath) {
        try {
          const meta = await (sharp as any)(existingFilePath).rotate().metadata();
          const w = meta?.width ?? 0;
          const h = meta?.height ?? 0;
          if (this.isTotemDeliverySize(w, h)) {
            const thumbPath = await this.generatePortraitThumbnailFromDeliveryImage(existingFilePath);
            if (thumbPath && fs.existsSync(thumbPath)) {
              return thumbPath;
            }
          }
        } catch {
          /* tenta fallback abaixo */
        }
        if (fs.existsSync(generatedThumbPath)) {
          return generatedThumbPath;
        }
        await (sharp as any)(existingFilePath)
          .rotate()
          .resize(TOTEM_THUMB_WIDTH, TOTEM_THUMB_HEIGHT, {
            fit: 'contain',
            position: 'centre',
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          })
          .jpeg({ quality: 82, progressive: true })
          .toFile(generatedThumbPath);
        return generatedThumbPath;
      }

      // 4) Fallback: placeholder
      return await this.ensurePlaceholderImage(placeholderPath);
    } catch (error: any) {
      await logError('Erro ao buscar thumbnail', error, { mediaId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera (ou reutiliza) um placeholder de thumbnail para evitar 404 no frontend.
   */
  private async resolvePublishBoardThumbMeta(media: MediaResponse): Promise<{
    boardTitle: string;
    accentColor: string;
    presetLabel: string;
  }> {
    const tags = Array.isArray(media.tags) ? media.tags.map(String) : [];
    const presetTag = ['menu', 'promotion', 'ad', 'announcement', 'institutional'].find((p) =>
      tags.includes(p)
    );
    const fallbackTitle = String(media.name || 'HTML')
      .replace(/\s*—\s*[^—]+(\(HTML\))?$/i, '')
      .trim() || String(media.name || 'HTML');

    if (!media.subscriberId || !presetTag) {
      return {
        boardTitle: fallbackTitle,
        accentColor: '#ff9800',
        presetLabel: 'HTML',
      };
    }

    const row = await this.db.findFirst(
      `
      SELECT board_title, accent_color, preset
      FROM publish_board_layouts
      WHERE subscriber_id = $1 AND preset = $2
      LIMIT 1
    `,
      [media.subscriberId, presetTag]
    );

    const presetMeta = findPublishPreset(presetTag as PublishBoardPresetType);
    return {
      boardTitle: String(row?.board_title || fallbackTitle),
      accentColor: String(row?.accent_color || '#ff9800'),
      presetLabel: presetMeta.label,
    };
  }

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
    } = {},
    updatedBy?: number
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
            await this.generatePortraitThumbnailFromImageFile(media.filePath);
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

        if (processed && (result.optimized || result.resized)) {
          const refreshed = await this.getMediaById(mediaId);
          await getMediaTotemSyncService()
            .notifyAffectedTotems(mediaId, {
              reason: 'process',
              updatedBy,
              updatedAt: refreshed?.updatedAt,
              filePath: refreshed?.filePath ?? media.filePath,
              fileSizeBytes: refreshed?.fileSizeBytes ?? result.metadata?.size,
            })
            .catch((e) => logError('Falha ao notificar totens após processar mídia', e, { mediaId }));
        }

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



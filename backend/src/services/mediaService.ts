/**
 * Media Service - Smart Signage v2.0
 * Serviço de gerenciamento de mídia
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { StorageService } from './storageService';

export interface CreateMediaRequest {
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  clientId: number;
  createdBy: number;
}

export interface UpdateMediaRequest {
  name?: string;
  title?: string;
  description?: string;
  tags?: string[];
  status?: string;
}

export interface MediaResponse {
  id: number;
  name: string;
  title?: string;
  description?: string;
  tags: string[];
  version: number;
  checksum?: string;
  previewUrl?: string;
  status: string;
  createdBy?: number;
  filePath: string;
  mediaType: string;
  durationSeconds?: number;
  sizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  authorName?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
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
   */
  async getAllMedia(filters: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    clientId?: number;
  }): Promise<any> {
    const result = await this.getMedia(
      filters.page || 1,
      filters.limit || 1000,
      {
        clientId: filters.clientId,
        mediaType: filters.type,
        search: filters.search
      }
    );
    return result;
  }

  /**
   * Lista mídia com paginação e filtros
   */
  async getMedia(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number;
      mediaType?: string;
      status?: string;
      search?: string;
    } = {}
  ): Promise<{ media: MediaResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.clientId) {
        whereClause += ' AND m.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.mediaType) {
        whereClause += ' AND m.media_type = ?';
        params.push(filters.mediaType);
      }

      if (filters.status) {
        whereClause += ' AND m.status = ?';
        params.push(filters.status);
      }

      if (filters.search) {
        whereClause += ' AND (m.name LIKE ? OR m.title LIKE ? OR m.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar mídia
      const media = await this.db.findMany(`
        SELECT 
          m.media_id as id,
          m.name,
          m.title,
          m.description,
          m.tags,
          m.version,
          m.checksum,
          m.preview_url as previewUrl,
          m.status,
          m.created_by as createdBy,
          m.file_path as filePath,
          m.media_type as mediaType,
          m.duration_seconds as durationSeconds,
          m.size_bytes as sizeBytes,
          m.mime_type as mimeType,
          m.width,
          m.height,
          m.created_at as createdAt,
          m.updated_at as updatedAt,
          c.name as clientName,
          u.username as authorName
        FROM medias m
        LEFT JOIN clients c ON m.client_id = c.client_id
        LEFT JOIN users u ON m.created_by = u.user_id
        ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM medias m
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar mídia
      const processedMedia = media.map(item => ({
        ...item,
        tags: item.tags ? JSON.parse(item.tags) : [],
        downloadUrl: this.getDownloadUrl(item.filePath),
        thumbnailUrl: this.getThumbnailUrl(item.filePath, item.mediaType)
      }));

      return {
        media: processedMedia,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar mídia:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca mídia por ID
   */
  async getMediaById(mediaId: number): Promise<MediaResponse | null> {
    try {
      const media = await this.db.findFirst(`
        SELECT 
          m.media_id as id,
          m.name,
          m.title,
          m.description,
          m.tags,
          m.version,
          m.checksum,
          m.preview_url as previewUrl,
          m.status,
          m.created_by as createdBy,
          m.file_path as filePath,
          m.media_type as mediaType,
          m.duration_seconds as durationSeconds,
          m.size_bytes as sizeBytes,
          m.mime_type as mimeType,
          m.width,
          m.height,
          m.created_at as createdAt,
          m.updated_at as updatedAt,
          c.name as clientName,
          u.username as authorName
        FROM medias m
        LEFT JOIN clients c ON m.client_id = c.client_id
        LEFT JOIN users u ON m.created_by = u.user_id
        WHERE m.media_id = ?
      `, [mediaId]);

      if (!media) {
        return null;
      }

      return {
        ...media,
        tags: media.tags ? JSON.parse(media.tags) : [],
        downloadUrl: this.getDownloadUrl(media.filePath),
        thumbnailUrl: this.getThumbnailUrl(media.filePath, media.mediaType)
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar mídia:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria múltiplas mídias
   */
  async createMultipleMedia(files: any[]): Promise<MediaResponse[]> {
    try {
      const results: MediaResponse[] = [];
      
      for (const file of files) {
        const mediaData = {
          name: file.originalname,
          title: file.originalname,
          description: '',
          tags: [],
          file: file,
          clientId: 1, // Default client
          createdBy: 1 // Default user
        };
        
        const media = await this.createMedia(mediaData);
        results.push(media);
      }
      
      return results;
    } catch (error: any) {
      console.error('❌ Erro ao criar múltiplas mídias:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova mídia
   */
  async createMedia(data: CreateMediaRequest): Promise<MediaResponse> {
    try {
      const { name, title, description, tags, file, clientId, createdBy } = data;

      // Verificar se nome já existe para o cliente
      const existingMedia = await this.db.findFirst(`
        SELECT media_id FROM medias WHERE name = ? AND client_id = ?
      `, [name, clientId]);

      if (existingMedia) {
        throw new Error('Nome de mídia já existe para este cliente');
      }

      // Determinar tipo de mídia
      const mediaType = this.getMediaType(file.mimetype);
      
      // Gerar checksum
      const checksum = await this.generateChecksum(file.buffer);

      // Salvar arquivo
      const filePath = await this.getStorageService().saveMediaFile(file, clientId, name);

      // Processar mídia (gerar thumbnail, extrair metadados)
      const metadata = await this.processMedia(file.buffer, file.mimetype, filePath);

      // Criar registro no banco
      const result = await this.db.executeRaw(`
        INSERT INTO medias (
          client_id, name, title, description, tags, version, checksum,
          preview_url, status, created_by, file_path, media_type,
          duration_seconds, size_bytes, mime_type, width, height
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        clientId,
        name,
        title,
        description,
        tags ? JSON.stringify(tags) : null,
        checksum,
        metadata.previewUrl,
        createdBy,
        filePath,
        mediaType,
        metadata.durationSeconds,
        file.size,
        file.mimetype,
        metadata.width,
        metadata.height
      ]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar mídia');
      }

      // Buscar mídia criada
      const newMedia = await this.getMediaById(result.lastInsertRowid);
      if (!newMedia) {
        throw new Error('Erro ao buscar mídia criada');
      }

      // Log de auditoria
      await this.getAuditService().log('media', 'created', createdBy, {
        mediaId: newMedia.id,
        name: newMedia.name,
        mediaType: newMedia.mediaType,
        size: newMedia.sizeBytes
      });

      return newMedia;

    } catch (error: any) {
      console.error('❌ Erro ao criar mídia:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza mídia
   */
  async updateMedia(mediaId: number, data: UpdateMediaRequest, updatedBy: number): Promise<MediaResponse> {
    try {
      // Verificar se mídia existe
      const existingMedia = await this.getMediaById(mediaId);
      if (!existingMedia) {
        throw new Error('Mídia não encontrada');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(data.tags));
      }

      if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
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
        WHERE media_id = ?
      `, params);

      // Buscar mídia atualizada
      const updatedMedia = await this.getMediaById(mediaId);
      if (!updatedMedia) {
        throw new Error('Erro ao buscar mídia atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('media', 'updated', updatedBy, {
        mediaId,
        changes: data
      });

      return updatedMedia;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar mídia:', error.message);
      throw error;
    }
  }

  /**
   * Remove mídia
   */
  async deleteMedia(mediaId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se mídia existe
      const media = await this.getMediaById(mediaId);
      if (!media) {
        throw new Error('Mídia não encontrada');
      }

      // Verificar se está sendo usada em playlists
      const playlistUsage = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlist_items WHERE media_id = ?
      `, [mediaId]);

      if (playlistUsage.count > 0) {
        throw new Error('Não é possível remover mídia que está sendo usada em playlists');
      }

      // Remover arquivo físico
      await this.getStorageService().deleteMediaFile(media.filePath);

      // Remover do banco
      await this.db.executeRaw(`
        DELETE FROM medias WHERE media_id = ?
      `, [mediaId]);

      // Log de auditoria
      await this.getAuditService().log('media', 'deleted', deletedBy, {
        mediaId,
        name: media.name,
        filePath: media.filePath
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover mídia:', error.message);
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
      console.error('❌ Erro ao processar mídia:', error.message);
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
      console.error('❌ Erro ao gerar thumbnail:', error.message);
      return filePath;
    }
  }

  /**
   * Gera thumbnail de vídeo
   * Nota: Requer ffmpeg instalado no sistema para funcionar completamente
   */
  private async generateVideoThumbnail(buffer: Buffer, filePath: string): Promise<string> {
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
        console.warn('⚠️ ffmpeg não disponível. Thumbnail de vídeo não pode ser gerado.');
        console.warn('   Instale ffmpeg para suporte completo: sudo apt-get install ffmpeg');
        
        // Retornar caminho original como fallback
        return filePath;
      }

      return filePath;

    } catch (error: any) {
      console.error('❌ Erro ao gerar thumbnail de vídeo:', error.message);
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
   */
  private async generateChecksum(buffer: Buffer): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Gera URL de download
   */
  private getDownloadUrl(filePath: string): string {
    const relativePath = filePath.replace('/opt/smart-signage/public/assets/', '');
    return `/assets/${relativePath}`;
  }

  /**
   * Gera URL de thumbnail
   */
  private getThumbnailUrl(filePath: string, mediaType: string): string {
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
      if (!media) {
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
      console.error('❌ Erro ao buscar thumbnail:', error.message);
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
      if (!media) {
        throw new Error('Mídia não encontrada');
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
            SET size_bytes = ?, updated_at = CURRENT_TIMESTAMP
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
            SET width = ?, height = ?, size_bytes = ?, updated_at = CURRENT_TIMESTAMP
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
      console.error('❌ Erro ao processar mídia:', error.message);
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
      console.error('❌ Erro ao buscar estatísticas de armazenamento:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas de mídia
   */
  async getMediaStats(clientId?: number): Promise<MediaStats> {
    try {
      let whereClause = '';
      const params: any[] = [];

      if (clientId) {
        whereClause = 'WHERE client_id = ?';
        params.push(clientId);
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
        SELECT SUM(size_bytes) as total FROM medias ${whereClause}
      `, params);

      // Atividade recente (últimos 7 dias)
      const recentMediaResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} created_at >= datetime('now', '-7 days')
      `, params);

      const publishedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} status = 'published' AND updated_at >= datetime('now', '-7 days')
      `, params);

      const archivedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} status = 'archived' AND updated_at >= datetime('now', '-7 days')
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
      console.error('❌ Erro ao buscar estatísticas de mídia:', error.message);
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
        whereClause += ' AND m.client_id = ?';
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
          m.title,
          m.description,
          m.tags,
          m.version,
          m.checksum,
          m.preview_url as previewUrl,
          m.status,
          m.created_by as createdBy,
          m.file_path as filePath,
          m.media_type as mediaType,
          m.duration_seconds as durationSeconds,
          m.size_bytes as sizeBytes,
          m.mime_type as mimeType,
          m.width,
          m.height,
          m.created_at as createdAt,
          m.updated_at as updatedAt,
          c.name as clientName,
          u.username as authorName
        FROM medias m
        LEFT JOIN clients c ON m.client_id = c.client_id
        LEFT JOIN users u ON m.created_by = u.user_id
        ${whereClause}
        ORDER BY m.created_at DESC
      `, params);

      return media.map(item => ({
        ...item,
        tags: item.tags ? JSON.parse(item.tags) : [],
        downloadUrl: this.getDownloadUrl(item.filePath),
        thumbnailUrl: this.getThumbnailUrl(item.filePath, item.mediaType)
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar mídia por tags:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}


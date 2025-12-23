/**
 * OTA Update Service - Smart Signage v2.1
 * Serviço para gerenciar atualizações Over-The-Air dos players
 */

import { getDatabase } from '../config/database';
import { logInfo, logError } from '../utils/loggerHelper';
import fs from 'fs';
import crypto from 'crypto';

export interface OTAUpdate {
  id: number;
  version: string;
  platform: 'webos' | 'tizen' | 'android' | 'linux' | 'windows' | 'all';
  filePath: string;
  fileSize: number;
  checksum: string;
  description?: string;
  changelog?: string;
  isMandatory: boolean;
  minVersion?: string; // Versão mínima necessária para atualizar
  maxVersion?: string; // Versão máxima que pode atualizar
  rolloutPercentage: number; // 0-100, porcentagem de rollout gradual
  status: 'draft' | 'testing' | 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: Date;
  releasedAt?: Date;
}

export interface OTAUpdateRequest {
  version: string;
  platform: 'webos' | 'tizen' | 'android' | 'linux' | 'windows' | 'all';
  filePath: string;
  description?: string;
  changelog?: string;
  isMandatory?: boolean;
  minVersion?: string;
  maxVersion?: string;
  rolloutPercentage?: number;
}

export interface TotemUpdateStatus {
  totemId: number;
  currentVersion: string;
  availableVersion?: string;
  updateStatus: 'up_to_date' | 'update_available' | 'downloading' | 'installing' | 'failed' | 'rollback';
  lastCheck?: Date;
  lastUpdate?: Date;
  error?: string;
}

export class OTAUpdateService {
  private get db() {
    return getDatabase();
  }

  /**
   * Cria uma nova atualização OTA
   */
  async createUpdate(request: OTAUpdateRequest, userId: number): Promise<OTAUpdate> {
    try {
      await logInfo('Criando atualização OTA', {
        version: request.version,
        platform: request.platform,
        userId
      });

      // Verificar se arquivo existe
      if (!fs.existsSync(request.filePath)) {
        throw new Error('Arquivo de atualização não encontrado');
      }

      // Calcular checksum do arquivo
      const fileBuffer = fs.readFileSync(request.filePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const fileSize = fs.statSync(request.filePath).size;

      // Verificar se versão já existe para esta plataforma
      const existing = await this.db.findFirst(`
        SELECT id, version, platform, status
        FROM ota_updates
        WHERE version = $1 AND platform = $2
      `, [request.version, request.platform]);

      if (existing && existing.status !== 'cancelled') {
        throw new Error(`Versão ${request.version} já existe para plataforma ${request.platform}`);
      }

      // Inserir atualização
      const result = await this.db.executeRaw(`
        INSERT INTO ota_updates (
          version, platform, file_path, file_size, checksum,
          description, changelog, is_mandatory, min_version, max_version,
          rollout_percentage, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
        RETURNING *
      `, [
        request.version,
        request.platform,
        request.filePath,
        fileSize,
        checksum,
        request.description || null,
        request.changelog || null,
        request.isMandatory || false,
        request.minVersion || null,
        request.maxVersion || null,
        request.rolloutPercentage || 100,
        userId
      ]);

      const update = result.rows[0];

      await logInfo('Atualização OTA criada', {
        updateId: update.id,
        version: request.version
      });

      return this.mapToOTAUpdate(update);
    } catch (error: any) {
      await logError('Erro ao criar atualização OTA', error, {
        version: request.version,
        platform: request.platform
      });
      throw error;
    }
  }

  /**
   * Ativa uma atualização OTA
   */
  async activateUpdate(updateId: number, _userId: number): Promise<void> {
    try {
      const update = await this.db.findFirst(`
        SELECT * FROM ota_updates WHERE id = $1
      `, [updateId]);

      if (!update) {
        throw new Error('Atualização não encontrada');
      }

      if (update.status === 'active') {
        return; // Já está ativa
      }

      await this.db.executeRaw(`
        UPDATE ota_updates
        SET status = 'active', released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [updateId]);

      await logInfo('Atualização OTA ativada', { updateId, version: update.version });
    } catch (error: any) {
      await logError('Erro ao ativar atualização OTA', error, { updateId });
      throw error;
    }
  }

  /**
   * Pausa uma atualização OTA
   */
  async pauseUpdate(updateId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE ota_updates
        SET status = 'paused', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [updateId]);

      await logInfo('Atualização OTA pausada', { updateId });
    } catch (error: any) {
      await logError('Erro ao pausar atualização OTA', error, { updateId });
      throw error;
    }
  }

  /**
   * Obtém atualização disponível para um totem
   */
  async getAvailableUpdate(totemId: number, currentVersion: string, platform: string): Promise<OTAUpdate | null> {
    try {
      // Buscar totem para obter plataforma
      const totem = await this.db.findFirst(`
        SELECT platform, identifier
        FROM totems
        WHERE totem_id = $1
      `, [totemId]);

      if (!totem) {
        return null;
      }

      // Buscar atualização ativa para esta plataforma
      const update = await this.db.findFirst(`
        SELECT *
        FROM ota_updates
        WHERE platform IN ($1, 'all')
          AND status = 'active'
          AND version > $2
          AND (min_version IS NULL OR $2 >= min_version)
          AND (max_version IS NULL OR $2 <= max_version)
        ORDER BY version DESC
        LIMIT 1
      `, [platform, currentVersion]);

      if (!update) {
        return null;
      }

      // Verificar rollout percentage (distribuição gradual)
      if (update.rollout_percentage < 100) {
        // Usar hash do totem_id para determinar se deve receber atualização
        const hash = crypto.createHash('md5').update(`${totemId}-${update.id}`).digest('hex');
        const hashInt = parseInt(hash.substring(0, 8), 16);
        const percentage = (hashInt % 100) + 1;
        
        if (percentage > update.rollout_percentage) {
          await logInfo('Totem não recebe atualização devido ao rollout percentage', {
            totemId,
            updateId: update.id,
            rolloutPercentage: update.rollout_percentage,
            calculatedPercentage: percentage
          });
          return null;
        }
      }

      return this.mapToOTAUpdate(update);
    } catch (error: any) {
      await logError('Erro ao obter atualização disponível', error, { totemId });
      return null;
    }
  }

  /**
   * Registra status de atualização de um totem
   */
  async updateTotemStatus(totemId: number, status: TotemUpdateStatus): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO totem_update_status (
          totem_id, current_version, available_version, update_status,
          last_check, last_update, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (totem_id) DO UPDATE SET
          current_version = $2,
          available_version = $3,
          update_status = $4,
          last_check = $5,
          last_update = $6,
          error_message = $7,
          updated_at = CURRENT_TIMESTAMP
      `, [
        totemId,
        status.currentVersion,
        status.availableVersion || null,
        status.updateStatus,
        status.lastCheck || new Date(),
        status.lastUpdate || null,
        status.error || null
      ]);
    } catch (error: any) {
      await logError('Erro ao atualizar status de atualização do totem', error, { totemId });
    }
  }

  /**
   * Obtém histórico de atualizações
   */
  async getUpdateHistory(limit: number = 50): Promise<OTAUpdate[]> {
    try {
      const updates = await this.db.findMany(`
        SELECT *
        FROM ota_updates
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return updates.map(update => this.mapToOTAUpdate(update));
    } catch (error: any) {
      await logError('Erro ao obter histórico de atualizações', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de atualizações
   */
  async getUpdateStats(): Promise<any> {
    try {
      const stats = await this.db.findFirst(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) FILTER (WHERE status = 'testing') as testing_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COUNT(DISTINCT platform) as platform_count
        FROM ota_updates
      `);

      const totemStats = await this.db.findFirst(`
        SELECT
          COUNT(*) FILTER (WHERE update_status = 'up_to_date') as up_to_date_count,
          COUNT(*) FILTER (WHERE update_status = 'update_available') as update_available_count,
          COUNT(*) FILTER (WHERE update_status = 'downloading') as downloading_count,
          COUNT(*) FILTER (WHERE update_status = 'installing') as installing_count,
          COUNT(*) FILTER (WHERE update_status = 'failed') as failed_count
        FROM totem_update_status
      `);

      return {
        updates: {
          active: stats?.active_count || 0,
          testing: stats?.testing_count || 0,
          completed: stats?.completed_count || 0,
          platforms: stats?.platform_count || 0
        },
        totems: {
          upToDate: totemStats?.up_to_date_count || 0,
          updateAvailable: totemStats?.update_available_count || 0,
          downloading: totemStats?.downloading_count || 0,
          installing: totemStats?.installing_count || 0,
          failed: totemStats?.failed_count || 0
        }
      };
    } catch (error: any) {
      await logError('Erro ao obter estatísticas de atualizações', error);
      throw error;
    }
  }

  /**
   * Mapeia resultado do banco para OTAUpdate
   */
  private mapToOTAUpdate(row: any): OTAUpdate {
    return {
      id: row.id,
      version: row.version,
      platform: row.platform,
      filePath: row.file_path,
      fileSize: row.file_size,
      checksum: row.checksum,
      description: row.description,
      changelog: row.changelog,
      isMandatory: row.is_mandatory,
      minVersion: row.min_version,
      maxVersion: row.max_version,
      rolloutPercentage: row.rollout_percentage,
      status: row.status,
      createdAt: new Date(row.created_at),
      releasedAt: row.released_at ? new Date(row.released_at) : undefined
    };
  }
}

// Singleton instance
let otaUpdateServiceInstance: OTAUpdateService | null = null;

export function getOTAUpdateService(): OTAUpdateService {
  if (!otaUpdateServiceInstance) {
    otaUpdateServiceInstance = new OTAUpdateService();
  }
  return otaUpdateServiceInstance;
}


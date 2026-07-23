/**
 * Remote Command Service - Smart Signage v2.1
 * Serviço para gerenciar comandos remotos aos totens
 */

import { getDatabase } from '../config/database';
import { getDatabase as getPgPool } from '../config/database-pg';
import {
  ensureRemoteCommandTypesConstraint,
  isRemoteCommandTypeConstraintError,
} from '../config/schemaCompat';
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';
import { getEventLogService, EventType } from './eventLogService';

export type CommandType =
  | 'restart'
  | 'restart_app'
  | 'reboot'
  | 'reset_board'
  | 'screenshot'
  | 'capture_screen'
  | 'invalidate_media'
  | 'invalidate_playlist'
  | 'invalidate_campaign'
  | 'refresh_dispatch'
  | 'sync_now'
  | 'content_version_check'
  | 'purge_cache'
  | 'update'
  | 'config'
  | 'apply_player_config'
  | 'ota_rollback'
  | 'display_force_on'
  | 'display_force_off'
  | 'display_force_clear'
  | 'custom';

export interface RemoteCommand {
  id: number;
  totemId: number;
  commandType: CommandType;
  commandData?: any;
  status: 'pending' | 'sent' | 'executing' | 'completed' | 'failed' | 'timeout';
  result?: any;
  errorMessage?: string;
  sentAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommandRequest {
  totemId: number;
  commandType: CommandType;
  commandData?: any;
}

export class RemoteCommandService {
  private get db() {
    return getDatabase();
  }

  private getEventLogService() {
    return getEventLogService();
  }

  /**
   * Cria um novo comando remoto
   */
  async createCommand(request: CreateCommandRequest, userId: number): Promise<RemoteCommand> {
    try {
      await logInfo('Criando comando remoto', {
        totemId: request.totemId,
        commandType: request.commandType,
        userId
      });

      // Verificar se totem existe e está ativo (coluna no BD: is_active)
      const totem = await this.db.findFirst(`
        SELECT totem_id, identifier, status, is_active
        FROM totems
        WHERE totem_id = $1
      `, [request.totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      if (!(totem as any).is_active) {
        throw new Error('Totem não está ativo');
      }

      const result = await this.insertRemoteCommandRow(request, userId);

      const command = result.rows[0];
      const commandId = command.command_id ?? command.id;

      // Registrar evento
      await this.getEventLogService().logEvent({
        eventType: EventType.TOTEM_COMMAND_SENT,
        entityType: 'remote_command',
        entityId: commandId,
        totemId: request.totemId,
        metadata: {
          commandType: request.commandType,
          commandId: command.id,
          commandData: request.commandData,
          userId
        }
      }).catch(e => logWarn('Erro ao registrar evento de comando', { error: e.message }));

      await logInfo('Comando remoto criado', {
        commandId: commandId,
        totemId: request.totemId
      });

      return this.mapToRemoteCommand(command);
    } catch (error: any) {
      await logError('Erro ao criar comando remoto', error, {
        totemId: request.totemId,
        commandType: request.commandType
      });
      throw error;
    }
  }

  private async insertRemoteCommandRow(request: CreateCommandRequest, userId: number) {
    const runInsert = () =>
      this.db.executeRaw(
        `
        INSERT INTO remote_commands (
          totem_id, user_id, command_type, status, parameters
        )
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *
      `,
        [
          request.totemId,
          userId,
          request.commandType,
          request.commandData ? JSON.stringify(request.commandData) : null,
        ]
      );

    try {
      return await runInsert();
    } catch (error: unknown) {
      if (!isRemoteCommandTypeConstraintError(error)) {
        throw error;
      }
      await logWarn('chk_remote_command_type desatualizado — aplicando compat e repetindo insert', {
        commandType: request.commandType,
        totemId: request.totemId,
      });
      await ensureRemoteCommandTypesConstraint(getPgPool(), { strict: true });
      return await runInsert();
    }
  }

  /**
   * Obtém comandos pendentes para um totem e marca-os como sent/executing
   * para evitar reentrega no próximo heartbeat.
   */
  async claimPendingCommands(totemId: number, limit: number = 10): Promise<RemoteCommand[]> {
    try {
      const claimed = await this.db.executeRaw(
        `
        UPDATE remote_commands
        SET status = 'sent',
            sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
            executed_at = COALESCE(executed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE command_id IN (
          SELECT command_id
          FROM remote_commands
          WHERE totem_id = $1 AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
        [totemId, limit]
      );
      const rows = claimed.rows || [];
      return rows.map((cmd: any) => this.mapToRemoteCommand(cmd));
    } catch (error: any) {
      // Fallback sem SKIP LOCKED (Postgres antigo / driver)
      await logWarn('claimPendingCommands com SKIP LOCKED falhou; fallback simples', {
        totemId,
        error: error?.message,
      });
      const pending = await this.getPendingCommands(totemId);
      const slice = pending.slice(0, limit);
      for (const cmd of slice) {
        await this.markCommandAsSent(cmd.id);
      }
      return slice;
    }
  }

  /**
   * Obtém comandos pendentes para um totem
   */
  async getPendingCommands(totemId: number): Promise<RemoteCommand[]> {
    try {
      const commands = await this.db.findMany(`
        SELECT *
        FROM remote_commands
        WHERE totem_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
      `, [totemId]);

      return commands.map(cmd => this.mapToRemoteCommand(cmd));
    } catch (error: any) {
      await logError('Erro ao obter comandos pendentes', error, { totemId });
      throw error;
    }
  }

  /**
   * Marca comando como enviado
   */
  async markCommandAsSent(commandId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE remote_commands
        SET status = 'executing', sent_at = CURRENT_TIMESTAMP, executed_at = CURRENT_TIMESTAMP
        WHERE command_id = $1
      `, [commandId]);

      await logDebug('Comando marcado como enviado', { commandId });
    } catch (error: any) {
      await logError('Erro ao marcar comando como enviado', error, { commandId });
      throw error;
    }
  }

  /**
   * Marca comando como executando
   */
  async markCommandAsExecuting(commandId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE remote_commands
        SET status = 'executing', executed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE command_id = $1
      `, [commandId]);

      await logDebug('Comando marcado como executando', { commandId });
    } catch (error: any) {
      await logError('Erro ao marcar comando como executando', error, { commandId });
      throw error;
    }
  }

  /**
   * Marca comando como completado
   */
  async markCommandAsCompleted(commandId: number, result?: any): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE remote_commands
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            response = $1
        WHERE command_id = $2
      `, [result ? JSON.stringify(result) : null, commandId]);

      await logInfo('Comando marcado como completado', { commandId });
    } catch (error: any) {
      await logError('Erro ao marcar comando como completado', error, { commandId });
      throw error;
    }
  }

  /**
   * Marca comando como falhado
   */
  async markCommandAsFailed(commandId: number, errorMessage: string): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE remote_commands
        SET status = 'failed',
            error_message = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE command_id = $2
      `, [errorMessage, commandId]);

      await logWarn('Comando marcado como falhado', { commandId, errorMessage });
    } catch (error: any) {
      await logError('Erro ao marcar comando como falhado', error, { commandId });
      throw error;
    }
  }

  /**
   * Obtém histórico de comandos de um totem
   */
  async getCommandHistory(totemId: number, limit: number = 50): Promise<RemoteCommand[]> {
    try {
      const commands = await this.db.findMany(`
        SELECT *
        FROM remote_commands
        WHERE totem_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [totemId, limit]);

      return commands.map(cmd => this.mapToRemoteCommand(cmd));
    } catch (error: any) {
      await logError('Erro ao obter histórico de comandos', error, { totemId });
      throw error;
    }
  }

  /**
   * Salva screenshot remoto
   */
  async saveScreenshot(
    totemId: number,
    filePath: string,
    fileSize: number,
    width: number,
    height: number,
    format: string = 'png',
    commandId?: number
  ): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        INSERT INTO remote_screenshots (
          totem_id, command_id, file_path, file_size, width, height, format
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [totemId, commandId || null, filePath, fileSize, width, height, format]);

      const screenshotId = result.rows[0].id;

      await logInfo('Screenshot salvo', {
        screenshotId,
        totemId,
        filePath
      });

      // Retenção: mantém as 20 mais recentes por totem
      await this.pruneScreenshotsPerTotem(20).catch(() => 0);

      return screenshotId;
    } catch (error: any) {
      await logError('Erro ao salvar screenshot', error, { totemId, filePath });
      throw error;
    }
  }

  /**
   * Obtém screenshots de um totem
   */
  async getScreenshots(totemId: number, limit: number = 20): Promise<any[]> {
    try {
      const screenshots = await this.db.findMany(`
        SELECT *
        FROM remote_screenshots
        WHERE totem_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [totemId, limit]);

      return screenshots;
    } catch (error: any) {
      await logError('Erro ao obter screenshots', error, { totemId });
      throw error;
    }
  }

  /**
   * Limpa screenshots antigos (mais de [days] dias) e apaga ficheiros no disco.
   */
  async cleanupOldScreenshots(days: number = 30): Promise<number> {
    try {
      const rows = await this.db.findMany(
        `
        SELECT id, file_path
        FROM remote_screenshots
        WHERE created_at < NOW() - ($1::text || ' days')::interval
      `,
        [String(Math.max(1, days))]
      );
      let deleted = 0;
      const fs = await import('fs');
      for (const row of rows as Array<{ id: number; file_path: string }>) {
        try {
          if (row.file_path && fs.existsSync(row.file_path)) {
            await fs.promises.unlink(row.file_path);
          }
        } catch {
          /* best-effort */
        }
        await this.db.executeRaw(`DELETE FROM remote_screenshots WHERE id = $1`, [row.id]);
        deleted += 1;
      }
      if (deleted > 0) {
        await logInfo('Screenshots remotos antigos limpos', { deleted, days });
      }
      return deleted;
    } catch (error: any) {
      await logError('Erro ao limpar screenshots antigos', error);
      return 0;
    }
  }

  /**
   * Mantém no máximo [keepPerTotem] capturas por totem (mais recentes).
   */
  async pruneScreenshotsPerTotem(keepPerTotem: number = 20): Promise<number> {
    try {
      const overflow = await this.db.findMany(
        `
        SELECT id, file_path FROM (
          SELECT id, file_path, totem_id,
                 ROW_NUMBER() OVER (PARTITION BY totem_id ORDER BY created_at DESC) AS rn
          FROM remote_screenshots
        ) t
        WHERE rn > $1
      `,
        [keepPerTotem]
      );
      let deleted = 0;
      const fs = await import('fs');
      for (const row of overflow as Array<{ id: number; file_path: string }>) {
        try {
          if (row.file_path && fs.existsSync(row.file_path)) {
            await fs.promises.unlink(row.file_path);
          }
        } catch {
          /* best-effort */
        }
        await this.db.executeRaw(`DELETE FROM remote_screenshots WHERE id = $1`, [row.id]);
        deleted += 1;
      }
      return deleted;
    } catch (error: any) {
      await logError('Erro ao podar screenshots por totem', error);
      return 0;
    }
  }

  /**
   * Limpa comandos antigos (mais de 30 dias)
   */
  async cleanupOldCommands(): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        DELETE FROM remote_commands
        WHERE created_at < NOW() - INTERVAL '30 days'
          AND status IN ('completed', 'failed', 'timeout')
      `);

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        await logInfo('Comandos antigos limpos', { deletedCount });
      }

      return deletedCount;
    } catch (error: any) {
      await logError('Erro ao limpar comandos antigos', error);
      return 0;
    }
  }

  /**
   * Mapeia resultado do banco para RemoteCommand
   */
  private mapToRemoteCommand(row: any): RemoteCommand {
    const params = row.parameters ?? row.command_data;
    return {
      id: row.command_id ?? row.id,
      totemId: row.totem_id,
      commandType: row.command_type,
      commandData: params ? (typeof params === 'string' ? JSON.parse(params) : params) : undefined,
      status: row.status === 'executing' ? 'executing' : (row.status === 'sent' ? 'sent' : row.status),
      result: row.response ?? row.result,
      errorMessage: row.error_message,
      sentAt: row.sent_at ? new Date(row.sent_at) : (row.executed_at ? new Date(row.executed_at) : undefined),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdBy: row.user_id ?? row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at)
    };
  }
}

// Singleton instance
let remoteCommandServiceInstance: RemoteCommandService | null = null;

export function getRemoteCommandService(): RemoteCommandService {
  if (!remoteCommandServiceInstance) {
    remoteCommandServiceInstance = new RemoteCommandService();
  }
  return remoteCommandServiceInstance;
}


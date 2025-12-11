/**
 * Backup Service - Smart Signage Pro v3.1
 * Serviço para gerenciar backups automáticos do sistema
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logInfo, logError, logWarn } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';

const execAsync = promisify(exec);

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  backupDatabase: boolean;
  backupUploads: boolean;
  backupLogs: boolean;
  backupConfig: boolean;
  compressBackups: boolean;
  storagePath: string;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  filePath: string;
  size: number;
  duration: number;
  timestamp: Date;
  error?: string;
}

export interface BackupInfo {
  id: string;
  type: 'full' | 'database' | 'uploads' | 'config';
  filePath: string;
  size: number;
  createdAt: Date;
  status: 'completed' | 'failed' | 'in_progress';
}

export class BackupService {
  private defaultConfig: BackupConfig = {
    enabled: true,
    schedule: '0 2 * * *', // Diário às 2h
    retentionDays: 30,
    backupDatabase: true,
    backupUploads: true,
    backupLogs: false,
    backupConfig: true,
    compressBackups: true,
    storagePath: '/opt/smart-signage/backups'
  };

  private get db() {
    return getDatabase();
  }

  /**
   * Criar backup completo do sistema
   */
  async createFullBackup(): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}`;
    const startTime = Date.now();

    try {
      await logInfo('Iniciando backup completo', { backupId });

      // Garantir que diretório de backup existe
      await this.ensureBackupDirectory();

      const backups: string[] = [];

      // Backup do banco de dados
      if (this.defaultConfig.backupDatabase) {
        const dbBackup = await this.backupDatabase(backupId);
        if (dbBackup) backups.push(dbBackup);
      }

      // Backup de uploads
      if (this.defaultConfig.backupUploads) {
        const uploadsBackup = await this.backupUploads(backupId);
        if (uploadsBackup) backups.push(uploadsBackup);
      }

      // Backup de configuração
      if (this.defaultConfig.backupConfig) {
        const configBackup = await this.backupConfig(backupId);
        if (configBackup) backups.push(configBackup);
      }

      // Comprimir tudo em um único arquivo
      let finalPath: string;
      let finalSize: number;

      if (this.defaultConfig.compressBackups && backups.length > 0) {
        const compressed = await this.compressBackups(backupId, backups);
        finalPath = compressed.path;
        finalSize = compressed.size;
      } else {
        // Se não comprimir, retornar primeiro backup
        finalPath = backups[0] || '';
        const stats = await fs.stat(finalPath);
        finalSize = stats.size;
      }

      const duration = Date.now() - startTime;

      await logInfo('Backup completo criado com sucesso', {
        backupId,
        duration,
        size: finalSize
      });

      // Registrar backup no banco
      await this.registerBackup({
        id: backupId,
        type: 'full',
        filePath: finalPath,
        size: finalSize,
        createdAt: new Date(),
        status: 'completed'
      });

      // Limpar backups antigos
      await this.cleanupOldBackups();

      return {
        success: true,
        backupId,
        filePath: finalPath,
        size: finalSize,
        duration,
        timestamp: new Date()
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      await logError('Erro ao criar backup completo', error as Error, { backupId });

      await this.registerBackup({
        id: backupId,
        type: 'full',
        filePath: '',
        size: 0,
        createdAt: new Date(),
        status: 'failed'
      });

      return {
        success: false,
        backupId,
        filePath: '',
        size: 0,
        duration,
        timestamp: new Date(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Backup do banco de dados PostgreSQL
   */
  private async backupDatabase(backupId: string): Promise<string | null> {
    try {
      const dbConfig = process.env.DATABASE_URL || '';
      const dbName = this.extractDatabaseName(dbConfig);
      const backupPath = path.join(
        this.defaultConfig.storagePath,
        `${backupId}-database.sql`
      );

      // Usar pg_dump para fazer backup
      const pgDumpCmd = `pg_dump "${dbConfig}" > "${backupPath}"`;
      await execAsync(pgDumpCmd);

      await logInfo('Backup do banco de dados criado', { backupId, backupPath });
      return backupPath;
    } catch (error: unknown) {
      await logError('Erro ao fazer backup do banco', error as Error, { backupId });
      return null;
    }
  }

  /**
   * Backup de arquivos de upload
   */
  private async backupUploads(backupId: string): Promise<string | null> {
    try {
      const uploadsPath = process.env.UPLOAD_PATH || '/opt/smart-signage/uploads';
      const backupPath = path.join(
        this.defaultConfig.storagePath,
        `${backupId}-uploads.tar.gz`
      );

      // Criar tar.gz dos uploads
      const tarCmd = `tar -czf "${backupPath}" -C "${uploadsPath}" .`;
      await execAsync(tarCmd);

      await logInfo('Backup de uploads criado', { backupId, backupPath });
      return backupPath;
    } catch (error: unknown) {
      await logWarn('Erro ao fazer backup de uploads', { error: (error as Error).message, backupId });
      return null;
    }
  }

  /**
   * Backup de arquivos de configuração
   */
  private async backupConfig(backupId: string): Promise<string | null> {
    try {
      const configFiles = ['.env', 'docker-compose.yml'];
      const backupPath = path.join(
        this.defaultConfig.storagePath,
        `${backupId}-config.tar.gz`
      );

      const filesToBackup = configFiles.filter(file => {
        try {
          return fs.access(file).then(() => true).catch(() => false);
        } catch {
          return false;
        }
      });

      if (filesToBackup.length === 0) {
        return null;
      }

      const tarCmd = `tar -czf "${backupPath}" ${filesToBackup.join(' ')}`;
      await execAsync(tarCmd);

      await logInfo('Backup de configuração criado', { backupId, backupPath });
      return backupPath;
    } catch (error: unknown) {
      await logWarn('Erro ao fazer backup de configuração', { error: (error as Error).message, backupId });
      return null;
    }
  }

  /**
   * Comprimir múltiplos backups em um único arquivo
   */
  private async compressBackups(backupId: string, backupFiles: string[]): Promise<{ path: string; size: number }> {
    const finalPath = path.join(
      this.defaultConfig.storagePath,
      `${backupId}-full.tar.gz`
    );

    const tarCmd = `tar -czf "${finalPath}" ${backupFiles.join(' ')}`;
    await execAsync(tarCmd);

    // Remover arquivos individuais após comprimir
    for (const file of backupFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignorar erros ao deletar
      }
    }

    const stats = await fs.stat(finalPath);
    return { path: finalPath, size: stats.size };
  }

  /**
   * Listar backups disponíveis
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const result = await this.db.findMany(`
        SELECT 
          backup_id as id,
          backup_type as type,
          file_path as "filePath",
          file_size as size,
          created_at as "createdAt",
          status
        FROM backups
        ORDER BY created_at DESC
        LIMIT 100
      `);

      return result.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as 'full' | 'database' | 'uploads' | 'config',
        filePath: row.filePath as string,
        size: row.size as number,
        createdAt: row.createdAt as Date,
        status: row.status as 'completed' | 'failed' | 'in_progress'
      }));
    } catch (error: unknown) {
      await logError('Erro ao listar backups', error as Error, {});
      return [];
    }
  }

  /**
   * Restaurar backup
   */
  async restoreBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    try {
      const backup = await this.db.findFirst(`
        SELECT * FROM backups WHERE backup_id = $1
      `, [backupId]);

      if (!backup) {
        return { success: false, message: 'Backup não encontrado' };
      }

      if (backup.status !== 'completed') {
        return { success: false, message: 'Backup não está completo' };
      }

      // Implementar lógica de restauração
      await logInfo('Restauração de backup iniciada', { backupId });

      // TODO: Implementar restauração completa
      return { success: true, message: 'Restauração iniciada (implementação pendente)' };
    } catch (error: unknown) {
      await logError('Erro ao restaurar backup', error as Error, { backupId });
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Limpar backups antigos
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.defaultConfig.retentionDays);

      const oldBackups = await this.db.findMany(`
        SELECT backup_id, file_path FROM backups
        WHERE created_at < $1 AND status = 'completed'
      `, [cutoffDate]);

      for (const backup of oldBackups) {
        try {
          // Deletar arquivo
          await fs.unlink(backup.file_path as string);
          
          // Remover registro do banco
          await this.db.executeRaw(`
            DELETE FROM backups WHERE backup_id = $1
          `, [backup.backup_id]);
        } catch (error: unknown) {
          await logWarn('Erro ao deletar backup antigo', {
            backupId: backup.backup_id,
            error: (error as Error).message
          });
        }
      }

      await logInfo('Limpeza de backups antigos concluída', {
        deleted: oldBackups.length
      });
    } catch (error: unknown) {
      await logError('Erro ao limpar backups antigos', error as Error, {});
    }
  }

  /**
   * Garantir que diretório de backup existe
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.defaultConfig.storagePath, { recursive: true });
    } catch (error: unknown) {
      await logError('Erro ao criar diretório de backup', error as Error, {
        path: this.defaultConfig.storagePath
      });
      throw error;
    }
  }

  /**
   * Registrar backup no banco
   */
  private async registerBackup(backup: BackupInfo): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO backups (backup_id, backup_type, file_path, file_size, created_at, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (backup_id) DO UPDATE SET
          status = EXCLUDED.status,
          file_path = EXCLUDED.file_path,
          file_size = EXCLUDED.file_size
      `, [
        backup.id,
        backup.type,
        backup.filePath,
        backup.size,
        backup.createdAt,
        backup.status
      ]);
    } catch (error: unknown) {
      await logError('Erro ao registrar backup', error as Error, { backupId: backup.id });
    }
  }

  /**
   * Extrair nome do banco da URL de conexão
   */
  private extractDatabaseName(connectionString: string): string {
    const match = connectionString.match(/\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    return match ? match[5] : 'smartsignage';
  }
}

// Singleton
let backupServiceInstance: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}


/**
 * Log Rotation Service - Smart Signage v2.1
 * Serviço de rotação de logs com monitoramento de espaço em disco
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { getDatabase } from '../config/database';
import { NotificationService } from './notificationService';

export interface LogRotationConfig {
  maxSize: number; // bytes
  maxDays: number;
  minFreeSpace: number; // bytes
  enabled: boolean;
  compress: boolean;
  alertsEnabled: boolean;
  logDirectory: string;
}

export interface DiskSpaceInfo {
  total: number;
  free: number;
  used: number;
  percentUsed: number;
}

export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
}

export class LogRotationService {
  private db = getDatabase();
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Obter configurações de rotação de logs do banco
   */
  async getConfig(): Promise<LogRotationConfig> {
    try {
      const settings = await this.db.findMany(`
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN (
          'log.rotation.max_size',
          'log.rotation.max_days',
          'log.rotation.min_free_space',
          'log.rotation.enabled',
          'log.rotation.compress',
          'log.alerts.enabled',
          'log.directory'
        )
      `);

      const config: { [key: string]: string } = {};
      settings.forEach((s: any) => {
        config[s.setting_key] = s.setting_value;
      });

      return {
        maxSize: this.parseSize(config['log.rotation.max_size'] || '100MB'),
        maxDays: parseInt(config['log.rotation.max_days'] || '30'),
        minFreeSpace: this.parseSize(config['log.rotation.min_free_space'] || '1GB'),
        enabled: config['log.rotation.enabled'] === 'true',
        compress: config['log.rotation.compress'] === 'true',
        alertsEnabled: config['log.alerts.enabled'] === 'true',
        logDirectory: config['log.directory'] || '/opt/smart-signage/Logs'
      };
    } catch (error: any) {
      console.error('❌ Erro ao obter configurações de logs:', error.message);
      // Retornar valores padrão
      return {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxDays: 30,
        minFreeSpace: 1024 * 1024 * 1024, // 1GB
        enabled: true,
        compress: true,
        alertsEnabled: true,
        logDirectory: '/opt/smart-signage/Logs'
      };
    }
  }

  /**
   * Converter tamanho de string para bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 100 * 1024 * 1024; // 100MB padrão

    const size = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    return Math.floor(size * (multipliers[unit] || 1));
  }

  /**
   * Obter informações de espaço em disco (aproximação)
   * Em produção, usar biblioteca como 'diskusage' para valores precisos
   */
  async getDiskSpace(logDir: string): Promise<DiskSpaceInfo> {
    try {
      // Calcular tamanho total dos arquivos de log
      let totalSize = 0;
      const files = fs.readdirSync(logDir);
      for (const file of files) {
        try {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch {
          // Ignorar erros
        }
      }

      // Aproximação: assumir 10GB disponível (será melhorado com biblioteca diskusage)
      const totalSpace = 10 * 1024 * 1024 * 1024; // 10GB
      const freeSpace = Math.max(0, totalSpace - totalSize);
      const usedSpace = totalSize;

      return {
        total: totalSpace,
        free: freeSpace,
        used: usedSpace,
        percentUsed: (usedSpace / totalSpace) * 100
      };
    } catch (error: any) {
      console.error('❌ Erro ao obter espaço em disco:', error.message);
      return {
        total: 0,
        free: 0,
        used: 0,
        percentUsed: 0
      };
    }
  }

  /**
   * Listar arquivos de log
   */
  async listLogFiles(logDir: string): Promise<LogFileInfo[]> {
    try {
      if (!fs.existsSync(logDir)) {
        return [];
      }

      const files = fs.readdirSync(logDir);
      const logFiles: LogFileInfo[] = [];

      for (const file of files) {
        try {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isFile() && file.endsWith('.log')) {
            logFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            });
          }
        } catch {
          // Ignorar erros
        }
      }

      return logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (error: any) {
      console.error('❌ Erro ao listar arquivos de log:', error.message);
      return [];
    }
  }

  /**
   * Verificar se precisa rotacionar logs
   */
  async checkRotation(): Promise<{
    needsRotation: boolean;
    reason: string;
    details: any;
  }> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        return {
          needsRotation: false,
          reason: 'disabled',
          details: { message: 'Rotação de logs está desabilitada' }
        };
      }

      // Verificar espaço livre em disco
      const diskSpace = await this.getDiskSpace(config.logDirectory);
      if (diskSpace.free < config.minFreeSpace) {
        if (config.alertsEnabled) {
          await this.sendAlert('low_disk_space', {
            freeSpace: this.formatSize(diskSpace.free),
            minFreeSpace: this.formatSize(config.minFreeSpace),
            percentUsed: diskSpace.percentUsed.toFixed(2)
          });
        }
        return {
          needsRotation: true,
          reason: 'low_disk_space',
          details: {
            freeSpace: diskSpace.free,
            minFreeSpace: config.minFreeSpace,
            percentUsed: diskSpace.percentUsed
          }
        };
      }

      // Verificar tamanho dos arquivos de log
      const logFiles = await this.listLogFiles(config.logDirectory);
      for (const file of logFiles) {
        if (file.size >= config.maxSize) {
          if (config.alertsEnabled) {
            await this.sendAlert('max_size_reached', {
              file: file.name,
              size: this.formatSize(file.size),
              maxSize: this.formatSize(config.maxSize)
            });
          }
          return {
            needsRotation: true,
            reason: 'max_size_reached',
            details: {
              file: file.name,
              size: file.size,
              maxSize: config.maxSize
            }
          };
        }
      }

      // Verificar idade dos arquivos
      const now = Date.now();
      const maxAge = config.maxDays * 24 * 60 * 60 * 1000; // dias em ms
      
      for (const file of logFiles) {
        const age = now - file.modified.getTime();
        if (age > maxAge) {
          if (config.alertsEnabled) {
            await this.sendAlert('max_age_reached', {
              file: file.name,
              age: Math.floor(age / (24 * 60 * 60 * 1000)),
              maxDays: config.maxDays
            });
          }
          return {
            needsRotation: true,
            reason: 'max_age_reached',
            details: {
              file: file.name,
              age: age,
              maxDays: config.maxDays
            }
          };
        }
      }

      return {
        needsRotation: false,
        reason: 'none',
        details: { message: 'Não é necessário rotacionar logs' }
      };
    } catch (error: any) {
      console.error('❌ Erro ao verificar rotação de logs:', error.message);
      return {
        needsRotation: false,
        reason: 'error',
        details: { error: error.message }
      };
    }
  }

  /**
   * Rotacionar logs manualmente
   */
  async rotateLogs(): Promise<{
    success: boolean;
    filesRotated: number;
    filesDeleted: number;
    details: any;
  }> {
    try {
      const config = await this.getConfig();
      const logFiles = await this.listLogFiles(config.logDirectory);
      
      let filesRotated = 0;
      let filesDeleted = 0;
      const now = Date.now();
      const maxAge = config.maxDays * 24 * 60 * 60 * 1000;

      // Rotacionar arquivos grandes
      for (const file of logFiles) {
        if (file.size >= config.maxSize) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const newPath = path.join(config.logDirectory, `${file.name}.${timestamp}.rotated`);
            fs.renameSync(file.path, newPath);

            if (config.compress) {
              try {
                const gzPath = `${newPath}.gz`;
                const fileData = fs.readFileSync(newPath);
                const compressed = zlib.gzipSync(fileData);
                fs.writeFileSync(gzPath, compressed);
                fs.unlinkSync(newPath);
              } catch (zipError: any) {
                console.error(`❌ Erro ao comprimir arquivo ${file.name}:`, zipError.message);
              }
            }

            filesRotated++;
          } catch (error: any) {
            console.error(`❌ Erro ao rotacionar arquivo ${file.name}:`, error.message);
          }
        }
      }

      // Excluir arquivos antigos
      for (const file of logFiles) {
        const age = now - file.modified.getTime();
        if (age > maxAge) {
          try {
            fs.unlinkSync(file.path);
            filesDeleted++;
          } catch (error: any) {
            console.error(`❌ Erro ao excluir arquivo ${file.name}:`, error.message);
          }
        }
      }

      if (config.alertsEnabled && (filesRotated > 0 || filesDeleted > 0)) {
        await this.sendAlert('rotation_completed', {
          filesRotated,
          filesDeleted,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        filesRotated,
        filesDeleted,
        details: {
          logDirectory: config.logDirectory,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('❌ Erro ao rotacionar logs:', error.message);
      return {
        success: false,
        filesRotated: 0,
        filesDeleted: 0,
        details: { error: error.message }
      };
    }
  }

  /**
   * Enviar alerta administrativo
   */
  private async sendAlert(type: string, details: any): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config.alertsEnabled) {
        return;
      }

      // Buscar administradores
      const admins = await this.db.findMany(`
        SELECT id, username, email
        FROM users
        WHERE role = 'admin' AND is_active = true
      `);

      let title = '';
      let message = '';

      switch (type) {
        case 'low_disk_space':
          title = 'Alerta: Espaço em Disco Baixo';
          message = `O espaço livre em disco onde os logs são armazenados está abaixo do mínimo configurado.\n\n` +
            `Espaço livre: ${details.freeSpace}\n` +
            `Mínimo configurado: ${details.minFreeSpace}\n` +
            `Uso do disco: ${details.percentUsed}%\n\n` +
            `Os logs serão rotacionados automaticamente.`;
          break;
        case 'max_size_reached':
          title = 'Alerta: Tamanho Máximo de Log Atingido';
          message = `O arquivo de log "${details.file}" atingiu o tamanho máximo configurado.\n\n` +
            `Tamanho atual: ${details.size}\n` +
            `Tamanho máximo: ${details.maxSize}\n\n` +
            `O arquivo será rotacionado automaticamente.`;
          break;
        case 'max_age_reached':
          title = 'Alerta: Log Antigo Detectado';
          message = `O arquivo de log "${details.file}" excedeu o tempo máximo de retenção.\n\n` +
            `Idade: ${details.age} dias\n` +
            `Máximo configurado: ${details.maxDays} dias\n\n` +
            `O arquivo será excluído automaticamente.`;
          break;
        case 'rotation_completed':
          title = 'Rotação de Logs Concluída';
          message = `A rotação de logs foi executada com sucesso.\n\n` +
            `Arquivos rotacionados: ${details.filesRotated}\n` +
            `Arquivos excluídos: ${details.filesDeleted}\n\n` +
            `Data: ${details.timestamp}`;
          break;
      }

      // Criar notificação para cada admin
      for (const admin of admins) {
        await this.notificationService.createNotification({
          type: type.startsWith('low_') || type.startsWith('max_') ? 'warning' : 'info',
          title: title,
          message: message,
          userId: admin.id,
          priority: type === 'low_disk_space' ? 'high' : 'medium',
          metadata: {
            alertType: type,
            details: details,
            timestamp: new Date().toISOString()
          }
        }, 1).catch((error: any) => {
          console.error(`❌ Erro ao criar notificação para admin ${admin.id}:`, error.message);
        });
      }

      // Log no banco de auditoria
      const { AuditService } = await import('./auditService');
      const auditService = new AuditService();
      await auditService.log('system', 'log_rotation_alert', 1, {
        type: type,
        details: details
      }).catch(() => {});
    } catch (error: any) {
      console.error('❌ Erro ao enviar alerta de rotação:', error.message);
    }
  }

  /**
   * Formatar tamanho em bytes para string legível
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}


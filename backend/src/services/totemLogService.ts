/**
 * Totem Log Service - Smart Signage v2.1
 * Serviço para gerenciar logs de totens
 */

import { getDatabase } from '../config/database';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';
import fs from 'fs';
import path from 'path';
import { normalizeError } from '../utils/errors';

// import { config } from '../config/env'; // TODO: usar quando necessário

export interface TotemLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, unknown>;
}

export interface TotemLogFilter {
  totemId: number;
  level?: 'info' | 'warn' | 'error' | 'debug';
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export class TotemLogService {
  private get db() {
    return getDatabase();
  }

  /**
   * Obtém logs de um totem do sistema de arquivos
   */
  async getTotemLogs(filter: TotemLogFilter): Promise<TotemLogEntry[]> {
    try {
      const { totemId, level, startDate, endDate, search, limit = 1000 } = filter;

      // Buscar totem para obter identifier
      const totem = await this.db.findFirst(`
        SELECT identifier, name
        FROM totems
        WHERE totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      // Caminho do arquivo de log do totem
      const logDir = path.join(process.cwd(), 'logs', 'totems');
      const logFile = path.join(logDir, `${totem.identifier}.log`);

      if (!fs.existsSync(logFile)) {
        await logDebug('Arquivo de log não encontrado', { totemId, logFile });
        return [];
      }

      // Ler arquivo de log
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());

      // Parsear logs
      const logs: TotemLogEntry[] = [];
      for (const line of lines) {
        try {
          const logEntry = this.parseLogLine(line);
          if (!logEntry) continue;

          // Aplicar filtros
          if (level && logEntry.level !== level) continue;
          if (startDate && logEntry.timestamp < startDate) continue;
          if (endDate && logEntry.timestamp > endDate) continue;
          if (search && !logEntry.message.toLowerCase().includes(search.toLowerCase())) continue;

          logs.push(logEntry);
} catch (error: unknown) {
          // Ignorar linhas inválidas
          continue;
        }
      }

      // Ordenar por timestamp (mais recente primeiro) e limitar
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return logs.slice(0, limit);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter logs do totem', e.error, { totemId: filter.totemId });
      throw e.error;
    }
  }

  /**
   * Parseia uma linha de log
   */
  private parseLogLine(line: string): TotemLogEntry | null {
    try {
      // Formato esperado: [TIMESTAMP] [LEVEL] MESSAGE [METADATA]
      const match = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.+?)(?:\s+\[(.+)\])?$/);
      if (!match) {
        // Tentar formato JSON
        const jsonMatch = line.match(/^(.+?)\s+(.+)$/);
        if (jsonMatch) {
          const timestamp = jsonMatch[1];
          const jsonPart = jsonMatch[2];
          try {
            const parsed = JSON.parse(jsonPart);
            return {
              timestamp,
              level: parsed.level || 'info',
              message: parsed.message || jsonPart,
              metadata: parsed.metadata
            };
          } catch {
            return null;
          }
        }
        return null;
      }

      const [, timestamp, level, message, metadataStr] = match;
      let metadata = null;

      if (metadataStr) {
        try {
          metadata = JSON.parse(metadataStr);
        } catch {
          metadata = { raw: metadataStr };
        }
      }

      return {
        timestamp,
        level: level.toLowerCase() as 'info' | 'warn' | 'error' | 'debug',
        message: message.trim(),
        metadata
      };
    } catch {
      return null;
    }
  }

  /**
   * Obtém logs em tempo real (últimas N linhas)
   */
  async getRecentLogs(totemId: number, lines: number = 100): Promise<TotemLogEntry[]> {
    return this.getTotemLogs({
      totemId,
      limit: lines
    });
  }

  /**
   * Faz download de logs como arquivo
   */
  async downloadLogs(filter: TotemLogFilter): Promise<{ filePath: string; fileName: string }> {
    try {
      const logs = await this.getTotemLogs({ ...filter, limit: 10000 });

      // Criar arquivo temporário
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `totem_${filter.totemId}_logs_${Date.now()}.txt`;
      const filePath = path.join(tempDir, fileName);

      // Formatar logs para arquivo de texto
      const logContent = logs.map(log => {
        const metadataStr = log.metadata ? ` [${JSON.stringify(log.metadata)}]` : '';
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${metadataStr}`;
      }).join('\n');

      fs.writeFileSync(filePath, logContent);

      return {
        filePath, fileName };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao fazer download de logs', e.error, { totemId: filter.totemId });
      throw e.error;
    }
  }

  /**
   * Limpa logs antigos de um totem
   */
  async cleanupOldLogs(totemId: number, daysToKeep: number = 30): Promise<number> {
    try {
      const totem = await this.db.findFirst(`
        SELECT identifier
        FROM totems
        WHERE totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      const logDir = path.join(process.cwd(), 'logs', 'totems');
      const logFile = path.join(logDir, `${totem.identifier}.log`);

      if (!fs.existsSync(logFile)) {
        return 0;
      }

      // Ler logs
      const logs = await this.getTotemLogs({ totemId, limit: 100000 });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Filtrar logs recentes
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      });

      // Reescrever arquivo apenas com logs recentes
      const logContent = recentLogs.map(log => {
        const metadataStr = log.metadata ? ` [${JSON.stringify(log.metadata)}]` : '';
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${metadataStr}`;
      }).join('\n');

      fs.writeFileSync(logFile, logContent);

      const deletedCount = logs.length - recentLogs.length;
      await logInfo('Logs antigos limpos', { totemId, deletedCount, daysToKeep });

      return deletedCount;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao limpar logs antigos', e.error, { totemId });
      return 0;
    }
  }
}

// Singleton instance
let totemLogServiceInstance: TotemLogService | null = null;

export function getTotemLogService(): TotemLogService {
  if (!totemLogServiceInstance) {
    totemLogServiceInstance = new TotemLogService();
  }
  return totemLogServiceInstance;
}


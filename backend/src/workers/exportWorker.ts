/**
 * Export Worker - Smart Signage v2.1
 * Worker para processar jobs de exportação usando Bull
 */

import { Job } from 'bull';
import { getExportQueue, ExportJobData, ExportJobResult } from '../config/queue';
import { exportQueryService } from '../services/exportQueryService';
import { exportScheduleService } from '../services/exportScheduleService';
import { getDatabase } from '../config/database';
import * as fs from 'fs';
import { exportToExcel, exportToPDF, exportToCSV } from './exportFormats';
import { getRedisClient } from '../config/redis';
import { executeGrafanaQuery } from '../config/grafana';
import { executePrometheusQuery, executePrometheusInstantQuery } from '../config/prometheus';
import { logInfo, logError, logWarn, logInfoSync } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const getDb = () => getDatabase();

/**
 * Processa job de exportação
 */
export async function processExportJob(job: Job<ExportJobData>): Promise<ExportJobResult> {
  const db = getDb();
  const { scheduleId, queryId, userId } = job.data;
  const startTime = new Date();
  let executionId: number | null = null;

  try {
    await logInfo('Processando exportação', {
      scheduleId,
      queryId,
      userId,
      jobId: job.id
    });

    // Criar registro de execução
    const executionResult = await db.executeRaw(`
      INSERT INTO export_executions (
        schedule_id, query_id, job_id, status, started_at
      )
      VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)
      RETURNING execution_id
    `, [scheduleId, queryId, job.id]);

    executionId = executionResult.rows[0].execution_id;

    // Buscar query
    const query = await exportQueryService.getQueryById(queryId);
    if (!query) {
      throw new Error(`Query com ID ${queryId} não encontrada`);
    }

    // Executar query SQL
    const dbCfg = (typeof query.database_config === 'string'
      ? JSON.parse(query.database_config)
      : query.database_config) as Record<string, unknown>;
    const data = await executeQuery(query.sql_query, dbCfg, String(query.provider));

    if (data.length === 0) {
      await logWarn('Nenhum dado encontrado para exportação', {
        scheduleId,
        queryId,
        executionId
      });
      
      // Atualizar execução
      await db.executeRaw(`
        UPDATE export_executions 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, 
            records_exported = 0, execution_log = ?
        WHERE execution_id = ?
      `, ['Nenhum dado encontrado', executionId]);

      return {
        success: true,
        recordsExported: 0,
        executionLog: 'Nenhum dado encontrado'
      };
    }

    // Exportar para formato configurado
    const exportConfig = typeof query.export_config === 'string' 
      ? JSON.parse(query.export_config) 
      : query.export_config;
    
    const format = exportConfig.format || 'xlsx';
    let filePath: string;
    
    switch (format) {
      case 'xlsx':
        filePath = await exportToExcel(
          data,
          exportConfig,
          query.name,
          exportConfig.sheetName || 'Data'
        );
        break;
      case 'pdf':
        filePath = await exportToPDF(
          data,
          exportConfig,
          query.name
        );
        break;
      case 'csv':
        filePath = await exportToCSV(
          data,
          exportConfig,
          query.name
        );
        break;
      default:
        throw new Error(`Formato de exportação não suportado: ${format}`);
    }

    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    const duration = (new Date().getTime() - startTime.getTime()) / 1000;

    // Atualizar execução
    await db.executeRaw(`
      UPDATE export_executions 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
          records_exported = ?, file_path = ?, file_size = ?,
          execution_log = ?
      WHERE execution_id = ?
    `, [
      data.length,
      filePath,
      fileSize,
      `Exportação concluída: ${data.length} registros em ${duration.toFixed(2)}s`,
      executionId
    ]);

    // Atualizar estatísticas do agendamento
    if (scheduleId) {
      const schedule = await exportScheduleService.getScheduleById(scheduleId);
      if (schedule) {
        await db.executeRaw(`
          UPDATE export_schedules 
          SET last_execution = CURRENT_TIMESTAMP,
              next_execution = ?,
              execution_count = execution_count + 1,
              success_count = success_count + 1
          WHERE schedule_id = ?
        `, [
          exportScheduleService.calculateNextExecution(schedule.cron_expression),
          scheduleId
        ]);
      }
    }

    await logInfo('Exportação concluída', {
      scheduleId,
      queryId,
      executionId,
      recordsExported: data.length,
      filePath,
      fileSize,
      duration: `${duration.toFixed(2)}s`
    });

    return {
      success: true,
      recordsExported: data.length,
      filePath,
      fileSize,
      executionLog: `Exportação concluída: ${data.length} registros em ${duration.toFixed(2)}s`
    };} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao processar exportação', e.error, {
      scheduleId,
      queryId,
      executionId,
      jobId: job.id
  });

    // Atualizar execução com erro
    if (executionId) {
      await db.executeRaw(`
        UPDATE export_executions 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
            error_message = ?, execution_log = ?
        WHERE execution_id = ?
      `, [
        e.message,
        `Erro: ${e.message}`,
        executionId
      ]);
    }

    // Atualizar estatísticas do agendamento
    if (scheduleId) {
      const schedule = await exportScheduleService.getScheduleById(scheduleId);
      if (schedule) {
        await db.executeRaw(`
          UPDATE export_schedules 
          SET last_execution = CURRENT_TIMESTAMP,
              next_execution = ?,
              execution_count = execution_count + 1,
              failure_count = failure_count + 1
          WHERE schedule_id = ?
        `, [
          exportScheduleService.calculateNextExecution(schedule.cron_expression),
          scheduleId
        ]);
      }
    }

    return {
      success: false,
      recordsExported: 0,
      error: e.message,
      executionLog: `Erro: ${e.message}`
    };
  }
}

/**
 * Executa query SQL no banco de dados
 */
async function executeQuery(
  sql: string,
  databaseConfig: Record<string, unknown>,
  provider: string
): Promise<Record<string, unknown>[]> {
  try {
    switch (provider) {
      case 'PostgreSQL':
        // Usar banco principal se for PostgreSQL
        const db = getDb();
        const result = await db.findMany(sql, []);
        return result;

      case 'Redis':
        // Executar comandos Redis
        return await executeRedisQuery(sql, databaseConfig);

      case 'Grafana':
        // Executar query no Grafana (PromQL ou SQL)
        return await executeGrafanaQuery(sql, databaseConfig.datasourceId as string | undefined);

      case 'Prometheus':
        // Executar query PromQL no Prometheus
        return await executePrometheusQueryWrapper(sql, databaseConfig);

      default:
        throw new Error(`Provider não suportado: ${provider}`);
 
}} catch (error: unknown) {
    const e = normalizeError(error);
    throw new Error(`Erro ao executar query: ${e.message}`);
  }
}

/**
 * Executa query Redis
 */
async function executeRedisQuery(query: string, _databaseConfig: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  try {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error('Redis não está disponível (CACHE_ENABLED=false)');
    }
    const results: Record<string, unknown>[] = [];

    const parts = query.trim().split(/\s+/);
    const command = parts[0].toUpperCase();
    const args = parts.slice(1);

    switch (command) {
      case 'KEYS':
        const pattern = args[0] || '*';
        const keys = await redis.keys(pattern);

        for (const key of keys) {
          const type = await redis.type(key);
          let value: unknown = null;

          switch (type) {
            case 'string':
              value = await redis.get(key);
              break;
            case 'hash':
              value = await redis.hgetall(key);
              break;
            case 'list':
              value = await redis.lrange(key, 0, -1);
              break;
            case 'set':
              value = await redis.smembers(key);
              break;
            case 'zset':
              value = await redis.zrange(key, 0, -1, 'WITHSCORES');
              break;
          }

          results.push({
            key,
            type,
            value: value,
            ttl: await redis.ttl(key)
          });
        }
        break;

      case 'GET':
        // GET key -> retorna valor da chave
        const key = args[0];
        if (!key) {
          throw new Error('GET requer uma chave');
        }
        const getValue = await redis.get(key);
        results.push({
          key,
          type: 'string',
          value: getValue,
          ttl: await redis.ttl(key)
        });
        break;

      case 'HGETALL':
        // HGETALL key -> retorna todos os campos de um hash
        const hashKey = args[0];
        if (!hashKey) {
          throw new Error('HGETALL requer uma chave');
        }
        const hashValue = await redis.hgetall(hashKey);
        results.push({
          key: hashKey,
          type: 'hash',
          value: hashValue,
          ttl: await redis.ttl(hashKey)
        });
        break;

      case 'SMEMBERS':
        // SMEMBERS key -> retorna todos os membros de um set
        const setKey = args[0];
        if (!setKey) {
          throw new Error('SMEMBERS requer uma chave');
        }
        const setValue = await redis.smembers(setKey);
        results.push({
          key: setKey,
          type: 'set',
          value: setValue,
          ttl: await redis.ttl(setKey)
        });
        break;

      case 'LRANGE':
        // LRANGE key start stop -> retorna elementos de uma lista
        const listKey = args[0];
        const start = parseInt(args[1] || '0');
        const stop = parseInt(args[2] || '-1');
        if (!listKey) {
          throw new Error('LRANGE requer uma chave');
        }
        const listValue = await redis.lrange(listKey, start, stop);
        results.push({
          key: listKey,
          type: 'list',
          value: listValue,
          ttl: await redis.ttl(listKey)
        });
        break;

      case 'ZRANGE':
        // ZRANGE key start stop [WITHSCORES] -> retorna elementos de um sorted set
        const zsetKey = args[0];
        const zstart = parseInt(args[1] || '0');
        const zstop = parseInt(args[2] || '-1');
        const withScores = args.includes('WITHSCORES');
        if (!zsetKey) {
          throw new Error('ZRANGE requer uma chave');
        }
        const zsetValue = withScores 
          ? await redis.zrange(zsetKey, zstart, zstop, 'WITHSCORES')
          : await redis.zrange(zsetKey, zstart, zstop);
        results.push({
          key: zsetKey,
          type: 'zset',
          value: zsetValue,
          ttl: await redis.ttl(zsetKey)
        });
        break;

      case 'INFO':
        const section = args[0] || 'all';
        const info = await redis.info(section);
        const infoLines = info.split('\r\n');
        const infoObj: Record<string, string> = {};
        let currentSection = '';

        for (const line of infoLines) {
          if (line.startsWith('#')) {
            currentSection = line.substring(1).trim();
            continue;
          }
          if (line.includes(':')) {
            const colonPos = line.indexOf(':');
            const key = line.substring(0, colonPos).trim();
            const value = line.substring(colonPos + 1).trim();
            infoObj[`${currentSection}_${key}`] = value;
          }
        }

        results.push({
          key: 'info',
          type: 'info',
          value: infoObj
        });
        break;

      default:
        throw new Error(`Comando Redis não suportado: ${command}. Comandos suportados: KEYS, GET, HGETALL, SMEMBERS, LRANGE, ZRANGE, INFO`);
    }

    return results;} catch (error: unknown) {
    const e = normalizeError(error);
    throw new Error(`Erro ao executar query Redis: ${e.message}`);
  }
}

/**
 * Executa query Prometheus (wrapper para range ou instant)
 */
async function executePrometheusQueryWrapper(query: string, databaseConfig: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  try {
    // Determinar se é query range ou instant baseado na query
    // Se a query contém funções de range (rate, increase, etc.), usar range query
    // Caso contrário, usar instant query
    
    const isRangeQuery = /rate|increase|delta|deriv|predict_linear|avg_over_time|sum_over_time|min_over_time|max_over_time|quantile_over_time|stddev_over_time|stdvar_over_time/.test(query);
    
    if (isRangeQuery || databaseConfig.useRange !== false) {
      // Range query (última hora por padrão)
      const startTime = databaseConfig.startTime !== undefined && databaseConfig.startTime !== null
        ? Math.floor(new Date(databaseConfig.startTime as string | number | Date).getTime() / 1000)
        : undefined;
      const endTime = databaseConfig.endTime !== undefined && databaseConfig.endTime !== null
        ? Math.floor(new Date(databaseConfig.endTime as string | number | Date).getTime() / 1000)
        : undefined;

      return await executePrometheusQuery(query, startTime, endTime);
    } else {
      // Instant query
      const time = databaseConfig.time !== undefined && databaseConfig.time !== null
        ? Math.floor(new Date(databaseConfig.time as string | number | Date).getTime() / 1000)
        : undefined;
      
      return await executePrometheusInstantQuery(query, time);
 
}} catch (error: unknown) {
    const e = normalizeError(error);
    throw new Error(`Erro ao executar query Prometheus: ${e.message}`);
  }
}

// Registrar worker
let exportWorkerRegistered = false;

export function resetExportWorkerRegistration(): void {
  exportWorkerRegistered = false;
}

export function registerExportWorker(): void {
  if (exportWorkerRegistered) {
    logInfoSync('Worker de exportação já registado — ignorando', {});
    return;
  }
  const queue = getExportQueue();
  
  queue.process(async (job: Job<ExportJobData>) => {
    return await processExportJob(job);
  });

  exportWorkerRegistered = true;
  logInfoSync('Worker de exportação registrado', {});
}


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
import * as path from 'path';
import { exportToExcel, exportToPDF, exportToCSV } from './exportFormats';

const db = getDatabase();

/**
 * Processa job de exportação
 */
export async function processExportJob(job: Job<ExportJobData>): Promise<ExportJobResult> {
  const { scheduleId, queryId, userId } = job.data;
  const startTime = new Date();
  let executionId: number | null = null;

  try {
    console.log(`🔄 Processando exportação: Schedule ${scheduleId}, Query ${queryId}`);

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
    const data = await executeQuery(query.sql_query, query.database_config, query.provider);

    if (data.length === 0) {
      console.log(`⚠️ Nenhum dado encontrado para exportação`);
      
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

    console.log(`✅ Exportação concluída: ${data.length} registros em ${filePath}`);

    return {
      success: true,
      recordsExported: data.length,
      filePath,
      fileSize,
      executionLog: `Exportação concluída: ${data.length} registros em ${duration.toFixed(2)}s`
    };

  } catch (error: any) {
    console.error(`❌ Erro ao processar exportação:`, error.message);

    // Atualizar execução com erro
    if (executionId) {
      await db.executeRaw(`
        UPDATE export_executions 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
            error_message = ?, execution_log = ?
        WHERE execution_id = ?
      `, [
        error.message,
        `Erro: ${error.message}`,
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
      error: error.message,
      executionLog: `Erro: ${error.message}`
    };
  }
}

/**
 * Executa query SQL no banco de dados
 */
async function executeQuery(
  sql: string,
  databaseConfig: any,
  provider: string
): Promise<any[]> {
  try {
    // Por enquanto, usar o banco principal (PostgreSQL)
    // TODO: Implementar execução específica por provider
    // Para outros providers, criar conexão específica
    
    if (provider === 'PostgreSQL') {
      // Usar banco principal se for PostgreSQL
      const result = await db.findMany(sql, []);
      return result;
    } else {
      // Para outros providers, implementar conexão específica
      // Por enquanto, retornar erro
      throw new Error(`Provider ${provider} ainda não implementado para execução de queries`);
    }
  } catch (error: any) {
    throw new Error(`Erro ao executar query: ${error.message}`);
  }
}

// Registrar worker
export function registerExportWorker(): void {
  const queue = getExportQueue();
  
  queue.process(async (job: Job<ExportJobData>) => {
    return await processExportJob(job);
  });

  console.log('✅ Worker de exportação registrado');
}


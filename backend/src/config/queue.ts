/**
 * Queue Configuration - Smart Signage v2.1
 * Configuração do Bull Queue para gerenciamento de exportações
 */

import Bull from 'bull';
import { getRedisClient } from './redis';

// Configuração do Redis para Bull
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
};

// Queue de exportação
let exportQueue: Bull.Queue | null = null;

/**
 * Inicializa queue de exportação
 */
export function initializeExportQueue(): Bull.Queue {
  if (!exportQueue) {
    exportQueue = new Bull('export-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Manter por 24 horas
          count: 1000, // Manter últimos 1000 jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Manter por 7 dias
        },
      },
    });

    exportQueue.on('error', (error) => {
      console.error('❌ Erro na queue de exportação:', error);
    });

    exportQueue.on('waiting', (jobId) => {
      console.log(`⏳ Job ${jobId} aguardando processamento`);
    });

    exportQueue.on('active', (job) => {
      console.log(`🔄 Processando job ${job.id} - Exportação ${job.data.scheduleId}`);
    });

    exportQueue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} concluído - ${result.recordsExported} registros exportados`);
    });

    exportQueue.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} falhou:`, err.message);
    });

    exportQueue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} travado`);
    });

    console.log('✅ Queue de exportação inicializada');
  }

  return exportQueue;
}

/**
 * Obtém queue de exportação
 */
export function getExportQueue(): Bull.Queue {
  if (!exportQueue) {
    return initializeExportQueue();
  }
  return exportQueue;
}

/**
 * Fecha queue de exportação
 */
export async function closeExportQueue(): Promise<void> {
  if (exportQueue) {
    await exportQueue.close();
    exportQueue = null;
    console.log('✅ Queue de exportação fechada');
  }
}

// Exportar tipos
export interface ExportJobData {
  scheduleId: number;
  queryId: number;
  queryName: string;
  cronExpression: string;
  userId?: number;
}

export interface ExportJobResult {
  success: boolean;
  recordsExported: number;
  filePath?: string;
  fileSize?: number;
  error?: string;
  executionLog?: string;
}


/**
 * Logger Configuration - Smart Signage v2.1
 * Sistema de logs configurável com Winston
 * Rotação automática baseada em tamanho e dias
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getDatabase } from './database';
import { NotificationService } from '../services/notificationService';

// Diretório de instalação (padrão: /opt/smart-signage)
const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/smart-signage';
const LOGS_DIR = path.join(INSTALL_DIR, 'Logs');

// Garantir que o diretório de logs existe
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Converter tamanho de string para bytes
 * Ex: "10MB" -> 10485760, "1GB" -> 1073741824
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 10 * 1024 * 1024; // 10MB padrão

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
 * Obter configurações de logs do banco de dados
 */
async function getLogConfig(): Promise<{
  maxSize: number;
  maxDays: number;
  minFreeSpace: number;
  level: string;
}> {
  try {
    const db = getDatabase();
    const settings = await db.findMany(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (
        'log.rotation.max_size',
        'log.rotation.max_days',
        'log.rotation.min_free_space',
        'log.level'
      )
    `);

    const config: { [key: string]: string } = {};
    settings.forEach((s: any) => {
      config[s.setting_key] = s.setting_value;
    });

    return {
      maxSize: parseSize(config['log.rotation.max_size'] || '100MB'),
      maxDays: parseInt(config['log.rotation.max_days'] || '30'),
      minFreeSpace: parseSize(config['log.rotation.min_free_space'] || '1GB'),
      level: config['log.level'] || 'info'
    };
  } catch (error) {
    // Se não conseguir ler do banco, usar valores padrão
    return {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxDays: 30,
      minFreeSpace: 1024 * 1024 * 1024, // 1GB
      level: 'info'
    };
  }
}

/**
 * Verificar espaço livre em disco (aproximação)
 * Para implementação completa, usar statfs ou biblioteca externa
 */
function getFreeSpace(dir: string): number {
  try {
    // Verificar espaço livre do diretório pai
    // Em produção, usar statfs ou biblioteca como diskusage
    const stats = fs.statSync(dir);
    
    // Calcular tamanho total dos arquivos de log
    let totalSize = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const fileStats = fs.statSync(filePath);
        if (fileStats.isFile()) {
          totalSize += fileStats.size;
        }
      } catch {
        // Ignorar erros ao ler arquivos
      }
    }
    
    // Aproximação: assumir 10GB disponível menos o usado
    // Em produção, usar biblioteca como 'diskusage' para valores precisos
    const availableSpace = 10 * 1024 * 1024 * 1024; // 10GB padrão
    return Math.max(0, availableSpace - totalSize);
  } catch {
    return 0;
  }
}

/**
 * Verificar se precisa rotacionar logs
 */
async function checkLogRotation(): Promise<boolean> {
  try {
    const config = await getLogConfig();
    const freeSpace = getFreeSpace(LOGS_DIR);

    // Verificar espaço livre
    if (freeSpace < config.minFreeSpace) {
      await sendRotationAlert('low_disk_space', {
        freeSpace: (freeSpace / (1024 * 1024 * 1024)).toFixed(2) + 'GB',
        minFreeSpace: (config.minFreeSpace / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
      });
      return true;
    }

    // Verificar tamanho dos arquivos de log
    const logFiles = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
    for (const file of logFiles) {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.size >= config.maxSize) {
        await sendRotationAlert('max_size_reached', {
          file: file,
          size: (stats.size / (1024 * 1024)).toFixed(2) + 'MB',
          maxSize: (config.maxSize / (1024 * 1024)).toFixed(2) + 'MB'
        });
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Erro ao verificar rotação de logs:', error);
    return false;
  }
}

/**
 * Enviar alerta administrativo sobre rotação de logs
 */
async function sendRotationAlert(type: string, details: any): Promise<void> {
  try {
    const notificationService = new NotificationService();
    const db = getDatabase();

    // Buscar administradores
    const admins = await db.findMany(`
      SELECT id, username, email
      FROM users
      WHERE role = 'admin' AND is_active = true
    `);

    // Criar notificação para cada admin
    for (const admin of admins) {
      let message = '';
      let title = '';

      if (type === 'low_disk_space') {
        title = 'Alerta: Espaço em Disco Baixo';
        message = `O espaço livre em disco onde os logs são armazenados está abaixo do mínimo configurado.\n\n` +
          `Espaço livre: ${details.freeSpace}\n` +
          `Mínimo configurado: ${details.minFreeSpace}\n\n` +
          `Os logs serão rotacionados automaticamente.`;
      } else if (type === 'max_size_reached') {
        title = 'Alerta: Tamanho Máximo de Log Atingido';
        message = `O arquivo de log "${details.file}" atingiu o tamanho máximo configurado.\n\n` +
          `Tamanho atual: ${details.size}\n` +
          `Tamanho máximo: ${details.maxSize}\n\n` +
          `O arquivo será rotacionado automaticamente.`;
      }

      await notificationService.createNotification({
        type: 'warning',
        title: title,
        message: message,
        userId: admin.id,
        metadata: {
          alertType: type,
          details: details,
          timestamp: new Date().toISOString()
        }
      }, 1); // Sistema (ID 1)

      // Log no banco de auditoria
      const auditService = (global as any).auditServiceInstance || 
        (await import('../services/auditService')).AuditService;
      if (auditService) {
        const audit = new auditService();
        await audit.log('system', 'log_rotation_alert', admin.id, {
          type: type,
          details: details
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('❌ Erro ao enviar alerta de rotação:', error);
  }
}

/**
 * Criar logger Winston configurável
 */
export async function createLogger(): Promise<winston.Logger> {
  const config = await getLogConfig();

  // Formato personalizado
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // Formato para console (mais legível)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  );

  // Transporte para arquivo com rotação diária
  const fileTransport = new DailyRotateFile({
    filename: path.join(LOGS_DIR, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: config.maxSize,
    maxFiles: `${config.maxDays}d`, // Manter por N dias
    format: logFormat,
    level: config.level,
    zippedArchive: true, // Compactar arquivos antigos
    auditFile: path.join(LOGS_DIR, '.audit.json'),
    createSymlink: true,
    symlinkName: 'app-current.log'
  });

  // Transporte para erros (arquivo separado)
  const errorFileTransport = new DailyRotateFile({
    filename: path.join(LOGS_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: config.maxSize,
    maxFiles: `${config.maxDays}d`,
    format: logFormat,
    level: 'error',
    zippedArchive: true,
    auditFile: path.join(LOGS_DIR, '.audit-error.json'),
    createSymlink: true,
    symlinkName: 'error-current.log'
  });

  // Evento de rotação
  fileTransport.on('rotate', async (oldFilename, newFilename) => {
    console.log(`📋 Log rotacionado: ${oldFilename} -> ${newFilename}`);
    await checkLogRotation();
  });

  errorFileTransport.on('rotate', async (oldFilename, newFilename) => {
    console.log(`📋 Log de erro rotacionado: ${oldFilename} -> ${newFilename}`);
    await checkLogRotation();
  });

  // Criar logger
  const logger = winston.createLogger({
    level: config.level,
    format: logFormat,
    defaultMeta: { service: 'smart-signage' },
    transports: [
      // Console (apenas em desenvolvimento)
      ...(process.env.NODE_ENV === 'development' ? [
        new winston.transports.Console({
          format: consoleFormat,
          level: config.level
        })
      ] : []),
      // Arquivo geral
      fileTransport,
      // Arquivo de erros
      errorFileTransport
    ],
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(LOGS_DIR, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: config.maxSize,
        maxFiles: `${config.maxDays}d`,
        format: logFormat,
        zippedArchive: true
      })
    ],
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(LOGS_DIR, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: config.maxSize,
        maxFiles: `${config.maxDays}d`,
        format: logFormat,
        zippedArchive: true
      })
    ]
  });

  // Verificar rotação periodicamente (a cada hora)
  setInterval(async () => {
    await checkLogRotation();
  }, 60 * 60 * 1000); // 1 hora

  return logger;
}

// Logger singleton
let loggerInstance: winston.Logger | null = null;

/**
 * Obter instância do logger (singleton)
 */
export async function getLogger(): Promise<winston.Logger> {
  if (!loggerInstance) {
    loggerInstance = await createLogger();
  }
  return loggerInstance;
}

/**
 * Recarregar configurações do logger
 */
export async function reloadLogger(): Promise<void> {
  if (loggerInstance) {
    loggerInstance.close();
    loggerInstance = null;
  }
  loggerInstance = await createLogger();
}


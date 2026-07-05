/**
 * Storage Service - Smart Signage v2.1
 * Serviço de gerenciamento de arquivos
 * 
 * Logging: Usa arquivos locais para logs operacionais (erro, debug, execução)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logInfoSync, logWarnSync, logErrorSync, logDebugSync } from '../utils/loggerHelper';

export interface FileInfo {
  buffer?: Buffer;
  /** Ficheiro já gravado pelo multer — evita carregar o upload inteiro em RAM. */
  diskPath?: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export class StorageService {
  private basePath: string = '';
  private uploadsPath: string = '';

  constructor() {
    // SEMPRE usar /opt/smart-signage para garantir consistência
    // Mesmo que INSTALL_DIR seja diferente, arquivos devem ser salvos em /opt/smart-signage
    const DEFAULT_BASE_PATH = '/opt/smart-signage/public/assets';
    
    // Inicializar paths
    this.initializePaths(DEFAULT_BASE_PATH);
  }

  /**
   * Inicializa os caminhos de armazenamento
   */
  private initializePaths(DEFAULT_BASE_PATH: string): void {
    try {
      const { getStoragePath } = require('../config/mediaConfig');
      const storagePath = getStoragePath();
      logDebugSync(`[StorageService] getStoragePath() retornou: ${storagePath}`);
      
      // getStoragePath retorna o caminho completo até uploads, então precisamos extrair o basePath
      // Ex: /opt/smart-signage/public/assets/uploads -> /opt/smart-signage/public/assets
      const extractedBasePath = storagePath.replace(/\/uploads\/?$/, '');
      
      // Validar se o caminho extraído é válido e aponta para /opt/smart-signage
      if (extractedBasePath && extractedBasePath.startsWith('/opt/smart-signage')) {
        this.basePath = extractedBasePath;
        this.uploadsPath = path.join(this.basePath, 'uploads');
        logInfoSync(`[StorageService] Usando caminho do mediaConfig: ${this.uploadsPath}`);
      } else {
        // Se não for /opt/smart-signage, forçar para o padrão
        logWarnSync(`[StorageService] Caminho do mediaConfig não é /opt/smart-signage: ${extractedBasePath}`);
        logWarnSync(`   Forçando uso de: ${DEFAULT_BASE_PATH}`);
        this.basePath = DEFAULT_BASE_PATH;
        this.uploadsPath = path.join(this.basePath, 'uploads');
      }
    } catch (error: any) {
      // Fallback se mediaConfig não estiver disponível
      logWarnSync(`[StorageService] Erro ao obter getStoragePath(): ${error.message}`);
      logWarnSync(`   Usando caminho padrão: ${DEFAULT_BASE_PATH}`);
      this.basePath = process.env.UPLOAD_PATH || DEFAULT_BASE_PATH;
      
      // Garantir que sempre use /opt/smart-signage mesmo se UPLOAD_PATH estiver errado
      if (!this.basePath.startsWith('/opt/smart-signage')) {
        logWarnSync(`[StorageService] UPLOAD_PATH não aponta para /opt/smart-signage: ${this.basePath}`);
        logWarnSync(`   Forçando uso de: ${DEFAULT_BASE_PATH}`);
        this.basePath = DEFAULT_BASE_PATH;
      }
      
      this.uploadsPath = path.join(this.basePath, 'uploads');
    }
    
    logInfoSync(`[StorageService] Caminho final configurado: basePath=${this.basePath}, uploadsPath=${this.uploadsPath}`);
  }

  /**
   * Calcula o uso de armazenamento por cliente
   */
  async getSubscriberStorageUsage(subscriberId: number): Promise<number> {
    try {
      const subscriberDir = path.join(this.uploadsPath, `subscriber-${subscriberId}`);
      if (!fs.existsSync(subscriberDir)) {
        return 0;
      }
      return await this.getDirectorySize(subscriberDir);
    } catch (error: any) {
      logErrorSync('Erro ao calcular uso de armazenamento do subscriber', error, { subscriberId });
      return 0;
    }
  }

  /**
   * Cria a estrutura de diretórios de upload para um subscriber (subscriber-{id}/medias).
   * Deve ser chamado ao cadastrar um novo assinante para garantir que uploads funcionem.
   */
  async ensureSubscriberUploadDirs(subscriberId: number): Promise<void> {
    const subscriberDir = path.join(this.uploadsPath, `subscriber-${subscriberId}`, 'medias');
    await this.ensureDirectoryExists(subscriberDir);
    logInfoSync('[StorageService] Diretório de upload do assinante criado/verificado', {
      subscriberId,
      path: subscriberDir
    });
  }

  /**
   * Verifica se cliente tem quota disponível para novo arquivo
   */
  async checkSubscriberQuota(subscriberId: number, fileSize: number): Promise<{ allowed: boolean; currentUsage: number; quota: number; available: number }> {
    try {
      const currentUsage = await this.getSubscriberStorageUsage(subscriberId);
      const { getSubscriberService } = require('./subscriberService');
      const limits = await getSubscriberService().getMaxLimits(subscriberId);
      const capGb = limits.storage_gb;

      if (capGb === undefined || capGb === 0) {
        return {
          allowed: true,
          currentUsage,
          quota: 0,
          available: Number.MAX_SAFE_INTEGER,
        };
      }

      const quota = capGb * 1024 * 1024 * 1024;
      const available = quota - currentUsage;
      const allowed = fileSize <= available;

      if (!allowed) {
        logWarnSync('Quota de armazenamento excedida', {
          subscriberId,
          fileSize,
          currentUsage,
          quota,
          available,
        });
      }

      return {
        allowed,
        currentUsage,
        quota,
        available,
      };
    } catch (error: any) {
      logErrorSync('Erro ao verificar quota do subscriber', error, { subscriberId, fileSize });
      // Em caso de erro, permitir upload (fail-open)
      return {
        allowed: true,
        currentUsage: 0,
        quota: 0,
        available: 0,
      };
    }
  }

  /**
   * Salva arquivo de mídia
   */
  async saveMediaFile(file: FileInfo, subscriberId: number, mediaName: string): Promise<string> {
    try {
      // Verificar quota antes de salvar
      const quotaCheck = await this.checkSubscriberQuota(subscriberId, file.size);
      if (!quotaCheck.allowed) {
        throw new Error(`Quota de armazenamento excedida. Uso atual: ${this.formatBytes(quotaCheck.currentUsage)}, Quota: ${this.formatBytes(quotaCheck.quota)}, Disponível: ${this.formatBytes(quotaCheck.available)}, Arquivo: ${this.formatBytes(file.size)}`);
      }

      // Criar diretório do subscriber (usar subscriber- em vez de client-)
      const subscriberDir = path.join(this.uploadsPath, `subscriber-${subscriberId}`, 'medias');
      await this.ensureDirectoryExists(subscriberDir);

      // Gerar nome único para o arquivo
      const fileExtension = path.extname(file.originalname);
      const fileName = this.sanitizeFileName(mediaName) + fileExtension;
      const filePath = path.join(subscriberDir, fileName);

      // Verificar se arquivo já existe
      if (fs.existsSync(filePath)) {
        // Adicionar timestamp para evitar conflitos
        const timestamp = Date.now();
        const baseName = path.basename(fileName, fileExtension);
        const newFileName = `${baseName}_${timestamp}${fileExtension}`;
        const newFilePath = path.join(subscriberDir, newFileName);
        
        await this.writeUploadedFile(file, newFilePath);
        return newFilePath;
      }

      // Salvar arquivo
      await this.writeUploadedFile(file, filePath);

      // Definir permissões: arquivos 644 (rw-r--r--)
      try {
        fs.chmodSync(filePath, 0o644);
      } catch (permError: any) {
        logWarnSync(`[StorageService] Não foi possível definir permissões do arquivo ${filePath}`, { error: permError.message });
      }

      // Log do caminho final para debug
      logDebugSync(`[StorageService] Arquivo salvo em: ${filePath}`, {
        relativePath: `/assets/uploads/${path.relative(this.uploadsPath, filePath).replace(/\\/g, '/')}`
      });

      return filePath;

    } catch (error: any) {
      logErrorSync('Erro ao salvar arquivo de mídia', error, { subscriberId, mediaName });
      throw new Error('Erro ao salvar arquivo');
    }
  }

  private async writeUploadedFile(file: FileInfo, targetPath: string): Promise<void> {
    if (file.diskPath && fs.existsSync(file.diskPath)) {
      await fs.promises.copyFile(file.diskPath, targetPath);
      return;
    }
    if (file.buffer && file.buffer.length > 0) {
      fs.writeFileSync(targetPath, file.buffer);
      return;
    }
    throw new Error('Upload sem conteúdo (buffer ou diskPath ausente)');
  }

  /**
   * Salva arquivo de backup
   */
  async saveBackupFile(data: Buffer, fileName: string): Promise<string> {
    try {
      const backupDir = path.join(this.basePath, 'backups');
      await this.ensureDirectoryExists(backupDir);

      const filePath = path.join(backupDir, fileName);
      fs.writeFileSync(filePath, data);
      fs.chmodSync(filePath, 0o644);

      return filePath;

    } catch (error: any) {
      logErrorSync('Erro ao salvar arquivo de backup', error, { fileName });
      throw new Error('Erro ao salvar backup');
    }
  }

  /**
   * Salva arquivo de log
   */
  async saveLogFile(data: string, fileName: string): Promise<string> {
    try {
      const logsDir = path.join(this.basePath, 'logs');
      await this.ensureDirectoryExists(logsDir);

      const filePath = path.join(logsDir, fileName);
      fs.appendFileSync(filePath, data);
      fs.chmodSync(filePath, 0o644);

      return filePath;

    } catch (error: any) {
      logErrorSync('Erro ao salvar arquivo de log', error, { fileName });
      throw new Error('Erro ao salvar log');
    }
  }

  /**
   * Remove arquivo de mídia
   */
  async deleteMediaFile(filePath: string): Promise<void> {
    if (!filePath || typeof filePath !== 'string') {
      logWarnSync('[StorageService] deleteMediaFile ignorado: filePath inválido');
      return;
    }
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logDebugSync(`[StorageService] Arquivo removido: ${filePath}`);
      }

      // Remover thumbnail se existir
      const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
        logDebugSync(`[StorageService] Thumbnail removido: ${thumbnailPath}`);
      }
    } catch (error: any) {
      logErrorSync('Erro ao remover arquivo', error, { filePath });
      throw new Error('Erro ao remover arquivo');
    }
  }

  /**
   * Remove arquivo
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logInfoSync('Arquivo removido', { filePath });
      }
    } catch (error: any) {
      logErrorSync('Erro ao remover arquivo', error, { filePath });
      throw new Error('Erro ao remover arquivo');
    }
  }

  /**
   * Move arquivo
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Criar diretório de destino se não existir
      const destDir = path.dirname(destinationPath);
      await this.ensureDirectoryExists(destDir);

      // Mover arquivo
      fs.renameSync(sourcePath, destinationPath);
      logInfoSync('Arquivo movido', { sourcePath, destinationPath });

    } catch (error: any) {
      logErrorSync('Erro ao mover arquivo', error, { sourcePath, destinationPath });
      throw new Error('Erro ao mover arquivo');
    }
  }

  /**
   * Copia arquivo
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Criar diretório de destino se não existir
      const destDir = path.dirname(destinationPath);
      await this.ensureDirectoryExists(destDir);

      // Copiar arquivo
      fs.copyFileSync(sourcePath, destinationPath);
      logInfoSync('Arquivo copiado', { sourcePath, destinationPath });

    } catch (error: any) {
      logErrorSync('Erro ao copiar arquivo', error, { sourcePath, destinationPath });
      throw new Error('Erro ao copiar arquivo');
    }
  }

  /**
   * Verifica se arquivo existe
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      return fs.existsSync(filePath);
    } catch (error: any) {
      logErrorSync('Erro ao verificar existência do arquivo', error, { filePath });
      return false;
    }
  }

  /**
   * Obtém informações do arquivo
   */
  async getFileInfo(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    isFile: boolean;
    isDirectory: boolean;
  } | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };

    } catch (error: any) {
      logErrorSync('Erro ao obter informações do arquivo', error, { filePath });
      return null;
    }
  }

  /**
   * Lista arquivos em diretório
   */
  async listFiles(directoryPath: string, recursive: boolean = false): Promise<string[]> {
    try {
      if (!fs.existsSync(directoryPath)) {
        return [];
      }

      const files: string[] = [];
      const items = fs.readdirSync(directoryPath);

      for (const item of items) {
        const itemPath = path.join(directoryPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isFile()) {
          files.push(itemPath);
        } else if (stats.isDirectory() && recursive) {
          const subFiles = await this.listFiles(itemPath, recursive);
          files.push(...subFiles);
        }
      }

      return files;

    } catch (error: any) {
      logErrorSync('Erro ao listar arquivos', error, { directoryPath });
      return [];
    }
  }

  /**
   * Cria diretório se não existir
   */
  async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
        logInfoSync('Diretório criado', { directoryPath });
      }
      
      // Garantir que o diretório tem permissões corretas mesmo se já existir
      try {
        fs.chmodSync(directoryPath, 0o755);
        // Garantir que todos os diretórios pais também têm permissões corretas
        let currentPath = directoryPath;
        while (currentPath !== path.dirname(currentPath)) {
          if (fs.existsSync(currentPath)) {
            fs.chmodSync(currentPath, 0o755);
          }
          currentPath = path.dirname(currentPath);
          // Parar quando chegar na raiz do sistema ou no basePath
          if (currentPath === '/' || currentPath === this.basePath || currentPath.length < this.basePath.length) {
            break;
          }
        }
      } catch (permError: any) {
        // Se não conseguir alterar permissões, apenas logar (pode ser que não tenha permissão)
        logWarnSync('Não foi possível ajustar permissões', { directoryPath, error: permError.message });
      }
    } catch (error: any) {
      logErrorSync('Erro ao criar diretório', error, { directoryPath });
      throw new Error('Erro ao criar diretório');
    }
  }

  /**
   * Remove diretório
   */
  async removeDirectory(directoryPath: string): Promise<void> {
    try {
      if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
        logInfoSync('Diretório removido', { directoryPath });
      }
    } catch (error: any) {
      logErrorSync('Erro ao remover diretório', error, { directoryPath });
      throw new Error('Erro ao remover diretório');
    }
  }

  /**
   * Calcula tamanho do diretório
   */
  async getDirectorySize(directoryPath: string): Promise<number> {
    try {
      if (!fs.existsSync(directoryPath)) {
        return 0;
      }

      let totalSize = 0;
      const files = await this.listFiles(directoryPath, true);

      for (const file of files) {
        const stats = fs.statSync(file);
        totalSize += stats.size;
      }

      return totalSize;

    } catch (error: any) {
      logErrorSync('Erro ao calcular tamanho do diretório', error, { directoryPath });
      return 0;
    }
  }

  /**
   * Limpa arquivos antigos
   */
  async cleanupOldFiles(directoryPath: string, maxAgeDays: number): Promise<number> {
    try {
      if (!fs.existsSync(directoryPath)) {
        return 0;
      }

      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Converter para milissegundos
      const cutoffTime = Date.now() - maxAge;
      let removedCount = 0;

      const files = await this.listFiles(directoryPath, true);

      for (const file of files) {
        const stats = fs.statSync(file);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(file);
          removedCount++;
          logInfoSync('Arquivo antigo removido', { file });
        }
      }

      return removedCount;

    } catch (error: any) {
      logErrorSync('Erro ao limpar arquivos antigos', error, { directoryPath, maxAgeDays });
      return 0;
    }
  }

  /**
   * Gera hash MD5 do arquivo
   */
  async getFileHash(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Arquivo não encontrado');
      }

      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(buffer).digest('hex');

    } catch (error: any) {
      logErrorSync('Erro ao gerar hash do arquivo', error, { filePath });
      throw new Error('Erro ao gerar hash');
    }
  }

  /**
   * Valida tipo de arquivo
   */
  validateFileType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Valida tamanho do arquivo
   */
  validateFileSize(size: number, maxSize: number): boolean {
    if (maxSize <= 0) return true;
    return size <= maxSize;
  }

  /**
   * Sanitiza nome do arquivo
   */
  private sanitizeFileName(fileName: string): string {
    // Remover caracteres especiais e espaços
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Obtém extensão do arquivo
   */
  getFileExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  /**
   * Obtém nome do arquivo sem extensão
   */
  getFileNameWithoutExtension(fileName: string): string {
    return path.basename(fileName, path.extname(fileName));
  }

  /**
   * Gera nome único para arquivo
   */
  generateUniqueFileName(originalName: string): string {
    const extension = this.getFileExtension(originalName);
    const baseName = this.getFileNameWithoutExtension(originalName);
    const sanitizedName = this.sanitizeFileName(baseName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${sanitizedName}_${timestamp}_${random}${extension}`;
  }

  /**
   * Verifica espaço disponível
   */
  async getAvailableSpace(): Promise<number> {
    try {
      // Implementar verificação de espaço disponível
      // Por enquanto, retorna um valor alto
      return 1024 * 1024 * 1024; // 1GB
    } catch (error: any) {
      logErrorSync('Erro ao verificar espaço disponível', error);
      return 0;
    }
  }

  /**
   * Obtém estatísticas de uso
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    fileCount: number;
    directoryCount: number;
    availableSpace: number;
  }> {
    try {
      const totalSize = await this.getDirectorySize(this.basePath);
      const files = await this.listFiles(this.basePath, true);
      const availableSpace = await this.getAvailableSpace();

      // Contar diretórios
      let directoryCount = 0;
      const countDirectories = (dir: string) => {
        if (fs.existsSync(dir)) {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
              directoryCount++;
              countDirectories(itemPath);
            }
          }
        }
      };

      countDirectories(this.basePath);

      return {
        totalSize,
        fileCount: files.length,
        directoryCount,
        availableSpace
      };

    } catch (error: any) {
      logErrorSync('Erro ao obter estatísticas de armazenamento', error);
      return {
        totalSize: 0,
        fileCount: 0,
        directoryCount: 0,
        availableSpace: 0
      };
    }
  }

  /**
   * Formata bytes para string legível (ex: "1.5 MB")
   * Método público para uso em rotas e outros serviços
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

/**
 * Media Config Service - Smart Signage v2.1
 * Serviço para aplicar configurações de mídia ao sistema
 */

import { SettingsService } from './settingsService';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError, logInfo, logWarn } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const execAsync = promisify(exec);

export interface MediaConfigApplyResult {
  success: boolean;
  message: string;
  changes: {
    nginx?: boolean;
    express?: boolean;
    multer?: boolean;
    servicesRestarted?: boolean;
  };
  errors?: string[];
}

export class MediaConfigService {
  private get settingsService(): SettingsService {
    if (!(global as unknown as Record<string, unknown>).settingsServiceInstance) {
      (global as unknown as Record<string, unknown>).settingsServiceInstance = new SettingsService();
    }
    return (global as unknown as Record<string, unknown>).settingsServiceInstance as SettingsService;
  }

  // Helpers de conversão (conversão para bytes e formato Express) podem ser
  // reativados do histórico se necessário. Hoje utilizamos apenas o formato
  // Nginx, então mantemos apenas `convertToNginxFormat` para evitar warnings
  // de noUnusedLocals em strict mode.

  /**
   * Converte tamanho para formato Nginx (ex: "500M")
   */
  private convertToNginxFormat(sizeStr: string): string {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) {
      return '500M'; // Default
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    // Nginx usa: B, K, M, G, T (sem o segundo caractere)
    const nginxUnits: { [key: string]: string } = {
      'B': 'B',
      'KB': 'K',
      'MB': 'M',
      'GB': 'G',
      'TB': 'T'
    };

    return `${Math.floor(value)}${nginxUnits[unit] || 'M'}`;
  }

  // private convertToExpressFormat(...) foi removido por não ser utilizado.

  /**
   * Atualiza configuração do Nginx
   */
  private async updateNginxConfig(config: {
    maxSize: string;
    timeout: number;
  }): Promise<boolean> {
    try {
      const nginxConfigPath = '/etc/nginx/sites-available/smart-signage';
      
      if (!fs.existsSync(nginxConfigPath)) {
        await logWarn('Arquivo de configuração do Nginx não encontrado', { nginxConfigPath });
        return false;
      }

      let configContent = fs.readFileSync(nginxConfigPath, 'utf-8');
      const nginxMaxSize = this.convertToNginxFormat(config.maxSize);

      // Atualizar client_max_body_size
      configContent = configContent.replace(
        /client_max_body_size\s+\d+[KMGT]?/gi,
        `client_max_body_size ${nginxMaxSize}`
      );

      // Atualizar client_body_buffer_size (ajustar proporcionalmente)
      const bufferSize = nginxMaxSize.endsWith('M') ? '512k' : 
                         nginxMaxSize.endsWith('G') ? '1M' : '128k';
      configContent = configContent.replace(
        /client_body_buffer_size\s+\d+[kmgt]?/gi,
        `client_body_buffer_size ${bufferSize}`
      );

      // Atualizar timeouts do proxy
      const timeoutStr = `${config.timeout}s`;
      configContent = configContent.replace(
        /proxy_(connect|send|read)_timeout\s+\d+s/gi,
        (_match, type) => `proxy_${type}_timeout ${timeoutStr}`
      );

      // Fazer backup antes de modificar
      const backupPath = `${nginxConfigPath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, fs.readFileSync(nginxConfigPath));

      // Escrever nova configuração
      fs.writeFileSync(nginxConfigPath, configContent, { mode: 0o644 });

      // Testar configuração
      try {
        await execAsync('sudo nginx -t');
        await logInfo('Configuração do Nginx atualizada e validada');
        return true;} catch (error: unknown) {
      const e = normalizeError(error);
        // Restaurar backup se teste falhar
        fs.writeFileSync(nginxConfigPath, fs.readFileSync(backupPath));
        await logError('Configuração do Nginx inválida, backup restaurado', e.error, { nginxConfigPath });
        throw new Error(`Configuração do Nginx inválida: ${e.message}`);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar configuração do Nginx', e.error);
      throw e.error;
    }
  }

  /**
   * Recarrega configurações do Express/Multer (não precisa modificar arquivos)
   * As configurações são lidas dinamicamente do banco em runtime
   */
  private async reloadExpressMulterConfig(): Promise<boolean> {
    try {
      // Importar e recarregar configurações de mídia
      const { reloadMediaConfig } = await import('../config/mediaConfig');
      await reloadMediaConfig();
      
      // Recriar instância do multer nas rotas de mídia
      // Isso será feito automaticamente na próxima requisição
      await logInfo('Configurações do Express/Multer recarregadas do banco de dados');
      return true;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao recarregar configurações do Express/Multer', e.error);
      return false;
    }
  }

  /**
   * Aplica configurações de mídia ao sistema
   */
  async applyMediaConfig(applyChanges: boolean = false): Promise<MediaConfigApplyResult> {
    try {
      // Buscar configurações de mídia
      const maxSizeSetting = await this.settingsService.getSetting('media.upload.max_size');
      const nginxMaxSizeSetting = await this.settingsService.getSetting('media.upload.nginx_max_size');
      const expressLimitSetting = await this.settingsService.getSetting('media.upload.express_limit');
      const proxyTimeoutSetting = await this.settingsService.getSetting('media.upload.proxy_timeout');

      if (!maxSizeSetting || !nginxMaxSizeSetting || !expressLimitSetting || !proxyTimeoutSetting) {
        throw new Error('Configurações de mídia não encontradas no banco de dados');
      }

      const config = {
        maxSize: String(maxSizeSetting.value),
        nginxMaxSize: String(nginxMaxSizeSetting.value),
        expressLimit: String(expressLimitSetting.value),
        timeout: parseInt(String(proxyTimeoutSetting.value)) || 300
      };

      const changes: MediaConfigApplyResult['changes'] = {};
      const errors: string[] = [];

      if (applyChanges) {
        // Aplicar mudanças no Nginx (único que precisa modificar arquivo)
        try {
          changes.nginx = await this.updateNginxConfig({
            maxSize: config.nginxMaxSize,
            timeout: config.timeout
          });
        } catch (error: unknown) {
          const e = normalizeError(error);
          errors.push(`Nginx: ${e.message}`);
          changes.nginx = false;
        }

        // Recarregar configurações do Express/Multer (lidas dinamicamente do banco)
        try {
          changes.express = await this.reloadExpressMulterConfig();
          changes.multer = changes.express; // Mesmo processo
        } catch (error: unknown) {
          const e = normalizeError(error);
          errors.push(`Express/Multer: ${e.message}`);
          changes.express = false;
          changes.multer = false;
        }

        // Reiniciar serviços se necessário
        if (changes.nginx) {
          // Recarregar Nginx (sem downtime)
          try {
            await execAsync('sudo systemctl reload nginx');
            await logInfo('Nginx recarregado');
            changes.servicesRestarted = true;
          } catch (error: unknown) {
            const e = normalizeError(error);
            await logWarn('Erro ao recarregar Nginx', { error: e.message });
            // Tentar restart completo
            try {
              await execAsync('sudo systemctl restart nginx');
              await logInfo('Nginx reiniciado');
              changes.servicesRestarted = true;
            } catch (restartError: unknown) {
              errors.push('Falha ao reiniciar Nginx');
              changes.servicesRestarted = false;
            }
          }
        } else {
          changes.servicesRestarted = true; // Express/Multer não precisam reiniciar
        }
      }

      return {
        success: errors.length === 0,
        message: applyChanges 
          ? (errors.length === 0 
              ? 'Configurações aplicadas com sucesso' 
              : `Configurações aplicadas com ${errors.length} erro(s)`)
          : 'Configurações preparadas (não aplicadas)',
        changes,
        errors: errors.length > 0 ? errors : undefined
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao aplicar configurações de mídia', e.error);
      return {
        success: false,
        message: e.message || 'Erro ao aplicar configurações',
        changes: {},
        errors: [e.message]
      };
    }
  }

  /**
   * Recarrega configurações de mídia do banco de dados
   * Não precisa recompilar - configurações são lidas dinamicamente
   */
  async reloadConfig(): Promise<{ success: boolean; message: string }> {
    try {
      const { reloadMediaConfig } = await import('../config/mediaConfig');
      await reloadMediaConfig();
      
      return {
        success: true,
        message: 'Configurações de mídia recarregadas do banco de dados'
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao recarregar configurações de mídia', e.error);
      return {
        success: false,
        message: e.message || 'Erro ao recarregar configurações'
      };
    }
  }
}


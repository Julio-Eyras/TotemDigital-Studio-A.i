/**
 * Settings Service - Smart Signage v2.0
 * Serviço de configurações do sistema
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError } from '../utils/loggerHelper';
import {

  invalidateFinancialIntegrationConfigCache,
} from './financialIntegrationConfigService';
import { isSecretSettingKey, maskSecretSettingValue } from '../constants/secretSettingKeys';
import { DEFAULT_FINANCIAL_SETTINGS } from '../constants/defaultFinancialSettings';
import { normalizeError } from '../utils/errors';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category: string;
  description?: string;
  isPublic: boolean;
  isEditable: boolean;
  validation?: string;
  options?: unknown[];
  defaultValue: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsCategory {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  settings: SystemSetting[];
}

export interface SettingsResponse {
  categories: SettingsCategory[];
  publicSettings: Record<string, unknown>;
  privateSettings: Record<string, unknown>;
}

export interface UpdateSettingsRequest {
  [key: string]: unknown;
}

export interface SettingsValidation {
  isValid: boolean;
  errors: { [key: string]: string };
  warnings: { [key: string]: string };
}

type DefaultSystemSetting = Omit<SystemSetting, 'id' | 'createdAt' | 'updatedAt' | 'value'> & {
  value: unknown;
};

const DEFAULT_UI_SETTINGS: DefaultSystemSetting[] = [
  {
    key: 'ui.combo.subscribers.status_filter',
    value: [
      { value: 'active', label: 'Ativos', activeOnly: true },
      { value: 'all', label: 'Todos' }
    ],
    type: 'json',
    category: 'ui',
    description: 'Opções do combo Status na tela de Anunciantes. Use activeOnly=true para filtrar apenas ativos; sem activeOnly lista todos.',
    isPublic: true,
    isEditable: true,
    options: undefined,
    defaultValue: JSON.stringify([
      { value: 'active', label: 'Ativos', activeOnly: true },
      { value: 'all', label: 'Todos' }
    ])
  }
];

export class SettingsService {
  private defaultUiSettingsEnsured = false;

  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as unknown as Record<string, unknown>).auditServiceInstance) {
      (global as unknown as Record<string, unknown>).auditServiceInstance = new AuditService();
    }
    return (global as unknown as Record<string, unknown>).auditServiceInstance as AuditService;
  }

  private tryParseJson(value?: string | null): unknown {
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private async ensureDefaultUiSettings(): Promise<void> {
    if (this.defaultUiSettingsEnsured) {
      return;
    }

    for (const setting of DEFAULT_UI_SETTINGS) {
      const existing = await this.db.findFirst(
        'SELECT setting_id FROM system_settings WHERE setting_key = ?',
        [setting.key]
      );
      if (existing) {
        await this.db.executeRaw(`
          UPDATE system_settings
          SET setting_type = ?,
              category = ?,
              description = ?,
              is_public = ?,
              is_editable = ?,
              validation = ?,
              options = ?,
              default_value = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = ?
        `, [
          setting.type,
          setting.category,
          setting.description,
          setting.isPublic,
          setting.isEditable,
          setting.validation || null,
          setting.options ? JSON.stringify(setting.options) : null,
          setting.defaultValue,
          setting.key
        ]);
        continue;
      }

      await this.db.executeRaw(`
        INSERT INTO system_settings (
          setting_key, setting_value, setting_type, category, description,
          is_public, is_editable, validation, options, default_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        setting.key,
        this.convertValueToString(setting.value, setting.type),
        setting.type,
        setting.category,
        setting.description,
        setting.isPublic,
        setting.isEditable,
        setting.validation || null,
        setting.options ? JSON.stringify(setting.options) : null,
        setting.defaultValue
      ]);
    }

    this.defaultUiSettingsEnsured = true;
  }

  /** Insere chaves financial.* ausentes (bases instaladas antes dos seeds financeiros). */
  private async ensureDefaultFinancialSettings(): Promise<void> {
    for (const setting of DEFAULT_FINANCIAL_SETTINGS) {
      const existing = await this.db.findFirst(
        'SELECT setting_id FROM system_settings WHERE setting_key = ?',
        [setting.key]
      );
      if (existing) {
        continue;
      }

      await this.db.executeRaw(
        `
        INSERT INTO system_settings (
          setting_key, setting_value, setting_type, category, description,
          is_public, is_editable, validation, options, default_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          setting.key,
          this.convertValueToString(setting.value, setting.type),
          setting.type,
          setting.category,
          setting.description,
          setting.isPublic,
          setting.isEditable,
          setting.validation || null,
          setting.options ? JSON.stringify(setting.options) : null,
          setting.defaultValue,
        ]
      );
    }
  }

  /**
   * Busca todas as configurações organizadas por categoria
   */
  async getSettings(): Promise<SettingsResponse> {
    try {
      await this.ensureDefaultUiSettings();
      await this.ensureDefaultFinancialSettings();

      const settings = await this.db.findMany(`
        SELECT 
          setting_id as id,
          setting_key as key,
          setting_value as value,
          setting_type as type,
          category,
          description,
          is_public as isPublic,
          is_editable as isEditable,
          validation,
          options,
          default_value as defaultValue,
          created_at as createdAt,
          updated_at as updatedAt
        FROM system_settings
        ORDER BY category, setting_key
      `);

      // Organizar por categoria
      const categories: { [key: string]: SettingsCategory } = {};
      const publicSettings: Record<string, unknown> = {};
      const privateSettings: Record<string, unknown> = {};

      settings.forEach(setting => {
        const convertedValue = this.convertSettingValue(setting.value, setting.type);
        const isEditableNorm =
          setting.isEditable === false ||
          setting.isEditable === 0 ||
          (setting as unknown as Record<string, unknown>).is_editable === false ||
          (setting as unknown as Record<string, unknown>).is_editable === 0
            ? false
            : true;

        // Separar configurações públicas e privadas
        if (setting.isPublic) {
          publicSettings[setting.key] = maskSecretSettingValue(setting.key, convertedValue);
        } else {
          privateSettings[setting.key] = maskSecretSettingValue(setting.key, convertedValue);
        }

        // Organizar por categoria
        if (!categories[setting.category]) {
          categories[setting.category] = {
            name: setting.category,
            displayName: this.getCategoryDisplayName(setting.category),
            description: this.getCategoryDescription(setting.category),
            icon: this.getCategoryIcon(setting.category),
            settings: []
          };
        }

        categories[setting.category].settings.push({
          ...setting,
          isEditable: isEditableNorm,
          value: maskSecretSettingValue(setting.key, convertedValue),
          options: this.tryParseJson(setting.options)
        });
      });

      return {
        categories: Object.values(categories),
        publicSettings,
        privateSettings
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar configurações', e.error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca configuração por chave
   */
  async getSetting(key: string): Promise<SystemSetting | null> {
    try {
      await this.ensureDefaultUiSettings();

      const setting = await this.db.findFirst(`
        SELECT 
          setting_id as id,
          setting_key as key,
          setting_value as value,
          setting_type as type,
          category,
          description,
          is_public as isPublic,
          is_editable as isEditable,
          validation,
          options,
          default_value as defaultValue,
          created_at as createdAt,
          updated_at as updatedAt
        FROM system_settings
        WHERE setting_key = ?
      `, [key]);

      if (!setting) {
        return null;
      }

      const isEditable =
        setting.isEditable === false ||
        setting.isEditable === 0 ||
        (setting as unknown as Record<string, unknown>).is_editable === false ||
        (setting as unknown as Record<string, unknown>).is_editable === 0
          ? false
          : true;

      return {
        ...setting,
        isEditable,
        value: maskSecretSettingValue(setting.key, this.convertSettingValue(setting.value, setting.type)),
        options: this.tryParseJson(setting.options)
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar configuração', e.error, { key });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Atualiza configurações
   */
  async updateSettings(settings: UpdateSettingsRequest, updatedBy: number): Promise<SettingsValidation> {
    try {
      const validation = await this.validateSettings(settings);
      
      if (!validation.isValid) {
        return validation;
      }

      const updates: string[] = [];
      const errors: { [key: string]: string } = {};

      for (const [key, value] of Object.entries(settings)) {
        try {
          // Verificar se configuração existe e é editável
          const setting = await this.getSetting(key);
          if (!setting) {
            errors[key] = 'Configuração não encontrada';
            continue;
          }

          if (!setting.isEditable) {
            continue;
          }

          if (isSecretSettingKey(key)) {
            const trimmed = String(value ?? '').trim();
            if (!trimmed || trimmed === '********') {
              continue;
            }
          }

          // Converter valor para string
          const stringValue = this.convertValueToString(value, setting.type);

          // Atualizar configuração
          await this.db.executeRaw(`
            UPDATE system_settings 
            SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = $2
          `, [stringValue, key]);

          updates.push(key);} catch (error: unknown) {
      const e = normalizeError(error);
          errors[key] = e.message;
        }
      }

      if (Object.keys(errors).length > 0) {
        return {
          isValid: false,
          errors,
          warnings: {}
        };
      }

      // Log de auditoria
      await this.getAuditService().log('settings', 'updated', updatedBy, {
        updatedSettings: updates,
        changes: settings
      });

      if (updates.some((k) => k.startsWith('financial.'))) {
        invalidateFinancialIntegrationConfigCache();
      }

      return {
        isValid: true,
        errors: {},
        warnings: {}
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar configurações', e.error, { settings });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Reseta configuração para valor padrão
   */
  async resetSetting(key: string, resetBy: number): Promise<void> {
    try {
      const setting = await this.getSetting(key);
      if (!setting) {
        throw new Error('Configuração não encontrada');
      }

      if (!setting.isEditable) {
        throw new Error('Configuração não é editável');
      }

      // Resetar para valor padrão
      await this.db.executeRaw(`
        UPDATE system_settings 
        SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = $2
      `, [setting.defaultValue, key]);

      // Log de auditoria
      await this.getAuditService().log('settings', 'reset', resetBy, {
        settingKey: key,
        resetTo: setting.defaultValue
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao resetar configuração', e.error, { key });
      throw e.error;
    }
  }

  /**
   * Reseta todas as configurações para valores padrão
   */
  async resetAllSettings(resetBy: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE system_settings 
        SET setting_value = default_value, updated_at = CURRENT_TIMESTAMP
        WHERE is_editable = 1
      `);

      // Log de auditoria
      await this.getAuditService().log('settings', 'reset_all', resetBy, {
        message: 'Todas as configurações foram resetadas para valores padrão'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao resetar todas as configurações', e.error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova configuração
   */
  async createSetting(setting: Omit<SystemSetting, 'id' | 'createdAt' | 'updatedAt'>, createdBy: number): Promise<SystemSetting> {
    try {
      // Verificar se chave já existe
      const existing = await this.getSetting(setting.key);
      if (existing) {
        throw new Error('Configuração com esta chave já existe');
      }

      // Criar configuração
      const result = await this.db.executeRaw(`
        INSERT INTO system_settings (
          setting_key, setting_value, setting_type, category, description,
          is_public, is_editable, validation, options, default_value
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING setting_id
      `, [
        setting.key,
        this.convertValueToString(setting.value, setting.type),
        setting.type,
        setting.category,
        setting.description,
        setting.isPublic,
        setting.isEditable,
        setting.validation,
        setting.options ? JSON.stringify(setting.options) : null,
        setting.defaultValue
      ]);

      const insertedSetting = result?.rows?.[0];
      if (!insertedSetting?.setting_id) {
        throw new Error('Erro ao criar configuração');
      }

      // Buscar configuração criada
      const newSetting = await this.getSetting(setting.key);
      if (!newSetting) {
        throw new Error('Erro ao buscar configuração criada');
      }

      // Log de auditoria
      await this.getAuditService().log('settings', 'created', createdBy, {
        settingKey: setting.key,
        category: setting.category,
        type: setting.type
      });

      return newSetting;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar configuração', e.error, { key: setting.key });
      throw e.error;
    }
  }

  /**
   * Remove configuração
   */
  async deleteSetting(key: string, deletedBy: number): Promise<void> {
    try {
      const setting = await this.getSetting(key);
      if (!setting) {
        throw new Error('Configuração não encontrada');
      }

      // Remover configuração
      await this.db.executeRaw(`
        DELETE FROM system_settings WHERE setting_key = ?
      `, [key]);

      // Log de auditoria
      await this.getAuditService().log('settings', 'deleted', deletedBy, {
        settingKey: key,
        category: setting.category
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao remover configuração', e.error, { key });
      throw e.error;
    }
  }

  /**
   * Valida configurações
   */
  async validateSettings(settings: UpdateSettingsRequest): Promise<SettingsValidation> {
    try {
      const errors: { [key: string]: string } = {};
      const warnings: { [key: string]: string } = {};

      for (const [key, value] of Object.entries(settings)) {
        const setting = await this.getSetting(key);
        if (!setting) {
          errors[key] = 'Configuração não encontrada';
          continue;
        }

        // Cliente pode enviar snapshot completo; ignorar chaves só leitura (sem erro).
        if (!setting.isEditable) {
          continue;
        }

        // Validar tipo
        if (!this.validateValueType(value, setting.type)) {
          errors[key] = `Valor deve ser do tipo ${setting.type}`;
          continue;
        }

        // Validar valor específico se houver validação
        if (setting.validation) {
          const validationResult = this.validateValue(value, setting.validation);
          if (!validationResult.isValid) {
            errors[key] = validationResult.error || 'Valor inválido';
            continue;
          }
        }

        // Verificar opções se houver
        if (setting.options && setting.options.length > 0) {
          if (!setting.options.includes(value)) {
            errors[key] = `Valor deve ser uma das opções: ${setting.options.join(', ')}`;
            continue;
          }
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao validar configurações', e.error, { settings });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Exporta configurações
   */
  async exportSettings(): Promise<Record<string, unknown>> {
    try {
      const settings = await this.db.findMany(`
        SELECT setting_key as key, setting_value as value, setting_type as type
        FROM system_settings
        WHERE is_editable = 1
      `);

      const exported: Record<string, unknown> = {};
      settings.forEach(setting => {
        exported[setting.key] = this.convertSettingValue(setting.value, setting.type);
      });

      return exported;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao exportar configurações', e.error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Importa configurações
   */
  async importSettings(settings: Record<string, unknown>, importedBy: number): Promise<SettingsValidation> {
    try {
      const validation = await this.validateSettings(settings);
      
      if (!validation.isValid) {
        return validation;
      }

      const updates: string[] = [];

      for (const [key, value] of Object.entries(settings)) {
        const setting = await this.getSetting(key);
        if (setting && setting.isEditable) {
          const stringValue = this.convertValueToString(value, setting.type);
          
          await this.db.executeRaw(`
            UPDATE system_settings 
            SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = $2
          `, [stringValue, key]);

          updates.push(key);
        }
      }

      // Log de auditoria
      await this.getAuditService().log('settings', 'imported', importedBy, {
        importedSettings: updates,
        totalImported: Object.keys(settings).length
      });

      return {
        isValid: true,
        errors: {},
        warnings: {}
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao importar configurações', e.error, { settings });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Converte valor da configuração baseado no tipo
   */
  private convertSettingValue(value: string, type: string): unknown {
    try {
      switch (type) {
        case 'number':
          return parseFloat(value);
        case 'boolean':
          return value === 'true' || value === '1';
        case 'json':
          return JSON.parse(value);
        case 'array':
          return JSON.parse(value);
        default:
          return value;
      }
 
} catch (error: unknown) {
      return value;
    }
  }

  /**
   * Converte valor para string baseado no tipo
   */
  private convertValueToString(value: unknown, type: string): string {
    switch (type) {
      case 'number':
        return value != null ? String(value) : '';
      case 'boolean':
        return value ? 'true' : 'false';
      case 'json':
      case 'array':
        return JSON.stringify(value);
      default:
        return value != null ? String(value) : '';
    }
  }

  /**
   * Valida tipo do valor
   */
  private validateValueType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'json':
        try {
          JSON.parse(JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Valida valor específico
   */
  private validateValue(value: unknown, validation: string): { isValid: boolean; error?: string } {
    try {
      // Implementar validações específicas baseadas na string de validação
      // Exemplo: "min:0,max:100" para números
      if (validation.includes('min:') || validation.includes('max:')) {
        const minMatch = validation.match(/min:(\d+)/);
        const maxMatch = validation.match(/max:(\d+)/);
        const numValue = Number(value);
        
        if (minMatch && !Number.isNaN(numValue) && numValue < parseInt(minMatch[1])) {
          return { isValid: false, error: `Valor deve ser maior ou igual a ${minMatch[1]}` };
        }
        
        if (maxMatch && !Number.isNaN(numValue) && numValue > parseInt(maxMatch[1])) {
          return { isValid: false, error: `Valor deve ser menor ou igual a ${maxMatch[1]}` };
        }
      }

      // Validação de email
      if (validation === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value ?? ''))) {
          return { isValid: false, error: 'Formato de email inválido' };
        }
      }

      // Validação de URL
      if (validation === 'url') {
        try {
          new URL(String(value ?? ''));
        } catch {
          return { isValid: false, error: 'URL inválida' };
        }
      }

      return {
        isValid: true };} catch (error: unknown) {
return { isValid: false, error: 'Erro na validação' };
    }
  }

  /**
   * Obtém nome de exibição da categoria
   */
  private getCategoryDisplayName(category: string): string {
    const names: { [key: string]: string } = {
      'general': 'Geral',
      'system': 'Sistema',
      'database': 'Banco de Dados',
      'ai': 'Inteligência Artificial',
      'billing': 'Faturamento',
      'financial': 'Financeiro',
      'security': 'Segurança',
      'performance': 'Performance',
      'notifications': 'Notificações',
      'integrations': 'Integrações',
      'appearance': 'Aparência',
      'ui': 'Interface'
    };

    return names[category] || category;
  }

  /**
   * Obtém descrição da categoria
   */
  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'general': 'Configurações gerais do sistema',
      'system': 'Configurações do sistema operacional',
      'database': 'Configurações do banco de dados',
      'ai': 'Configurações de inteligência artificial',
      'billing': 'Configurações de faturamento',
      'financial': 'Financeiro, bloqueio por inadimplência e integrações de envio',
      'security': 'Configurações de segurança',
      'performance': 'Configurações de performance',
      'notifications': 'Configurações de notificações',
      'integrations': 'Configurações de integrações',
      'appearance': 'Configurações de aparência',
      'ui': 'Configurações de interface e listas de seleção'
    };

    return descriptions[category] || 'Configurações da categoria';
  }

  /**
   * Obtém ícone da categoria
   */
  private getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'general': 'settings',
      'system': 'computer',
      'database': 'storage',
      'ai': 'psychology',
      'billing': 'payment',
      'security': 'security',
      'performance': 'speed',
      'notifications': 'notifications',
      'integrations': 'extension',
      'appearance': 'palette',
      'ui': 'tune'
    };

    return icons[category] || 'settings';
  }
}


/**
 * QRCode Service - Smart Signage v2.0
 * Serviço de gerenciamento de QR Codes
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import * as QRCode from 'qrcode';

export interface CreateQRCodeRequest {
  clientId: number;
  totemId?: number;
  campaignId?: number;
  title: string;
  description?: string;
  qrType: 'url' | 'text' | 'wifi' | 'contact' | 'sms' | 'email' | 'phone';
  content: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  isActive?: boolean;
  expiresAt?: string;
  maxScans?: number;
  redirectUrl?: string;
  trackingEnabled?: boolean;
}

export interface UpdateQRCodeRequest {
  title?: string;
  description?: string;
  content?: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  isActive?: boolean;
  expiresAt?: string;
  maxScans?: number;
  redirectUrl?: string;
  trackingEnabled?: boolean;
}

export interface QRCodeResponse {
  id: number;
  clientId: number;
  totemId?: number;
  campaignId?: number;
  title: string;
  description?: string;
  qrType: string;
  content: string;
  size: number;
  color: string;
  backgroundColor: string;
  errorCorrectionLevel: string;
  margin: number;
  isActive: boolean;
  expiresAt?: string;
  maxScans?: number;
  redirectUrl?: string;
  trackingEnabled: boolean;
  scanCount: number;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  totemName?: string;
  campaignTitle?: string;
  qrCodeImage?: string;
  isExpired?: boolean;
  isMaxScansReached?: boolean;
}

export interface QRCodeStats {
  total: number;
  active: number;
  inactive: number;
  expired: number;
  byType: { type: string; count: number }[];
  byClient: { clientId: number; clientName: string; count: number }[];
  totalScans: number;
  recentScans: number;
  topQRCodes: {
    id: number;
    title: string;
    scanCount: number;
    clientName: string;
  }[];
}

export interface QRCodeScan {
  id: number;
  qrCodeId: number;
  scannedAt: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceInfo?: string;
}

export class QRCodeService {
  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista QR Codes com paginação e filtros
   */
  async getQRCodes(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number;
      totemId?: number;
      campaignId?: number;
      qrType?: string;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ qrCodes: QRCodeResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.clientId) {
        whereClause += ' AND q.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.totemId) {
        whereClause += ' AND q.totem_id = ?';
        params.push(filters.totemId);
      }

      if (filters.campaignId) {
        whereClause += ' AND q.campaign_id = ?';
        params.push(filters.campaignId);
      }

      if (filters.qrType) {
        whereClause += ' AND q.qr_type = ?';
        params.push(filters.qrType);
      }

      if (filters.isActive !== undefined) {
        whereClause += ' AND q.is_active = ?';
        params.push(filters.isActive);
      }

      if (filters.search) {
        whereClause += ' AND (q.title LIKE ? OR q.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar QR Codes
      const qrCodes = await this.db.findMany(`
        SELECT 
          q.qr_code_id as id,
          q.client_id as clientId,
          q.totem_id as totemId,
          q.campaign_id as campaignId,
          q.title,
          q.description,
          q.qr_type as qrType,
          q.content,
          q.size,
          q.color,
          q.background_color as backgroundColor,
          q.error_correction_level as errorCorrectionLevel,
          q.margin,
          q.is_active as isActive,
          q.expires_at as expiresAt,
          q.max_scans as maxScans,
          q.redirect_url as redirectUrl,
          q.tracking_enabled as trackingEnabled,
          q.scan_count as scanCount,
          q.last_scanned_at as lastScannedAt,
          q.created_at as createdAt,
          q.updated_at as updatedAt,
          cl.name as clientName,
          t.name as totemName,
          c.title as campaignTitle
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        LEFT JOIN totems t ON q.totem_id = t.totem_id
        LEFT JOIN campaigns c ON q.campaign_id = c.campaign_id
        ${whereClause}
        ORDER BY q.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM qr_codes q
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar QR Codes
      const qrCodesWithInfo = await Promise.all(
        qrCodes.map(async (qrCode) => {
          const info = this.getQRCodeInfo(qrCode);
          const qrCodeImage = await this.generateQRCodeImage(qrCode);
          return { ...qrCode, ...info, qrCodeImage };
        })
      );

      return {
        qrCodes: qrCodesWithInfo,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Codes:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca QR Code por ID
   */
  async getQRCodeById(qrCodeId: number): Promise<QRCodeResponse | null> {
    try {
      const qrCode = await this.db.findFirst(`
        SELECT 
          q.qr_code_id as id,
          q.client_id as clientId,
          q.totem_id as totemId,
          q.campaign_id as campaignId,
          q.title,
          q.description,
          q.qr_type as qrType,
          q.content,
          q.size,
          q.color,
          q.background_color as backgroundColor,
          q.error_correction_level as errorCorrectionLevel,
          q.margin,
          q.is_active as isActive,
          q.expires_at as expiresAt,
          q.max_scans as maxScans,
          q.redirect_url as redirectUrl,
          q.tracking_enabled as trackingEnabled,
          q.scan_count as scanCount,
          q.last_scanned_at as lastScannedAt,
          q.created_at as createdAt,
          q.updated_at as updatedAt,
          cl.name as clientName,
          t.name as totemName,
          c.title as campaignTitle
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        LEFT JOIN totems t ON q.totem_id = t.totem_id
        LEFT JOIN campaigns c ON q.campaign_id = c.campaign_id
        WHERE q.qr_code_id = ?
      `, [qrCodeId]);

      if (!qrCode) {
        return null;
      }

      const info = this.getQRCodeInfo(qrCode);
      const qrCodeImage = await this.generateQRCodeImage(qrCode);
      return { ...qrCode, ...info, qrCodeImage };

    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Code:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria novo QR Code
   */
  async createQRCode(data: CreateQRCodeRequest, createdBy: number): Promise<QRCodeResponse> {
    try {
      const {
        clientId,
        totemId,
        campaignId,
        title,
        description,
        qrType,
        content,
        size = 200,
        color = '#000000',
        backgroundColor = '#FFFFFF',
        errorCorrectionLevel = 'M',
        margin = 4,
        isActive = true,
        expiresAt,
        maxScans,
        redirectUrl,
        trackingEnabled = true
      } = data;

      // Verificar se cliente existe
      const client = await this.db.findFirst(`
        SELECT client_id FROM clients WHERE client_id = ? AND active = 1
      `, [clientId]);

      if (!client) {
        throw new Error('Cliente não encontrado ou inativo');
      }

      // Verificar se totem existe (se fornecido)
      if (totemId) {
        const totem = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE totem_id = ? AND active = 1
        `, [totemId]);

        if (!totem) {
          throw new Error('Totem não encontrado ou inativo');
        }
      }

      // Verificar se campanha existe (se fornecida)
      if (campaignId) {
        const campaign = await this.db.findFirst(`
          SELECT campaign_id FROM campaigns WHERE campaign_id = ? AND is_active = 1
        `, [campaignId]);

        if (!campaign) {
          throw new Error('Campanha não encontrada ou inativa');
        }
      }

      // Validar conteúdo baseado no tipo
      this.validateQRCodeContent(qrType, content);

      // Criar QR Code
      const result = await this.db.executeRaw(`
        INSERT INTO qr_codes (
          client_id, totem_id, campaign_id, title, description, qr_type, content,
          size, color, background_color, error_correction_level, margin,
          is_active, expires_at, max_scans, redirect_url, tracking_enabled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING qr_code_id
      `, [
        clientId,
        totemId,
        campaignId,
        title,
        description,
        qrType,
        content,
        size,
        color,
        backgroundColor,
        errorCorrectionLevel,
        margin,
        isActive,
        expiresAt,
        maxScans,
        redirectUrl,
        trackingEnabled
      ]);

      const insertedQRCode = result?.rows?.[0];
      if (!insertedQRCode?.qr_code_id) {
        throw new Error('Erro ao criar QR Code');
      }

      // Buscar QR Code criado
      const newQRCode = await this.getQRCodeById(insertedQRCode.qr_code_id);
      if (!newQRCode) {
        throw new Error('Erro ao buscar QR Code criado');
      }

      // Log de auditoria
      await this.getAuditService().log('qr_code', 'created', createdBy, {
        qrCodeId: newQRCode.id,
        title: newQRCode.title,
        qrType: newQRCode.qrType,
        clientId: newQRCode.clientId
      });

      return newQRCode;

    } catch (error: any) {
      console.error('❌ Erro ao criar QR Code:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza QR Code
   */
  async updateQRCode(qrCodeId: number, data: UpdateQRCodeRequest, updatedBy: number): Promise<QRCodeResponse> {
    try {
      // Verificar se QR Code existe
      const existingQRCode = await this.getQRCodeById(qrCodeId);
      if (!existingQRCode) {
        throw new Error('QR Code não encontrado');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.content !== undefined) {
        // Validar conteúdo se fornecido
        this.validateQRCodeContent(existingQRCode.qrType, data.content);
        updates.push('content = ?');
        params.push(data.content);
      }

      if (data.size !== undefined) {
        updates.push('size = ?');
        params.push(data.size);
      }

      if (data.color !== undefined) {
        updates.push('color = ?');
        params.push(data.color);
      }

      if (data.backgroundColor !== undefined) {
        updates.push('background_color = ?');
        params.push(data.backgroundColor);
      }

      if (data.errorCorrectionLevel !== undefined) {
        updates.push('error_correction_level = ?');
        params.push(data.errorCorrectionLevel);
      }

      if (data.margin !== undefined) {
        updates.push('margin = ?');
        params.push(data.margin);
      }

      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(data.isActive);
      }

      if (data.expiresAt !== undefined) {
        updates.push('expires_at = ?');
        params.push(data.expiresAt);
      }

      if (data.maxScans !== undefined) {
        updates.push('max_scans = ?');
        params.push(data.maxScans);
      }

      if (data.redirectUrl !== undefined) {
        updates.push('redirect_url = ?');
        params.push(data.redirectUrl);
      }

      if (data.trackingEnabled !== undefined) {
        updates.push('tracking_enabled = ?');
        params.push(data.trackingEnabled);
      }

      if (updates.length === 0) {
        return existingQRCode;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(qrCodeId);

      // Atualizar QR Code
      await this.db.executeRaw(`
        UPDATE qr_codes 
        SET ${updates.join(', ')}
        WHERE qr_code_id = ?
      `, params);

      // Buscar QR Code atualizado
      const updatedQRCode = await this.getQRCodeById(qrCodeId);
      if (!updatedQRCode) {
        throw new Error('Erro ao buscar QR Code atualizado');
      }

      // Log de auditoria
      await this.getAuditService().log('qr_code', 'updated', updatedBy, {
        qrCodeId,
        changes: data
      });

      return updatedQRCode;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar QR Code:', error.message);
      throw error;
    }
  }

  /**
   * Remove QR Code
   */
  async deleteQRCode(qrCodeId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se QR Code existe
      const qrCode = await this.getQRCodeById(qrCodeId);
      if (!qrCode) {
        throw new Error('QR Code não encontrado');
      }

      // Remover QR Code
      await this.db.executeRaw(`
        DELETE FROM qr_codes WHERE qr_code_id = ?
      `, [qrCodeId]);

      // Log de auditoria
      await this.getAuditService().log('qr_code', 'deleted', deletedBy, {
        qrCodeId,
        title: qrCode.title,
        clientId: qrCode.clientId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover QR Code:', error.message);
      throw error;
    }
  }

  /**
   * Registra scan do QR Code
   */
  async recordScan(qrCodeId: number, scanData: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    deviceInfo?: string;
  }): Promise<void> {
    try {
      // Verificar se QR Code existe e está ativo
      const qrCode = await this.getQRCodeById(qrCodeId);
      if (!qrCode) {
        throw new Error('QR Code não encontrado');
      }

      if (!qrCode.isActive) {
        throw new Error('QR Code inativo');
      }

      // Verificar se expirou
      if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
        throw new Error('QR Code expirado');
      }

      // Verificar se atingiu limite de scans
      if (qrCode.maxScans && qrCode.scanCount >= qrCode.maxScans) {
        throw new Error('QR Code atingiu limite de scans');
      }

      // Registrar scan
      await this.db.executeRaw(`
        INSERT INTO qr_code_scans (
          qr_code_id, scanned_at, ip_address, user_agent, location, device_info
        )
        VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
      `, [
        qrCodeId,
        scanData.ipAddress,
        scanData.userAgent,
        scanData.location,
        scanData.deviceInfo
      ]);

      // Atualizar contador de scans
      await this.db.executeRaw(`
        UPDATE qr_codes 
        SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP
        WHERE qr_code_id = ?
      `, [qrCodeId]);

    } catch (error: any) {
      console.error('❌ Erro ao registrar scan:', error.message);
      throw error;
    }
  }

  /**
   * Busca estatísticas de QR Codes
   */
  async getQRCodeStats(): Promise<QRCodeStats> {
    try {
      // Total de QR Codes
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM qr_codes
      `);

      // Por status
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM qr_codes WHERE is_active = 1
      `);

      const inactiveResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM qr_codes WHERE is_active = 0
      `);

      const expiredResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM qr_codes 
        WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
      `);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT qr_type as type, COUNT(*) as count
        FROM qr_codes
        GROUP BY qr_type
        ORDER BY count DESC
      `);

      // Por cliente
      const byClient = await this.db.findMany(`
        SELECT 
          q.client_id as clientId,
          cl.name as clientName,
          COUNT(*) as count
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        GROUP BY q.client_id, cl.name
        ORDER BY count DESC
        LIMIT 10
      `);

      // Total de scans
      const totalScansResult = await this.db.findFirst(`
        SELECT SUM(scan_count) as total FROM qr_codes
      `);

      // Scans recentes (últimos 7 dias)
      const recentScansResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM qr_code_scans 
        WHERE scanned_at >= datetime('now', '-7 days')
      `);

      // Top QR Codes por scans
      const topQRCodes = await this.db.findMany(`
        SELECT 
          q.qr_code_id as id,
          q.title,
          q.scan_count as scanCount,
          cl.name as clientName
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        ORDER BY q.scan_count DESC
        LIMIT 10
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.count || 0,
        inactive: inactiveResult?.count || 0,
        expired: expiredResult?.count || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count })),
        byClient: byClient.map(c => ({ clientId: c.clientId, clientName: c.clientName, count: c.count })),
        totalScans: totalScansResult?.total || 0,
        recentScans: recentScansResult?.count || 0,
        topQRCodes: topQRCodes.map(q => ({
          id: q.id,
          title: q.title,
          scanCount: q.scanCount,
          clientName: q.clientName
        }))
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca histórico de scans de um QR Code
   */
  async getQRCodeScans(qrCodeId: number, page: number = 1, limit: number = 50): Promise<{
    scans: QRCodeScan[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Buscar scans
      const scans = await this.db.findMany(`
        SELECT 
          scan_id as id,
          qr_code_id as qrCodeId,
          scanned_at as scannedAt,
          ip_address as ipAddress,
          user_agent as userAgent,
          location,
          device_info as deviceInfo
        FROM qr_code_scans
        WHERE qr_code_id = ?
        ORDER BY scanned_at DESC
        LIMIT ? OFFSET ?
      `, [qrCodeId, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM qr_code_scans WHERE qr_code_id = ?
      `, [qrCodeId]);

      const total = totalResult?.total || 0;

      return {
        scans,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar scans do QR Code:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera imagem do QR Code
   */
  private async generateQRCodeImage(qrCode: any): Promise<string> {
    try {
      const options = {
        width: qrCode.size,
        margin: qrCode.margin,
        color: {
          dark: qrCode.color,
          light: qrCode.backgroundColor
        },
        errorCorrectionLevel: qrCode.errorCorrectionLevel
      };

      const qrCodeDataURL = await QRCode.toDataURL(qrCode.content, options);
      return qrCodeDataURL;

    } catch (error: any) {
      console.error('❌ Erro ao gerar imagem do QR Code:', error.message);
      return '';
    }
  }

  /**
   * Valida conteúdo do QR Code baseado no tipo
   */
  private validateQRCodeContent(qrType: string, content: string): void {
    switch (qrType) {
      case 'url':
        if (!content.startsWith('http://') && !content.startsWith('https://')) {
          throw new Error('URL deve começar com http:// ou https://');
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(content)) {
          throw new Error('Email inválido');
        }
        break;

      case 'phone':
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        if (!phoneRegex.test(content)) {
          throw new Error('Número de telefone inválido');
        }
        break;

      case 'wifi':
        try {
          JSON.parse(content);
        } catch {
          throw new Error('Conteúdo WiFi deve ser um JSON válido');
        }
        break;

      case 'contact':
        try {
          JSON.parse(content);
        } catch {
          throw new Error('Conteúdo de contato deve ser um JSON válido');
        }
        break;

      case 'sms':
        if (!content.includes(':')) {
          throw new Error('SMS deve ter formato: número:mensagem');
        }
        break;

      case 'text':
        // Texto livre, sem validação específica
        break;

      default:
        throw new Error('Tipo de QR Code inválido');
    }
  }

  /**
   * Obtém informações do QR Code
   */
  private getQRCodeInfo(qrCode: any): {
    isExpired: boolean;
    isMaxScansReached: boolean;
  } {
    const now = new Date();
    const expiresAt = qrCode.expiresAt ? new Date(qrCode.expiresAt) : null;

    const isExpired = expiresAt ? now > expiresAt : false;
    const isMaxScansReached = qrCode.maxScans ? qrCode.scanCount >= qrCode.maxScans : false;

    return {
      isExpired,
      isMaxScansReached
    };
  }

  /**
   * Busca QR Codes por cliente
   */
  async getQRCodesByClient(clientId: number, limit: number = 50): Promise<QRCodeResponse[]> {
    try {
      const qrCodes = await this.db.findMany(`
        SELECT 
          q.qr_code_id as id,
          q.client_id as clientId,
          q.totem_id as totemId,
          q.campaign_id as campaignId,
          q.title,
          q.description,
          q.qr_type as qrType,
          q.content,
          q.size,
          q.color,
          q.background_color as backgroundColor,
          q.error_correction_level as errorCorrectionLevel,
          q.margin,
          q.is_active as isActive,
          q.expires_at as expiresAt,
          q.max_scans as maxScans,
          q.redirect_url as redirectUrl,
          q.tracking_enabled as trackingEnabled,
          q.scan_count as scanCount,
          q.last_scanned_at as lastScannedAt,
          q.created_at as createdAt,
          q.updated_at as updatedAt,
          cl.name as clientName,
          t.name as totemName,
          c.title as campaignTitle
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        LEFT JOIN totems t ON q.totem_id = t.totem_id
        LEFT JOIN campaigns c ON q.campaign_id = c.campaign_id
        WHERE q.client_id = ?
        ORDER BY q.created_at DESC
        LIMIT ?
      `, [clientId, limit]);

      // Processar QR Codes
      const qrCodesWithInfo = await Promise.all(
        qrCodes.map(async (qrCode) => {
          const info = this.getQRCodeInfo(qrCode);
          const qrCodeImage = await this.generateQRCodeImage(qrCode);
          return { ...qrCode, ...info, qrCodeImage };
        })
      );

      return qrCodesWithInfo;

    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Codes por cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca QR Codes por totem
   */
  async getQRCodesByTotem(totemId: number, limit: number = 50): Promise<QRCodeResponse[]> {
    try {
      const qrCodes = await this.db.findMany(`
        SELECT 
          q.qr_code_id as id,
          q.client_id as clientId,
          q.totem_id as totemId,
          q.campaign_id as campaignId,
          q.title,
          q.description,
          q.qr_type as qrType,
          q.content,
          q.size,
          q.color,
          q.background_color as backgroundColor,
          q.error_correction_level as errorCorrectionLevel,
          q.margin,
          q.is_active as isActive,
          q.expires_at as expiresAt,
          q.max_scans as maxScans,
          q.redirect_url as redirectUrl,
          q.tracking_enabled as trackingEnabled,
          q.scan_count as scanCount,
          q.last_scanned_at as lastScannedAt,
          q.created_at as createdAt,
          q.updated_at as updatedAt,
          cl.name as clientName,
          t.name as totemName,
          c.title as campaignTitle
        FROM qr_codes q
        LEFT JOIN clients cl ON q.client_id = cl.client_id
        LEFT JOIN totems t ON q.totem_id = t.totem_id
        LEFT JOIN campaigns c ON q.campaign_id = c.campaign_id
        WHERE q.totem_id = ?
        ORDER BY q.created_at DESC
        LIMIT ?
      `, [totemId, limit]);

      // Processar QR Codes
      const qrCodesWithInfo = await Promise.all(
        qrCodes.map(async (qrCode) => {
          const info = this.getQRCodeInfo(qrCode);
          const qrCodeImage = await this.generateQRCodeImage(qrCode);
          return { ...qrCode, ...info, qrCodeImage };
        })
      );

      return qrCodesWithInfo;

    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Codes por totem:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}


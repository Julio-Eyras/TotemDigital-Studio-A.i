import { getDatabase } from '../config/database';
import { normalizeTotemUin } from '../utils/normalizeTotemUin';
import { normalizeDeviceId } from '../utils/normalizeDeviceId';
import { logError } from '../utils/loggerHelper';
import crypto from 'crypto';

export interface CreateDeviceTokenParams {
  totemId?: number | null;
  smartTvId?: number | null;
  uin?: string | null;
  deviceId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  // em milissegundos; se não fornecido, padrão 1h
  ttlMs?: number;
}

export class DeviceTokenService {
  private get db() {
    return getDatabase();
  }

  /**
   * Gera um token aleatório seguro para o dispositivo
   */
  generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Cria ou atualiza um token de dispositivo para o par (uin, deviceId)
   */
  async createOrUpdateToken(params: CreateDeviceTokenParams): Promise<{ token: string; expiresAt: Date }> {
    const {
      totemId = null,
      smartTvId = null,
      uin = null,
      deviceId = null,
      platform = null,
      appVersion = null,
      ipAddress = null,
      userAgent = null,
      ttlMs = 3600000, // 1 hora padrão
    } = params;
    const normalizedUin = uin ? normalizeTotemUin(uin) : null;
    const normalizedDeviceId = deviceId ? normalizeDeviceId(deviceId) : null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const token = this.generateRandomToken();

    try {
      // Estratégia simples: invalidar tokens antigos para o mesmo UIN/device_id
      if (normalizedUin || normalizedDeviceId) {
        const conditions: string[] = [];
        const values: any[] = [];

        if (normalizedUin) {
          conditions.push(`UPPER(TRIM(COALESCE(uin, ''))) = UPPER($${values.length + 1})`);
          values.push(normalizedUin);
        }
        if (normalizedDeviceId) {
          conditions.push(`UPPER(TRIM(COALESCE(device_id, ''))) = $${values.length + 1}`);
          values.push(normalizedDeviceId);
        }

        if (conditions.length > 0) {
          await this.db.executeRaw(
            `
            UPDATE device_tokens
            SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
            WHERE ${conditions.join(' AND ')} AND status = 'active'
          `,
            values,
          );
        }
      }

      await this.db.executeRaw(
        `
        INSERT INTO device_tokens (
          totem_id,
          smart_tv_id,
          uin,
          device_id,
          platform,
          app_version,
          token,
          status,
          ip_address,
          user_agent,
          last_heartbeat,
          expires_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, 'active',
          $8, $9,
          CURRENT_TIMESTAMP,
          $10,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
        [totemId, smartTvId, normalizedUin, normalizedDeviceId, platform, appVersion, token, ipAddress, userAgent, expiresAt],
      );

      return { token, expiresAt };
    } catch (error: any) {
      await logError('Erro ao criar/atualizar device_token', error, {
        totemId,
        smartTvId,
        uin,
        deviceId: normalizedDeviceId,
        platform,
      });
      throw new Error('Erro ao registrar token de dispositivo');
    }
  }

  /**
   * Valida token de dispositivo por UIN (e opcionalmente deviceId)
   * Atualiza last_heartbeat e telemetria se for válido.
   */
  async validateToken(
    uin: string,
    token: string,
    opts?: { deviceId?: string | null; ipAddress?: string | null; userAgent?: string | null },
  ): Promise<boolean> {
    const normalizedUin = uin ? normalizeTotemUin(uin) : '';
    const { deviceId = null, ipAddress = null, userAgent = null } = opts || {};
    const normalizedDeviceId = deviceId ? normalizeDeviceId(deviceId) : '';

    try {
      const conditions: string[] = ['token = $1', 'status = \'active\''];
      const values: any[] = [token];

      if (normalizedUin) {
        conditions.push(`UPPER(TRIM(COALESCE(uin, ''))) = UPPER($${values.length + 1})`);
        values.push(normalizedUin);
      }
      if (normalizedDeviceId) {
        conditions.push(`UPPER(TRIM(COALESCE(device_id, ''))) = $${values.length + 1}`);
        values.push(normalizedDeviceId);
      }

      const row = await this.db.findFirst(
        `
        SELECT device_token_id, expires_at
        FROM device_tokens
        WHERE ${conditions.join(' AND ')}
        LIMIT 1
      `,
        values,
      );

      if (!row) {
        return false;
      }

      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        // Expirado: marcar como expired
        await this.db.executeRaw(
          `
          UPDATE device_tokens
          SET status = 'expired', updated_at = CURRENT_TIMESTAMP
          WHERE device_token_id = $1
        `,
          [row.device_token_id],
        );
        return false;
      }

      // Atualizar telemetria
      await this.db.executeRaw(
        `
        UPDATE device_tokens
        SET 
          last_heartbeat = CURRENT_TIMESTAMP,
          ip_address = COALESCE($2, ip_address),
          user_agent = COALESCE($3, user_agent),
          updated_at = CURRENT_TIMESTAMP
        WHERE device_token_id = $1
      `,
        [row.device_token_id, ipAddress, userAgent],
      );

      return true;
    } catch (error: any) {
      await logError('Erro ao validar device_token', error, { uin, deviceId: normalizedDeviceId });
      return false;
    }
  }
}

let deviceTokenServiceInstance: DeviceTokenService | null = null;

export function getDeviceTokenService(): DeviceTokenService {
  if (!deviceTokenServiceInstance) {
    deviceTokenServiceInstance = new DeviceTokenService();
  }
  return deviceTokenServiceInstance;
}


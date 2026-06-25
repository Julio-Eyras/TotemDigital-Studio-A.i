/**
 * SMTP, WhatsApp Meta e worker financeiro — system_settings com fallback para .env.
 */

import { emailConfig, financialConfig } from '../config/env';
import { SettingsService } from './settingsService';

export interface ResolvedEmailIntegrationConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    tlsRejectUnauthorized: boolean;
  };
}

export interface ResolvedWhatsAppIntegrationConfig {
  cloudApiToken: string;
  phoneNumberId: string;
  apiVersion: string;
  merchantNumber: string;
}

const SETTINGS_KEYS = {
  workerEnabled: 'financial.worker_enabled',
  merchantWhatsapp: 'financial.merchant_whatsapp_number',
  smtpEnabled: 'financial.smtp_enabled',
  smtpHost: 'financial.smtp_host',
  smtpPort: 'financial.smtp_port',
  smtpSecure: 'financial.smtp_secure',
  smtpUser: 'financial.smtp_user',
  smtpPass: 'financial.smtp_pass',
  smtpFrom: 'financial.smtp_from',
  smtpTlsReject: 'financial.smtp_tls_reject_unauthorized',
  whatsappToken: 'financial.whatsapp_api_token',
  whatsappPhoneId: 'financial.whatsapp_phone_number_id',
  whatsappApiVersion: 'financial.whatsapp_api_version',
} as const;

let settingsService: SettingsService | null = null;
let cacheAt = 0;
let cacheEmail: ResolvedEmailIntegrationConfig | null = null;
let cacheWhatsapp: ResolvedWhatsAppIntegrationConfig | null = null;
let cacheWorkerEnabled: boolean | null = null;

const CACHE_TTL_MS = 30_000;

function getSettingsService(): SettingsService {
  if (!settingsService) settingsService = new SettingsService();
  return settingsService;
}

function parseBoolean(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw == null || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

function parseNumber(raw: string | null | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function readSettingValue(key: string): Promise<string | null> {
  try {
    const row = await getSettingsService().getSetting(key);
    if (!row) return null;
    const value = String(row.value ?? '').trim();
    return value || null;
  } catch {
    return null;
  }
}

export function invalidateFinancialIntegrationConfigCache(): void {
  cacheAt = 0;
  cacheEmail = null;
  cacheWhatsapp = null;
  cacheWorkerEnabled = null;
}

function cacheValid(): boolean {
  return cacheAt > 0 && Date.now() - cacheAt < CACHE_TTL_MS;
}

export async function resolveFinancialWorkerEnabled(): Promise<boolean> {
  if (cacheValid() && cacheWorkerEnabled != null) return cacheWorkerEnabled;

  const fromDb = await readSettingValue(SETTINGS_KEYS.workerEnabled);
  cacheWorkerEnabled =
    fromDb != null ? parseBoolean(fromDb, true) : financialConfig.workerEnabled;
  cacheAt = Date.now();
  return cacheWorkerEnabled;
}

export async function resolveEmailIntegrationConfig(): Promise<ResolvedEmailIntegrationConfig> {
  if (cacheValid() && cacheEmail) return cacheEmail;

  const [
    enabledRaw,
    hostRaw,
    portRaw,
    secureRaw,
    userRaw,
    passRaw,
    fromRaw,
    tlsRaw,
  ] = await Promise.all([
    readSettingValue(SETTINGS_KEYS.smtpEnabled),
    readSettingValue(SETTINGS_KEYS.smtpHost),
    readSettingValue(SETTINGS_KEYS.smtpPort),
    readSettingValue(SETTINGS_KEYS.smtpSecure),
    readSettingValue(SETTINGS_KEYS.smtpUser),
    readSettingValue(SETTINGS_KEYS.smtpPass),
    readSettingValue(SETTINGS_KEYS.smtpFrom),
    readSettingValue(SETTINGS_KEYS.smtpTlsReject),
  ]);

  cacheEmail = {
    enabled:
      enabledRaw != null
        ? parseBoolean(enabledRaw, emailConfig.enabled)
        : emailConfig.enabled,
    smtp: {
      host: hostRaw ?? emailConfig.smtp.host,
      port: portRaw != null ? parseNumber(portRaw, emailConfig.smtp.port) : emailConfig.smtp.port,
      secure:
        secureRaw != null
          ? parseBoolean(secureRaw, emailConfig.smtp.secure)
          : emailConfig.smtp.secure,
      user: userRaw ?? emailConfig.smtp.user,
      pass: passRaw ?? emailConfig.smtp.pass,
      from: fromRaw ?? emailConfig.smtp.from,
      tlsRejectUnauthorized:
        tlsRaw != null
          ? parseBoolean(tlsRaw, emailConfig.smtp.tlsRejectUnauthorized)
          : emailConfig.smtp.tlsRejectUnauthorized,
    },
  };

  cacheAt = Date.now();
  return cacheEmail;
}

export async function resolveWhatsAppIntegrationConfig(): Promise<ResolvedWhatsAppIntegrationConfig> {
  if (cacheValid() && cacheWhatsapp) return cacheWhatsapp;

  const [tokenRaw, phoneIdRaw, versionRaw, merchantRaw] = await Promise.all([
    readSettingValue(SETTINGS_KEYS.whatsappToken),
    readSettingValue(SETTINGS_KEYS.whatsappPhoneId),
    readSettingValue(SETTINGS_KEYS.whatsappApiVersion),
    readSettingValue(SETTINGS_KEYS.merchantWhatsapp),
  ]);

  cacheWhatsapp = {
    cloudApiToken: tokenRaw ?? process.env.WHATSAPP_CLOUD_API_TOKEN?.trim() ?? '',
    phoneNumberId: phoneIdRaw ?? process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '',
    apiVersion:
      versionRaw ?? process.env.WHATSAPP_API_VERSION?.trim() ?? 'v21.0',
    merchantNumber: merchantRaw ?? financialConfig.whatsappNumber ?? '',
  };

  cacheAt = Date.now();
  return cacheWhatsapp;
}

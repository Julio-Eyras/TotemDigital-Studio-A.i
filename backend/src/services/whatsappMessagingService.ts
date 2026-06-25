/**
 * WhatsApp — Meta Cloud API (opcional) ou link wa.me para encaminhamento manual.
 */

import { logError, logInfo, logWarn } from '../utils/loggerHelper';
import { resolveWhatsAppIntegrationConfig } from './financialIntegrationConfigService';

export interface WhatsAppSendResult {
  sent: boolean;
  mode: 'cloud_api' | 'wa_me_link' | 'skipped';
  reason?: string;
  waMeUrl?: string;
}

function normalizePhoneE164(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits;
}

function buildWaMeUrl(phoneDigits: string, text: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

export class WhatsappMessagingService {
  private async cloudApiEnabled(): Promise<boolean> {
    const cfg = await resolveWhatsAppIntegrationConfig();
    return Boolean(cfg.cloudApiToken && cfg.phoneNumberId);
  }

  buildLink(toPhone: string, text: string): string | null {
    const digits = normalizePhoneE164(toPhone);
    if (!digits) return null;
    return buildWaMeUrl(digits, text);
  }

  /**
   * Envia texto ao número do anunciante via Meta Cloud API quando configurado;
   * caso contrário devolve link wa.me (útil no e-mail e para operador clicar).
   */
  async sendTextMessage(toPhone: string, text: string): Promise<WhatsAppSendResult> {
    const digits = normalizePhoneE164(toPhone);
    if (!digits) {
      return { sent: false, mode: 'skipped', reason: 'Número WhatsApp inválido ou ausente' };
    }

    const waMeUrl = buildWaMeUrl(digits, text);
    const cfg = await resolveWhatsAppIntegrationConfig();

    if (!(await this.cloudApiEnabled())) {
      await logInfo('WhatsApp Cloud API não configurada — link wa.me gerado', {
        to: digits.slice(0, 6) + '***',
      });
      return {
        sent: false,
        mode: 'wa_me_link',
        reason:
          'Configure financial.whatsapp_api_token e financial.whatsapp_phone_number_id em Configurações → Financeiro (ou .env)',
        waMeUrl,
      };
    }

    const token = cfg.cloudApiToken;
    const phoneNumberId = cfg.phoneNumberId;
    const apiVersion = cfg.apiVersion || 'v21.0';

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: digits,
            type: 'text',
            text: { body: text.slice(0, 4096) },
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        const reason = payload.error?.message || `HTTP ${response.status}`;
        await logWarn('Falha WhatsApp Cloud API', { reason });
        return {
          sent: false,
          mode: 'wa_me_link',
          reason,
          waMeUrl,
        };
      }

      await logInfo('WhatsApp Cloud API: mensagem enviada', {
        to: digits.slice(0, 6) + '***',
      });
      return { sent: true, mode: 'cloud_api', waMeUrl };
    } catch (error: any) {
      await logError('Erro WhatsApp Cloud API', error);
      return {
        sent: false,
        mode: 'wa_me_link',
        reason: error.message,
        waMeUrl,
      };
    }
  }

  /** Link para falar com o financeiro da plataforma. */
  async merchantContactLink(text: string): Promise<string | null> {
    const cfg = await resolveWhatsAppIntegrationConfig();
    const phone = cfg.merchantNumber?.replace(/\D/g, '');
    if (!phone) return null;
    return buildWaMeUrl(phone, text);
  }
}

let instance: WhatsappMessagingService | null = null;

export function getWhatsappMessagingService(): WhatsappMessagingService {
  if (!instance) instance = new WhatsappMessagingService();
  return instance;
}

/**
 * WhatsApp — Meta Cloud API (opcional) ou link wa.me para encaminhamento manual.
 */

import { financialConfig } from '../config/env';
import { logError, logInfo, logWarn } from '../utils/loggerHelper';

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
  private get cloudApiEnabled(): boolean {
    return Boolean(
      process.env.WHATSAPP_CLOUD_API_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    );
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

    if (!this.cloudApiEnabled) {
      await logInfo('WhatsApp Cloud API não configurada — link wa.me gerado', {
        to: digits.slice(0, 6) + '***',
      });
      return {
        sent: false,
        mode: 'wa_me_link',
        reason: 'Configure WHATSAPP_CLOUD_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID para envio automático',
        waMeUrl,
      };
    }

    const token = process.env.WHATSAPP_CLOUD_API_TOKEN!.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
    const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

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

  /** Link para falar com o financeiro da plataforma (FINANCIAL_WHATSAPP_NUMBER). */
  merchantContactLink(text: string): string | null {
    const phone = financialConfig.whatsappNumber?.replace(/\D/g, '');
    if (!phone) return null;
    return buildWaMeUrl(phone, text);
  }
}

let whatsappMessagingServiceInstance: WhatsappMessagingService | null = null;

export function getWhatsappMessagingService(): WhatsappMessagingService {
  if (!whatsappMessagingServiceInstance) {
    whatsappMessagingServiceInstance = new WhatsappMessagingService();
  }
  return whatsappMessagingServiceInstance;
}

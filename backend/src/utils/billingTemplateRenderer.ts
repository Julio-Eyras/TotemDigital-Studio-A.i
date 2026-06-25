export type BillingTemplateVars = Record<string, string | number>;

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function renderBillingTemplate(
  template: string,
  vars: BillingTemplateVars
): string {
  return String(template || '').replace(PLACEHOLDER_RE, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export const DEFAULT_OVERDUE_BLOCK_EMAIL_SUBJECT =
  'Publicação suspensa — {{subscriber_name}} ({{overdue_count}} prestação(ões) em atraso)';

export const DEFAULT_OVERDUE_BLOCK_EMAIL_BODY = `Olá {{subscriber_name}},

Informamos que a publicação nas telas foi suspensa automaticamente após {{grace_days}} dia(s) de tolerância desde o vencimento.

Resumo:
- Prestações em atraso: {{overdue_count}}
- Valor total em aberto: {{amount_total}}
- Maior atraso: {{days_overdue}} dia(s)

Detalhes:
{{invoice_list}}

Regularize em: {{billing_url}}

Em caso de dúvidas, responda este e-mail ou fale conosco pelo WhatsApp.

Atenciosamente,
{{merchant_name}}`;

export const DEFAULT_OVERDUE_BLOCK_WHATSAPP_MESSAGE = `Olá {{subscriber_name}}, sua publicação no Totem Digital foi suspensa por inadimplência ({{overdue_count}} prestação(ões), {{amount_total}} em aberto, {{days_overdue}} dia(s) de atraso). Regularize: {{billing_url}}`;

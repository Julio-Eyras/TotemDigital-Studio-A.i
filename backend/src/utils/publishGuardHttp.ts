import { BillingOverduePublishError } from '../services/billingEnforcementService';

export function resolvePublishGuardHttpStatus(error: unknown): number {
  if (error instanceof BillingOverduePublishError) return 402;
  const code = String((error as { code?: string })?.code || '');
  if (code === 'BILLING_OVERDUE') return 402;
  const message = String((error as Error)?.message || '');
  if (message.includes('Acesso negado')) return 403;
  return 400;
}

export function publishGuardErrorPayload(error: unknown): { error: string; message: string; code?: string } {
  if (error instanceof BillingOverduePublishError) {
    return {
      error: error.message,
      message: error.message,
      code: error.code,
    };
  }
  const message = String((error as Error)?.message || 'Erro ao publicar');
  return { error: message, message };
}

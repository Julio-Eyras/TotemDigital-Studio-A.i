import { Subscriber } from '../../services/api';
import { ContractHealthLevel } from './subscriberContractHealth';

export const SUBSCRIBER_KPI_LEGEND =
  'Bibliotecas (total activas) · Playlists (PT:MT) · Campanhas (Ct, mt, pt)';

/** 0 = ilimitado (política do backend). */
export function formatPlanQuota(used: number, limit?: number | null): string {
  if (limit == null || limit === undefined) {
    return String(used);
  }
  if (limit === 0) {
    return `${used}/∞`;
  }
  return `${used}/${limit}`;
}

export function formatRelativeActivity(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  if (diffDays < 30) return `há ${diffDays} dias`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'há 1 mês';
  if (diffMonths < 12) return `há ${diffMonths} meses`;
  return date.toLocaleDateString('pt-BR');
}

export function resolveLastActivityLabel(subscriber: Subscriber): string | null {
  const candidates = [subscriber.last_media_upload_at, subscriber.last_campaign_activity_at]
    .filter(Boolean)
    .map((v) => new Date(String(v)).getTime())
    .filter((t) => !Number.isNaN(t));
  if (candidates.length === 0) return null;
  const latest = new Date(Math.max(...candidates)).toISOString();
  const rel = formatRelativeActivity(latest);
  return rel ? `Última actividade: ${rel}` : null;
}

export function formatCoverageLabel(subscriber: Subscriber): string {
  const publishers = subscriber.publisher_count ?? 0;
  const cities = subscriber.cities_count ?? 0;
  const totems = subscriber.totems_count ?? 0;
  const online = subscriber.online_totems_count ?? 0;
  if (publishers === 0 && totems === 0) {
    return subscriber.city?.trim() || 'Sem cobertura definida';
  }
  const parts: string[] = [];
  if (publishers > 0) parts.push(`${publishers} publisher${publishers !== 1 ? 's' : ''}`);
  if (cities > 0) parts.push(`${cities} cidade${cities !== 1 ? 's' : ''}`);
  if (totems > 0) parts.push(`Totens ${online}/${totems} online`);
  return parts.join(' · ');
}

export type PublishReadinessLevel = 'ready' | 'blocked' | 'no_campaign' | 'no_media' | 'empty' | 'inactive';

export interface PublishReadiness {
  level: PublishReadinessLevel;
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
  tooltip: string;
}

export function getPublishReadiness(subscriber: Subscriber): PublishReadiness {
  if (!subscriber.is_active) {
    return {
      level: 'inactive',
      label: 'Inactivo',
      color: 'default',
      tooltip: 'Anunciante inactivo no sistema',
    };
  }
  if (
    subscriber.has_billing_publish_blocked ||
    subscriber.contract_alert_level === 'error' ||
    (subscriber.active_contracts_count ?? 0) === 0
  ) {
    const reason = subscriber.has_billing_publish_blocked
      ? 'Publicação bloqueada (cobrança ou contrato)'
      : subscriber.contract_alert_level === 'error'
        ? 'Contrato vencido ou inválido'
        : 'Sem contrato activo';
    return {
      level: 'blocked',
      label: 'Bloqueado',
      color: 'error',
      tooltip: reason,
    };
  }
  const mediaLib = subscriber.media_count ?? 0;
  const campaigns = subscriber.campaign_count ?? 0;
  const campaignMedia = subscriber.campaign_total_media_count ?? 0;

  if (mediaLib === 0) {
    return {
      level: 'empty',
      label: 'Sem conteúdo',
      color: 'warning',
      tooltip: 'Nenhuma mídia activa na biblioteca',
    };
  }
  if (campaigns === 0) {
    return {
      level: 'no_campaign',
      label: 'Sem campanha',
      color: 'warning',
      tooltip: 'Há mídias na biblioteca, mas nenhuma campanha activa',
    };
  }
  if (campaignMedia === 0) {
    return {
      level: 'no_media',
      label: 'Camp. vazia',
      color: 'warning',
      tooltip: 'Campanha activa sem mídias assignadas',
    };
  }
  return {
    level: 'ready',
    label: 'Pronto',
    color: 'success',
    tooltip: 'Contrato válido, campanha activa com mídias — pronto para publicar',
  };
}

export interface SubscriberListChip {
  health: ContractHealthLevel | 'neutral';
  label: string;
  tooltip: string;
}

export function getSubscriberContractListChip(subscriber: Subscriber): SubscriberListChip {
  const level = String(subscriber.contract_alert_level || '').toLowerCase();
  const days = subscriber.days_until_contract_end;

  if (level === 'error') {
    return {
      health: 'error',
      label: 'Contrato vencido',
      tooltip: subscriber.contract_alert_label || 'Contrato vencido ou encerrado',
    };
  }
  if (level === 'warning') {
    const daySuffix = days != null && days >= 0 ? ` · ${days}d` : '';
    return {
      health: 'warning',
      label: `Vence em breve${daySuffix}`,
      tooltip: subscriber.contract_alert_label || 'Contrato próximo do fim da vigência',
    };
  }
  if ((subscriber.active_contracts_count ?? 0) > 0) {
    const daySuffix = days != null && days >= 0 ? ` · ${days}d` : '';
    return {
      health: 'success',
      label: `Em dia${daySuffix}`,
      tooltip: subscriber.contract_alert_label || 'Contrato activo em vigência',
    };
  }
  return {
    health: 'warning',
    label: 'Sem contrato',
    tooltip: 'Nenhum contrato activo no momento',
  };
}

export function getSubscriberFinancialListChip(subscriber: Subscriber): SubscriberListChip | null {
  if (subscriber.has_billing_publish_blocked) {
    return {
      health: 'error',
      label: 'Pub. bloqueada',
      tooltip: 'Publicação bloqueada por cobrança em atraso',
    };
  }
  if (subscriber.has_billing_overdue) {
    return {
      health: 'error',
      label: 'Cobrança atraso',
      tooltip: subscriber.financial_alert_label || 'Pagamento em atraso',
    };
  }
  if (subscriber.has_billing_due_soon) {
    return {
      health: 'warning',
      label: 'Cobr. a vencer',
      tooltip: subscriber.financial_alert_label || 'Cobrança próxima do vencimento',
    };
  }
  const finLevel = String(subscriber.financial_alert_level || '').toLowerCase();
  if (finLevel === 'error' || finLevel === 'warning') {
    return {
      health: finLevel as ContractHealthLevel,
      label: subscriber.financial_alert_label?.slice(0, 18) || 'Financeiro',
      tooltip: subscriber.financial_alert_label || 'Situação financeira requer atenção',
    };
  }
  if ((subscriber.active_contracts_count ?? 0) > 0) {
    return {
      health: 'success',
      label: 'Financeiro OK',
      tooltip: 'Sem pendências financeiras detectadas',
    };
  }
  return null;
}

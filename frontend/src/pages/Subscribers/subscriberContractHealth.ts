/**
 * Apresentação visual do estado do contrato do anunciante (detalhes / listagens).
 */

export type ContractHealthLevel = 'success' | 'warning' | 'error';

export interface SubscriberContractHealth {
  health: ContractHealthLevel;
  chipLabel: string;
  tooltip: string;
}

function dayOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

/**
 * Verde: ativo e dentro da vigência sem inconsistências.
 * Amarelo: rascunho, encerrado, cancelado, expirado (status), ou vigência futura/passada coerente com o estado.
 * Vermelho: regras violadas (datas inconsistentes ou status "ativo" fora da vigência).
 */
export function getSubscriberContractHealth(contract: Record<string, unknown>): SubscriberContractHealth {
  const status = String(contract.status ?? '').toLowerCase();

  const parseDay = (raw: unknown): Date | null => {
    if (raw == null || raw === '') return null;
    const x = new Date(String(raw));
    return Number.isNaN(x.getTime()) ? null : dayOnly(x);
  };

  const start = parseDay(contract.start_date);
  const end = parseDay(contract.end_date);
  const today = dayOnly(new Date());

  const msgs: string[] = [];
  let ruleError = false;

  if (start && end && start.getTime() > end.getTime()) {
    msgs.push('Intervalo inválido: data de início posterior ao fim.');
    ruleError = true;
  }

  if (status === 'active') {
    if (start && today.getTime() < start.getTime()) {
      msgs.push('Inconsistente: status ativo antes da data de início.');
      ruleError = true;
    }
    if (end && today.getTime() > end.getTime()) {
      msgs.push('Inconsistente: status ativo após o fim da vigência.');
      ruleError = true;
    }
  }

  const chipLabel =
    status === 'active'
      ? 'Ativo'
      : status === 'draft'
        ? 'Rascunho'
        : status === 'expired'
          ? 'Expirado'
          : status === 'terminated'
            ? 'Encerrado'
            : status === 'cancelled'
              ? 'Cancelado'
              : status
                ? status.charAt(0).toUpperCase() + status.slice(1)
                : '—';

  if (msgs.length > 0 && ruleError) {
    return {
      health: 'error',
      chipLabel,
      tooltip: msgs.join(' '),
    };
  }

  const inWindow =
    (!start || today.getTime() >= start.getTime()) && (!end || today.getTime() <= end.getTime());

  if (status === 'active' && inWindow && msgs.length === 0) {
    return {
      health: 'success',
      chipLabel,
      tooltip: 'Contrato ativo e dentro da vigência.',
    };
  }

  const operationalHint =
    status === 'draft'
      ? 'Contrato em elaboração.'
      : status === 'expired'
        ? 'Vigência encerrada ou marcado como expirado.'
        : status === 'terminated'
          ? 'Contrato encerrado.'
          : status === 'cancelled'
            ? 'Contrato cancelado.'
            : status === 'active'
              ? 'Revise datas e status.'
              : 'Estado operacional.';

  return {
    health: 'warning',
    chipLabel,
    tooltip: msgs.length > 0 ? msgs.join(' ') : operationalHint,
  };
}

/**
 * Regras unificadas de limites de plano (Pro e Compact):
 * - Valor 0 em JSON limits ou nos defaults do sistema = ilimitado.
 * - Entre vários planos ativos: se qualquer plano fixar 0 numa métrica, essa métrica é ilimitada;
 *   caso contrário usa-se o máximo entre os valores > 0 definidos nos planos.
 * - Se nenhum plano define a chave, aplicam-se os defaults em system_settings (limits.defaults.*).
 */

export type PlanLimitMerge = 'unlimited' | 'unset' | { value: number };

export function normalizeLimitInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const n = typeof raw === 'string' ? parseInt(String(raw).trim(), 10) : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

/**
 * Agrega uma métrica numérica entre os planos (campo em limits, ex.: storage_gb).
 */
export function mergeNumericPlanLimit(plans: any[], jsonKey: string): PlanLimitMerge {
  let sawKey = false;
  let maxVal = -Infinity;

  for (const p of plans) {
    const raw = p?.limits?.[jsonKey];
    if (raw === undefined || raw === null || raw === '') {
      continue;
    }
    sawKey = true;
    const n = normalizeLimitInt(raw);
    if (n === undefined) {
      continue;
    }
    if (n === 0) {
      return 'unlimited';
    }
    maxVal = Math.max(maxVal, n);
  }

  if (!sawKey) {
    return 'unset';
  }
  if (!Number.isFinite(maxVal) || maxVal < 0) {
    return 'unset';
  }
  return { value: maxVal };
}

/**
 * Converte resultado do merge + default numérico do sistema em limite efetivo (undefined = ilimitado).
 */
export function resolveLimitWithDefault(
  merged: PlanLimitMerge,
  defaultFromDb: number | undefined
): number | undefined {
  if (merged === 'unlimited') {
    return undefined;
  }
  if (merged === 'unset') {
    if (defaultFromDb === undefined || defaultFromDb === null) {
      return undefined;
    }
    if (defaultFromDb === 0) {
      return undefined;
    }
    return defaultFromDb;
  }
  return merged.value;
}

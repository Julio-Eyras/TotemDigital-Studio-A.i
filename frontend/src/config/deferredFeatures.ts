/**
 * Features de produto adiadas (FE) — alinhar com backend/src/policy/deferredFeatures.ts
 */
export type DeferredFeatureId =
  | 'tags_crud'
  | 'notifications'
  | 'qr_code_scans'
  | 'facial_recognition'
  | 'ai_request_history';

const DEFERRED_PATH_PREFIXES: Array<{ prefix: string; feature: DeferredFeatureId }> = [
  { prefix: '/tags', feature: 'tags_crud' },
];

export function isPathDeferred(path: string): boolean {
  const p = (path || '').split('?')[0] || '/';
  return DEFERRED_PATH_PREFIXES.some(
    (rule) => p === rule.prefix || p.startsWith(rule.prefix + '/')
  );
}

export function getDeferredFeatureForPath(path: string): DeferredFeatureId | null {
  const p = (path || '').split('?')[0] || '/';
  const hit = DEFERRED_PATH_PREFIXES.find(
    (rule) => p === rule.prefix || p.startsWith(rule.prefix + '/')
  );
  return hit?.feature ?? null;
}

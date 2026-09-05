// i18n Backend - TotemDigital Studio A.i
// Setup leve com recursos embutidos (3 idiomas), sem runtime externo.
// Uso: import i18n from './i18n'; i18n.t('auth:login.invalidCredentials', {lng: req.locale})
// OU helper: t(req, 'auth:login.invalidCredentials', interpolation?)

import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

const RESOURCES: Record<string, Record<string, unknown>> = {
  'pt-BR': ptBR as Record<string, unknown>,
  'en-US': enUS as Record<string, unknown>,
  'es-ES': esES as Record<string, unknown>
};

const SUPPORTED = ['pt-BR', 'en-US', 'es-ES'] as const;
type SupportedLang = typeof SUPPORTED[number];
const DEFAULT_LANG: SupportedLang = 'pt-BR';

export const SUPPORTED_LANGUAGES: readonly SupportedLang[] = SUPPORTED;

function normalize(lang: string | undefined | null): SupportedLang {
  if (!lang) return DEFAULT_LANG;
  // primeiro tentativa exata
  if ((SUPPORTED as readonly string[]).includes(lang)) return lang as SupportedLang;
  // prefixo (pt, en, es)
  const prefix = lang.split('-')[0]?.toLowerCase() || '';
  if (prefix === 'pt') return 'pt-BR';
  if (prefix === 'en') return 'en-US';
  if (prefix === 'es') return 'es-ES';
  return DEFAULT_LANG;
}

function resolve(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(/[:.]/);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(template: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined ? `{{${key}}}` : String(v);
  });
}

export interface TranslateOptions {
  lng?: string;
  fallback?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export function t(key: string, opts: TranslateOptions = {}): string {
  const lang = normalize(opts.lng);
  const bundle = RESOURCES[lang] || RESOURCES[DEFAULT_LANG];
  let value = resolve(bundle, key);
  if (value === undefined && lang !== DEFAULT_LANG) {
    value = resolve(RESOURCES[DEFAULT_LANG], key);
  }
  if (value === undefined) {
    if (opts.fallback) return interpolate(opts.fallback, opts.params);
    return key;
  }
  if (typeof value !== 'string') {
    return key;
  }
  return interpolate(value, opts.params);
}

export interface LocalizedRequestLike {
  locale?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  subdomains?: string[];
}

function fromQuery(query?: Record<string, unknown>): string | undefined {
  const raw = query?.lang ?? query?.locale ?? query?.lng;
  return typeof raw === 'string' ? raw : undefined;
}

function fromHeaders(headers?: Record<string, string | string[] | undefined>): string | undefined {
  const accept = headers?.['accept-language'];
  const raw = Array.isArray(accept) ? accept[0] : accept;
  if (!raw) return undefined;
  // exemplo: "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7"
  const first = raw.split(',')[0]?.split(';')[0]?.trim();
  return first;
}

function fromSubdomains(subdomains?: string[]): string | undefined {
  const first = subdomains?.[0]?.toLowerCase();
  if (!first) return undefined;
  if (first === 'pt' || first === 'br') return 'pt-BR';
  if (first === 'en' || first === 'us') return 'en-US';
  if (first === 'es') return 'es-ES';
  return undefined;
}

export function detectLocale(req: LocalizedRequestLike = {}): SupportedLang {
  return normalize(
    fromQuery(req.query) ||
    req.locale ||
    fromSubdomains(req.subdomains) ||
    fromHeaders(req.headers)
  );
}

// alias para export nomeado similar a módulos externos
export const i18nBackend = {
  t,
  detectLocale,
  normalize,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANG,
  resources: RESOURCES
};

export default i18nBackend;

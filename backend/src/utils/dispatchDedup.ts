/**
 * Dispatcher Versioning & Dedup Helpers - Smart Signage Pro v3.1
 *
 * Objetivo:
 *   1. `computeDispatchVersionHash(plan, opts?)` → gera hash estável do conteúdo do plano
 *      (não depende de timestamp, metadata transient ou cacheKey).
 *   2. `DispatchDedupStore` — singleton in-memory por `totemId` que memoriza
 *      o último versionHash enviado. Se o hash bater → marcamos plano como duplicado
 *      e poupamos MQTT, WebSocket, gravação de log e Redis.
 *
 * Características:
 *   - SHA-256 truncado em 16 hex (64 bits efetivos — chance de colisão desprezível
 *     para uso em dispatcher — precisamos de identidade por conteúdo, não criptografia)
 *   - Imutável: dados ordenados no input garantem mesmo hash em qualquer ordem de build
 *   - LRU: limitado a 10.000 totens (mais de 10k totens → cai os mais antigos;
 *     na prática o dispatcher só tem alguns milhares de totens simultâneos)
 */

import * as crypto from 'crypto';
import type { DispatchMediaItem, DispatchPlan } from '../types/dispatcherTotem.types';

// =============================================================================
// CONFIG
// =============================================================================

/** Tamanho da string hex do versionHash (SHA-256 é 64; truncamos em 16 → 64 bits) */
const HASH_TRUNCATE_HEX_CHARS = 16;

/** Tamanho máximo do LRU de dedup por instância. */
const DEFAULT_DEDUP_MAX_ENTRIES = 10_000;

/** Idade máxima que um hash fica "válido" no dedup (ms). */
const DEFAULT_DEDUP_TTL_MS = 10 * 60 * 1000; // 10 min

// =============================================================================
// 1) HASH
// =============================================================================

export interface VersionHashOptions {
  /** Se true, usa contentHash do DispatchMediaItem (precisa ACE/FX instalado). Default: false. */
  preferMediaContentHash?: boolean;
}

/**
 * Estrutura estável serializada para hash (a ordem das chaves importa!).
 * Só entram campos que realmente representam o CONTEÚDO visível no player.
 * Quando `preferMediaContentHash=true` E o item TEM `contentHash` preenchido,
 * os campos mediaId/url/cacheBucket são substituídos por sentinelas estáveis
 * (nunca influenciam o hash — a identidade é 100% o conteúdo, não o registro).
 */
interface StablePlanForHash {
  totemId: number;
  playlistId: number;
  source: DispatchPlan['source'];
  sourceId: number;
  priority: number;
  totalDuration: number;
  /** Cada item tem só os campos que mudam o que o player toca. */
  items: Array<{
    mediaId: number | '*';
    order: number;
    duration: number | null;
    url: string;
    mediaType: string;
    cacheBucket: DispatchMediaItem['cacheBucket'] | '*';
    /** ACE/FX: se este campo está preenchido, substitui identidade da mídia. */
    contentHash?: string;
  }>;
}

/**
 * Gera hash estável do conteúdo do DispatchPlan.
 *
 * Garante:
 *   - Mesmos mediaIds + mesma ordem + mesmas durações → sempre mesmo hash.
 *   - Mudanças em `timestamp`, `cacheKey`, `metadata.*`, `validityStart/End` → NÃO mudam o hash.
 *   - Mudanças de `priority`, `playlistId`, `source` → MUDAM o hash (comportamento desejado).
 *   - Com `preferMediaContentHash=true`: itens que POSSUEM `contentHash` não-nulo
 *     passam a ser identificados SÓ pelo contentHash; mediaId/url/cacheBucket tornam-se
 *     valores sentinela estáveis. Itens SEM contentHash mantêm a comparação original.
 */
export function computeDispatchVersionHash(
  plan: Pick<
    DispatchPlan,
    'totemId' | 'playlistId' | 'source' | 'sourceId' | 'priority' | 'totalDuration' | 'mediaItems'
  >,
  opts: VersionHashOptions = {},
): string {
  const preferContentHash = opts.preferMediaContentHash === true;

  // Normalizar ordem por `order` (garantir que a lista esteja sempre ordenada)
  const sortedItems = [...plan.mediaItems].sort((a, b) => a.order - b.order);

  const stable: StablePlanForHash = {
    totemId: plan.totemId,
    playlistId: plan.playlistId,
    source: plan.source,
    sourceId: plan.sourceId,
    priority: plan.priority,
    totalDuration: plan.totalDuration,
    items: sortedItems.map((m) => {
      const useContentIdentity = preferContentHash && typeof m.contentHash === 'string' && m.contentHash.length > 0;
      return {
        mediaId: useContentIdentity ? ('*' as const) : m.mediaId,
        order: m.order,
        duration: m.duration,
        url: useContentIdentity ? '*' : m.url,
        mediaType: m.mediaType,
        cacheBucket: useContentIdentity ? ('*' as const) : m.cacheBucket,
        contentHash: useContentIdentity ? m.contentHash : undefined,
      };
    }),
  };

  const json = JSON.stringify(stable);
  const full = crypto.createHash('sha256').update(json, 'utf8').digest('hex');
  return full.slice(0, HASH_TRUNCATE_HEX_CHARS);
}

// =============================================================================
// 2) DEDUP STORE (LRU simples, sem dependências externas)
// =============================================================================

interface DedupEntry {
  versionHash: string;
  /** Quando este hash foi "ultimo enviado". */
  sentAt: number;
  /** Último cacheKey associado (para debug). */
  lastCacheKey?: string;
}

export interface DedupCheckResult {
  /** true = este hash já foi enviado recentemente para o totem. */
  isDuplicate: boolean;
  /** Hash efetivamente testado (para retorno ao caller). */
  versionHash: string;
  /** Idade do hash anterior em ms (se duplicado). */
  ageMs?: number;
  /** cacheKey do envio anterior (se duplicado). */
  previousCacheKey?: string;
}

export interface DedupStoreOptions {
  maxEntries?: number;
  ttlMs?: number;
}

/**
 * Armazena o último versionHash enviado para cada totem.
 * Usado para decidir se o dispatcher vai de fato "publicar" um plano novo
 * ou apenas responder ao caller que é um repeat.
 *
 * É um LRU simples em memória (não é cluster-safe). Em deploy multi-instancia,
 * o custo de NÃO dedup em outra instância é zero: só envia duas vezes no pior
 * caso, então o player aplica dedup por sua conta (com o mesmo versionHash).
 */
export class DispatchDedupStore {
  private readonly store: Map<number, DedupEntry>;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(opts: DedupStoreOptions = {}) {
    this.store = new Map<number, DedupEntry>();
    this.maxEntries = opts.maxEntries ?? DEFAULT_DEDUP_MAX_ENTRIES;
    this.ttlMs = opts.ttlMs ?? DEFAULT_DEDUP_TTL_MS;
  }

  /** Quantas entradas existem atualmente (debug / metrics). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Executa a checagem de dedup. Se NÃO é duplicado, grava a nova entrada.
   * @returns DedupCheckResult com o resultado.
   */
  checkAndRecord(
    totemId: number,
    versionHash: string,
    opts: { now?: number; cacheKey?: string; skipRecord?: boolean } = {},
  ): DedupCheckResult {
    const now = opts.now ?? Date.now();
    const prev = this.store.get(totemId);

    // Se existe entrada e TTL não expirou E hash bate → duplicado
    if (prev && now - prev.sentAt <= this.ttlMs && prev.versionHash === versionHash) {
      return {
        isDuplicate: true,
        versionHash,
        ageMs: now - prev.sentAt,
        previousCacheKey: prev.lastCacheKey,
      };
    }

    if (!opts.skipRecord) {
      this.record(totemId, versionHash, { now, cacheKey: opts.cacheKey });
    }

    return {
      isDuplicate: false,
      versionHash,
    };
  }

  /** Grava explicitamente um hash como "enviado agora" (sem checagem). */
  record(totemId: number, versionHash: string, opts: { now?: number; cacheKey?: string } = {}): void {
    const now = opts.now ?? Date.now();
    // LRU: se vai estourar, remove o mais antigo (Map preserva ordem de inserção → first = oldest)
    if (this.store.size >= this.maxEntries && !this.store.has(totemId)) {
      const oldestKey = this.store.keys().next().value as number | undefined;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    // Remover e re-inserir para mover para o final (LRU)
    this.store.delete(totemId);
    this.store.set(totemId, {
      versionHash,
      sentAt: now,
      lastCacheKey: opts.cacheKey,
    });
  }

  /** Retorna entrada atual (debug). */
  peek(totemId: number): DedupEntry | undefined {
    return this.store.get(totemId);
  }

  /** Limpa entradas expiradas (chame periodicamente em workers / healthcheck). */
  evictExpired(now: number = Date.now()): number {
    let removed = 0;
    for (const [totemId, entry] of this.store) {
      if (now - entry.sentAt > this.ttlMs) {
        this.store.delete(totemId);
        removed++;
      }
    }
    return removed;
  }

  /** Reseta tudo (útil em testes). */
  reset(): void {
    this.store.clear();
  }
}

// =============================================================================
// 3) SINGLETON (instância padrão usada pelo dispatcherTotemService)
// =============================================================================

let _sharedDedup: DispatchDedupStore | null = null;

/** Instância global singleton do DispatchDedupStore (lazy init). */
export function getSharedDedupStore(opts?: DedupStoreOptions): DispatchDedupStore {
  if (!_sharedDedup) {
    _sharedDedup = new DispatchDedupStore(opts);
  }
  return _sharedDedup;
}

/** Só para testes: permite substituir / resetar o singleton. */
export function _testing_setSharedDedup(store: DispatchDedupStore | null): void {
  _sharedDedup = store;
}

// =============================================================================
// 4) DEDUP DE MÍDIA POR CONTENT-HASH (sem remover, só detectar)
// =============================================================================

export interface ContentHashDupInfo {
  /** Quantidade de duplicatas (apenas pares extras além do primeiro). */
  duplicateCount: number;
  /** Lista de contentHash que aparecem + de 1 vez, com os índices. */
  groups: Array<{
    contentHash: string;
    occurrences: number[];
  }>;
}

/**
 * Detecta duplicatas de mídia no plano com base no contentHash (não mediaId/url).
 * NÃO remove as duplicatas para não quebrar retrocompatibilidade; apenas marca
 * no objeto de retorno para validationDetails.
 */
export function detectDuplicateMediaByContentHash(
  mediaItems: Pick<DispatchMediaItem, 'contentHash' | 'mediaId' | 'url'>[] | null | undefined,
): ContentHashDupInfo {
  const info: ContentHashDupInfo = { duplicateCount: 0, groups: [] };
  if (!mediaItems || mediaItems.length === 0) return info;

  const groups = new Map<string, number[]>();
  mediaItems.forEach((item, idx) => {
    const h = item.contentHash;
    if (!h) return;
    const arr = groups.get(h);
    if (arr) arr.push(idx);
    else groups.set(h, [idx]);
  });

  for (const [contentHash, occurrences] of groups) {
    if (occurrences.length > 1) {
      info.duplicateCount += occurrences.length - 1;
      info.groups.push({ contentHash, occurrences: [...occurrences] });
    }
  }
  return info;
}


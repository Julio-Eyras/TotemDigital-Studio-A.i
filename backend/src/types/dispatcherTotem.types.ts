/**
 * Types for Dispatcher-Totem Module
 * Tipos e interfaces para o módulo Dispatcher-Totem
 */

import { Metadata } from './shared';

export interface DispatchRequest {
  totemId: number;
  timestamp?: Date | string; // Se não fornecido, usa NOW()
  timezone?: string; // Timezone do totem (opcional, usa do totem se não fornecido)
}

/** Verificações explicativas quando o DispatchPlan vem sem mídias (UI / debug). */
export interface DispatchEmptyCheck {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
}

export interface DispatchEmptyExplanation {
  summary: string;
  checks: DispatchEmptyCheck[];
  diagnosticsPath?: string;
}

export interface DispatchPlan {
  totemId: number;
  timestamp: Date;
  playlistId: number;
  playlistName: string;
  mediaItems: DispatchMediaItem[];
  totalDuration: number; // Duração total em segundos
  priority: number;
  source: 'direct' | 'group' | 'campaign' | 'mix';
  sourceId: number; // ID do agendamento/campanha ou mix_id se source='mix'
  sourceName?: string;
  validityStart: Date;
  validityEnd: Date;
  metadata: {
    resolution?: string;
    orientation?: 'landscape' | 'portrait';
    platform?: string;
    campaignId?: number;
    campaignTitle?: string;
    playlistItemsCount?: number;
    campaignMediaCount?: number;
    mergedItemsCount?: number;
    mixId?: number;
    mixVersion?: number;
    mixStrategy?: string;
    /** true quando o plano veio do 3º nível (propaganda padrão). */
    defaultAd?: boolean;
    /** Motivo legado (texto único). */
    noCandidatesReason?: string;
    diagnosticsUrl?: string;
    /** Diagnóstico estruturado para o Monitor Dispatcher. */
    emptyExplanation?: DispatchEmptyExplanation;
    [key: string]: unknown;
  };
  /** Detalhes estruturados de validação (dedup content-hash, avisos não-fatais). */
  validationDetails?: Metadata;
  cacheKey?: string;
  cacheExpiresAt?: Date;
  /**
   * Hash estável (SHA-256 truncado em 16 hex) da lista de mídias + ordem + duração.
   * Utilizado pelo DEDUP: se dois planos do mesmo totem gerarem o mesmo versionHash,
   * o último enviado é repetido (não publica MQTT/WebSocket, não grava log duplicado).
   * É mais estável do que timestamp/cacheKey porque ignora metadata transient.
   */
  versionHash?: string;
  /** true se este plano é idêntico ao último enviado para este totem (foi dedupado). */
  duplicateOfPrevious?: boolean;
}

export interface DispatchMediaItem {
  mediaId: number;
  order: number;
  /** Segundos de exposição (imagem/HTML). `null` em vídeo/áudio — duração real no player. */
  duration: number | null;
  url: string;
  mediaType: string;
  cacheBucket: 'propagandas' | 'vinhetas';
  /** Nome/título da mídia (medias.name). */
  mediaName?: string;
  /** Nome do ficheiro original (medias.file_name). */
  fileName?: string;
  metadata?: {
    width?: number;
    height?: number;
    mimeType?: string;
    /** Duração do ficheiro (vídeo/áudio) — só para totalDuration do plano, não para cortar no player. */
    durationSeconds?: number;
    [key: string]: unknown;
  };
  /** SHA-256 do conteúdo binário da mídia (só preenchido se ACE/FX instalados). */
  contentHash?: string;
}

export interface CandidateSchedule {
  campaignId: number;
  campaignTitle: string;
  playlistId: number;
  playlistName: string;
  mediaId?: number;
  mediaName?: string;
  priority: number;
  source: 'direct' | 'group' | 'campaign';
  sourceId: number;
  scope: 'totem' | 'group';
  groupSize?: number; // Tamanho do grupo (se aplicável)
  createdAt: Date;
  // Validações
  temporalValid: boolean;
  technicalValid: boolean;
  integrityValid: boolean;
  validationErrors?: string[];
  // Score para ordenação
  score: number;
  // Campos comerciais (Fase 1)
  commercialTier?: 'premium' | 'standard' | 'remnant';
  timeSharePercent?: number; // % de share de tempo (0-100)
  maxConsecutiveSlots?: number; // Máximo de slots consecutivos
  maxImpressionsPerHour?: number; // Máximo de impressões por hora
  subscriberId?: number; // ID do subscriber (anunciante)
  contractId?: number; // ID do contrato associado
}

export interface DispatchLogEntry {
  logId: number;
  totemId: number;
  timestamp: Date;
  // Identidade comercial
  subscriberId?: number;
  subscriberName?: string;
  publisherId?: number;
  publisherName?: string;
  selectedCampaignId?: number;
  selectedPlaylistId: number;
  selectedSource: 'direct' | 'group' | 'campaign';
  selectedSourceId: number;
  priority: number;
  candidatesCount: number;
  candidates: CandidateSchedule[];
  temporalValidation: boolean;
  technicalValidation: boolean;
  integrityValidation: boolean;
  validationDetails?: Metadata;
  fromCache: boolean;
  cacheKey?: string;
  dispatchPlan: DispatchPlan;
  executionTimeMs: number;
  createdAt: Date;
  /** Preenchido quando dispatcher detectou duplicata via versionHash. */
  skippedAsDuplicate?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number; // Time to live em segundos (padrão: 60 segundos)
  maxSize?: number; // Tamanho máximo do cache (opcional)
}

export interface DispatchOptions {
  skipCache?: boolean; // Forçar recalcular (ignorar cache)
  includeCandidates?: boolean; // Incluir lista de candidatos na resposta
  validateOnly?: boolean; // Apenas validar, não gerar plano
  /** Se false, desliga o dedup (força publicar / gravar log mesmo que idêntico). Default true. */
  enableDedup?: boolean;
}

export interface DispatchResponse {
  success: boolean;
  plan?: DispatchPlan;
  /** Fingerprint estável do conteúdo do plano (heartbeat / cache). */
  planVersion?: string;
  candidates?: CandidateSchedule[];
  fromCache?: boolean;
  /** true quando o plano já havia sido enviado antes (dedup poupou MQTT/WS/log). */
  deduplicated?: boolean;
  executionTimeMs: number;
  error?: string;
}

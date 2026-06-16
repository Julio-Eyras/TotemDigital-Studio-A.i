/**
 * Types for Dispatcher-Totem Module
 * Tipos e interfaces para o módulo Dispatcher-Totem
 */

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
  cacheKey?: string;
  cacheExpiresAt?: Date;
}

export interface DispatchMediaItem {
  mediaId: number;
  order: number;
  duration: number; // em segundos
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
    [key: string]: any;
  };
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
  validationDetails?: any;
  fromCache: boolean;
  cacheKey?: string;
  dispatchPlan: DispatchPlan;
  executionTimeMs: number;
  createdAt: Date;
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
}

export interface DispatchResponse {
  success: boolean;
  plan?: DispatchPlan;
  candidates?: CandidateSchedule[];
  fromCache?: boolean;
  executionTimeMs: number;
  error?: string;
}

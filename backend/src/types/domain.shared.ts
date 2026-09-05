/**
 * Domain Shared Types v1 - Smart Signage Pro v3.1
 *
 * Tipos canônicos das entidades de DOMÍNIO (não de DB row).
 * SÃO SEGUROS PARA COMPARTILHAR com frontend (sem campos internos).
 *
 * Objetivo:
 *   - Eliminar duplicação de interfaces entre backend ↔ frontend
 *   - Reduzir `any` nas camadas de API e Services
 *   - Fornecer fonte única de verdade para o futuro @shared/types
 *
 * Campos snake_case são campos retornados da API / DB.
 * Versão para frontend: use utilitário `snakeToCamel()` (será criado na Sprint 3).
 */

// ============================================================
// ENUMS CANÔNICOS (NÃO são string livre — use esses valores)
// ============================================================

/** Status operacional de um Totem / Player */
export type TotemStatus =
  | 'online'
  | 'offline'
  | 'error'
  | 'pending_approval'
  | 'activation_pending'
  | 'pending_activation'
  | 'deactivated';

/** Tipo de mídia suportado */
export type MediaType =
  | 'image'
  | 'video'
  | 'audio'
  | 'html'
  | 'pdf'
  | 'webpage'
  | 'stream'
  | 'publish_board_html'
  | 'menu_catalog';

/** Status de aprovação / workflow de mídia */
export type MediaStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'archived';

/** Status de ciclo de vida de Campanha */
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'canceled'
  | 'archived';

/** Status de Contrato */
export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'canceled'
  | 'suspended';

/** Tipo de usuário (usado pelo multi-tenant) */
export type UserType = 'system_user' | 'subscriber_user' | 'publisher_user';

/** Papel de usuário (Role) — valores canônicos usados no authorizeRole() */
export type UserRole =
  | 'owner_system'
  | 'admin_sql'
  | 'admin'
  | 'manager'
  | 'operator'
  | 'operador_tecnico'
  | 'operador_faturamento'
  | 'operador_comercial'
  | 'gerente_marketing'
  | 'editoracao'
  | 'visualizador'
  | 'publisher_user'
  | 'subscriber_user';

/** Perfil de instalação (installation profile) */
export type InstallationProfile = 'single_publisher' | 'multi_agency';

// ============================================================
// FLAGS SMART (10 flags booleanas por usuário)
// ============================================================

export interface UserSmartFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

// ============================================================
// ENTIDADES CANÔNICAS (camada API — respostas REST)
// ============================================================

/**
 * Usuário autenticado (AuthResponse.user + profile).
 * Campo `name` já vem calculado (name → first_name + last_name → username fallback).
 */
export interface ApiUser {
  id: number;
  username: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  user_type?: UserType;
  isActive: boolean;
  is_active?: boolean;
  /** Compat tenant: subscriber_user sempre tem subscriber_id preenchido */
  subscriberId?: number;
  subscriber_id?: number;
  subscriberName?: string;
  subscriber_name?: string;
  /** publisher_user / system_user sempre tem publisher_id em multi-tenant */
  publisherId?: number;
  publisher_id?: number;
  isTenantUser?: boolean;
  is_tenant_user?: boolean;
  flags?: Partial<UserSmartFlags>;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  lastLogin?: string;
  last_login?: string;
}

/**
 * Totem / Player — entidade principal de dispositivo.
 * NOTA: Este tipo TEM os campos retornados pela API de listagem.
 */
export interface ApiTotem {
  totemId: number;
  totem_id?: number;
  playerId?: number;
  player_id?: number;
  /** Nome de exibição (pode ser customizado por operador) */
  name: string;
  /** Identificador de parede (UIN — ex.: TD-ABCD-EFGH) */
  uin?: string;
  /** Identifier legado (MAC address ou hash de HW) */
  identifier?: string;
  /** Código de ativação mostrado no player antes de ser aprovado */
  activationCode?: string;
  activation_code?: string;
  status: TotemStatus;
  isActive: boolean;
  is_active?: boolean;
  /** FK: Local */
  localId?: number;
  local_id?: number;
  localName?: string;
  local_name?: string;
  /** FK: Publisher / Organização */
  publisherId?: number;
  publisher_id?: number;
  publisherName?: string;
  publisher_name?: string;
  /** (Direct Totem) — só um publisher por org modo Direct */
  directPublisherId?: number;
  direct_publisher_id?: number;
  /** Último heartbeat (ISO string, ou null se nunca conectou) */
  lastHeartbeat?: string | null;
  last_heartbeat?: string | null;
  /** Versão do player conectado */
  playerVersion?: string;
  player_version?: string;
  playerBuild?: string;
  player_build?: string;
  /** Plataforma do player (android | linux | webos | ios | electron | windows) */
  platform?: string;
  /** Orientação padrão (se mídia não declarar) */
  orientation?: 'landscape' | 'portrait';
  resolution?: string;
  /** Bloco de configuração livre (opacos) */
  config?: Record<string, unknown>;
  networkInfo?: Record<string, unknown>;
  network_info?: Record<string, unknown>;
  hardware?: Record<string, unknown>;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  /** Tags para filtro / grupos lógicos */
  tags?: string[];
  /** Grupos onde o totem está inserido (para campanha por group scope) */
  groupIds?: number[];
  group_ids?: number[];
  /** (campo calculado) - há dispositivo vinculado e ativo? */
  hasLinkedHardware?: boolean;
}

/**
 * Mídia do catálogo
 */
export interface ApiMedia {
  mediaId: number;
  media_id?: number;
  name: string;
  mediaType: MediaType;
  media_type?: MediaType;
  /** URL pública relativa (ex: /assets/2024/file.mp4) */
  filePath?: string;
  file_path?: string;
  /** URL de visualização (frontend resolve) */
  previewUrl?: string;
  preview_url?: string;
  /** URL thumbnail (capa 16:9) */
  thumbnailUrl?: string;
  thumbnail_url?: string;
  /** Tamanho em bytes */
  size: number;
  /** Duração em segundos (vídeo / áudio); imagem pode ter 0 (usa duração do agendamento) */
  durationSeconds?: number;
  duration_seconds?: number;
  /** Largura / Altura em px (imagem / vídeo) */
  width?: number;
  height?: number;
  /** Workflow */
  status: MediaStatus;
  approvalStatus?: MediaStatus;
  approval_status?: MediaStatus;
  /** Responsável (quem enviou / aprovou) */
  createdBy?: number;
  created_by?: number;
  updatedBy?: number;
  updated_by?: number;
  approvedBy?: number;
  approved_by?: number;
  /** Subscriber dono da mídia (se for mídia de anunciante) */
  subscriberId?: number;
  subscriber_id?: number;
  /** Publisher dono do acervo (modo Direct) */
  publisherId?: number;
  publisher_id?: number;
  /** Hash para detecção de duplicação (SHA-256 do conteúdo) */
  contentHash?: string;
  content_hash?: string;
  /** Content-Versioning do mediaTotemSyncService — troca a todos os totens quando muda */
  contentVersion?: string;
  content_version?: string;
  /** Tags para busca (ex: "promocao", "natal", "salao") */
  tags?: string[];
  /** Metadados livres (ex: artist, album, author, source) */
  metadata?: Record<string, unknown>;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  approvedAt?: string;
  approved_at?: string;
  /** Se a mídia é PUBLICA — qualquer subscriber pode reusar */
  isPublic?: boolean;
  is_public?: boolean;
}

/**
 * Anunciante / Subscriber (cliente que paga por publicidade)
 */
export interface ApiSubscriber {
  subscriberId: number;
  subscriber_id?: number;
  /** Legado: clientId = subscriberId */
  clientId?: number;
  client_id?: number;
  name: string;
  legalName?: string;
  legal_name?: string;
  taxId?: string;
  tax_id?: string;
  contactEmail?: string;
  contact_email?: string;
  contactPhone?: string;
  contact_phone?: string;
  contactName?: string;
  contact_name?: string;
  /** Endereço */
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zip_code?: string;
  /** Status operacional */
  isActive: boolean;
  is_active?: boolean;
  /** Billing: bloqueia publicação se fatura vencer + grace expirar */
  hasBillingPublishBlocked?: boolean;
  has_billing_publish_blocked?: boolean;
  hasBillingOverdue?: boolean;
  has_billing_overdue?: boolean;
  billingGraceExpiresAt?: string;
  billing_grace_expires_at?: string;
  /** Cotas — mídia / storage (GB) */
  storageQuotaBytes?: number;
  storage_quota_bytes?: number;
  storageUsedBytes?: number;
  storage_used_bytes?: number;
  mediaQuota?: number;
  media_quota?: number;
  mediaCount?: number;
  media_count?: number;
  /** Publisher que este subscriber pertence (SPA) */
  publisherId?: number;
  publisher_id?: number;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}

/**
 * Contrato comercial (Subscriber ↔ Publisher)
 * Vincula subscriber a um plano + cotas + datas.
 */
export interface ApiContract {
  contractId: number;
  contract_id?: number;
  /** Código externo / número do contrato */
  contractNumber?: string;
  contract_number?: string;
  contractTitle?: string;
  contract_title?: string;
  subscriberId: number;
  subscriber_id?: number;
  subscriberName?: string;
  subscriber_name?: string;
  publisherId?: number;
  publisher_id?: number;
  /** Plano (referência → plans.plan_code) */
  planId?: number;
  plan_id?: number;
  planCode?: string;
  plan_code?: string;
  planName?: string;
  plan_name?: string;
  /** Status */
  status: ContractStatus;
  /** Vigência */
  startsAt: string;
  starts_at?: string;
  endsAt?: string;
  ends_at?: string;
  /** Cotas financeiras / de veiculação */
  monthlyImpressionsQuota?: number;
  monthly_impressions_quota?: number;
  monthlyPlaysQuota?: number;
  monthly_plays_quota?: number;
  mediaSlotsQuota?: number;
  media_slots_quota?: number;
  activeTotemsQuota?: number;
  active_totems_quota?: number;
  /** Valores financeiros */
  monthlyValueCents?: number;
  monthly_value_cents?: number;
  setupFeeCents?: number;
  setup_fee_cents?: number;
  currency?: string;
  /** Pagamento recorrente */
  billingCycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  billing_cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  billingDayOfMonth?: number;
  billing_day_of_month?: number;
  /** Carimbo de tempos */
  isActive: boolean;
  is_active?: boolean;
  signedAt?: string;
  signed_at?: string;
  canceledAt?: string;
  canceled_at?: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  /** Cláusulas opcionais */
  autoRenew?: boolean;
  auto_renew?: boolean;
  notes?: string;
}

/**
 * Campanha publicitária
 */
export interface ApiCampaign {
  campaignId: number;
  campaign_id?: number;
  title: string;
  description?: string;
  subscriberId: number;
  subscriber_id?: number;
  subscriberName?: string;
  subscriber_name?: string;
  publisherId?: number;
  publisher_id?: number;
  contractId?: number;
  contract_id?: number;
  /** Status do ciclo de vida */
  status: CampaignStatus;
  /** Período de vigência (global da campanha) */
  startsAt?: string;
  starts_at?: string;
  endsAt?: string;
  ends_at?: string;
  /** Janela horária diária (HH:mm - HH:mm). Vazio = dia todo */
  dailyStartTime?: string;
  daily_start_time?: string;
  dailyEndTime?: string;
  daily_end_time?: string;
  /** Dias da semana (0=domingo … 6=sábado). Vazio = todos. */
  weekdaysEnabled?: number[];
  weekdays_enabled?: number[];
  /** Prioridade 0..100 — 100 > default 50; ACE pode somar mais um delta */
  priority?: number;
  /** Tipo de escopo: totens individuais OU grupos (não mistura) */
  scopeType?: 'totem' | 'group';
  scope_type?: 'totem' | 'group';
  totemIds?: number[];
  totem_ids?: number[];
  groupIds?: number[];
  group_ids?: number[];
  /** Mídias agendadas (ids) — apenas lista resumida */
  mediaIds?: number[];
  media_ids?: number[];
  mediaCount?: number;
  media_count?: number;
  /** KPIs — cota / atingido (opcionais, alguns perfis não expõem) */
  budgetCents?: number;
  budget_cents?: number;
  budgetSpentCents?: number;
  budget_spent_cents?: number;
  totalPlaysQuota?: number;
  total_plays_quota?: number;
  totalPlays?: number;
  total_plays?: number;
  /** Workflow */
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'not_required';
  approval_status?: 'pending' | 'approved' | 'rejected' | 'not_required';
  approvedBy?: number;
  approved_by?: number;
  approvedAt?: string;
  approved_at?: string;
  createdBy?: number;
  created_by?: number;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  /** Etiquetas de segmentação */
  tags?: string[];
  /** ACE / Smart — categorias alvo da campanha (opcional, só quando ACE instalado) */
  targetCategory?: 'PREMIUM' | 'STANDARD' | 'FILL';
  target_category?: 'PREMIUM' | 'STANDARD' | 'FILL';
  /** Se esta campanha é do tipo "vinheta" (intercalação automática) */
  isVinheta?: boolean;
  is_vinheta?: boolean;
}

// ============================================================
// ALIASES de retrocompatibilidade — até frontend migrar para novos nomes
// ============================================================

/** Player = Totem (alias). No dia-a-dia o time usa ambos os nomes. */
export type ApiPlayer = ApiTotem;

/** Subscriber = Client (alias legado do CRM). */
export type ApiClient = ApiSubscriber;

// ============================================================
// IDENTIFICAÇÃO DE CHAVES — para utilitários tipo getTotemIdFromRow()
// ============================================================

/** Qualquer objeto que tenha um totem identificável. */
export type TotemLikeRow = Partial<
  Pick<{ totemId: number; totem_id: number; playerId: number; player_id: number }, 'totemId' | 'totem_id' | 'playerId' | 'player_id'>
>;

/** Qualquer objeto que tenha uma mídia identificável. */
export type MediaLikeRow = Partial<
  Pick<{ mediaId: number; media_id: number }, 'mediaId' | 'media_id'>
>;

/** Qualquer objeto que tenha subscriber identificável. */
export type SubscriberLikeRow = Partial<
  Pick<{ subscriberId: number; subscriber_id: number; clientId: number; client_id: number }, 'subscriberId' | 'subscriber_id' | 'clientId' | 'client_id'>
>;

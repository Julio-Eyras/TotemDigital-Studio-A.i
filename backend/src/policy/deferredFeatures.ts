/**
 * Features documentadas mas incompletas — inactivas até versão futura.
 * API responde 501 FEATURE_DEFERRED; menu FE deve ocultar.
 */
export type DeferredFeatureId =
  | 'tags_crud'
  | 'notifications'
  | 'qr_code_scans'
  | 'facial_recognition'
  | 'ai_request_history'
  | 'system_backups';

export interface DeferredFeature {
  id: DeferredFeatureId;
  title: string;
  reason: string;
  /** target version / milestone label */
  deferredUntil: string;
}

export const DEFERRED_FEATURES: Record<DeferredFeatureId, DeferredFeature> = {
  tags_crud: {
    id: 'tags_crud',
    title: 'Tags (RFID/NFC/QR entity)',
    reason: 'Schema tags (tag_value/tipos hardware) desalinhado do serviço FE; não são labels de mídia.',
    deferredUntil: 'v6.x+',
  },
  notifications: {
    id: 'notifications',
    title: 'Notificações in-app',
    reason: 'Tabela notifications ausente no schema v2 definitivo.',
    deferredUntil: 'v6.x+',
  },
  qr_code_scans: {
    id: 'qr_code_scans',
    title: 'Histórico detalhado de scans QR',
    reason: 'Tabela qr_code_scans inexistente; contador agregado permanece activo.',
    deferredUntil: 'v6.x+',
  },
  facial_recognition: {
    id: 'facial_recognition',
    title: 'Reconhecimento facial',
    reason: 'Experimental / sem pacote de produto estável.',
    deferredUntil: 'v6.x+',
  },
  ai_request_history: {
    id: 'ai_request_history',
    title: 'Histórico persistente de pedidos IA',
    reason: 'ai_requests sem DDL no schema v2; generate/process continua disponível.',
    deferredUntil: 'v6.x+',
  },
  system_backups: {
    id: 'system_backups',
    title: 'Backups via API',
    reason: 'Tabela backups existe, mas não há UI de produto; API crua adiada até painel ops.',
    deferredUntil: 'v6.x+',
  },
};

export function isFeatureDeferred(id: DeferredFeatureId): boolean {
  return id in DEFERRED_FEATURES;
}

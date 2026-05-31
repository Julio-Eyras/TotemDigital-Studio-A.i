import type { PublishBoardPresetType } from '../services/publishBoardRenderService';

export interface PublishPresetDefaults {
  defaultTitle: string;
  accentColor: string;
  preferredOrientation: 'portrait' | 'landscape';
  defaultBlockOrder: string[];
  defaultContent: Record<string, string>;
  label: string;
}

const DEFAULTS: Record<PublishBoardPresetType, PublishPresetDefaults> = {
  menu: {
    label: 'Cardápio Digital',
    defaultTitle: 'Cardápio',
    accentColor: '#ff9800',
    preferredOrientation: 'portrait',
    defaultBlockOrder: [],
    defaultContent: {},
  },
  promotion: {
    label: 'Promoção',
    defaultTitle: 'Promoção do dia',
    accentColor: '#e91e63',
    preferredOrientation: 'landscape',
    defaultBlockOrder: ['headline', 'offer', 'price', 'urgency'],
    defaultContent: {
      headline: 'Oferta em destaque',
      offer: 'Promoção especial',
      price: 'R$ 29,90',
      urgency: 'Por tempo limitado',
    },
  },
  ad: {
    label: 'Anúncio',
    defaultTitle: 'Anúncio indoor',
    accentColor: '#1976d2',
    preferredOrientation: 'landscape',
    defaultBlockOrder: ['headline', 'brand', 'message', 'cta'],
    defaultContent: {
      headline: 'Anúncio de impacto',
      brand: 'Sua marca',
      message: 'Mensagem objetiva para tela cheia',
      cta: 'Saiba mais',
    },
  },
  announcement: {
    label: 'Comunicado',
    defaultTitle: 'Comunicado',
    accentColor: '#7b1fa2',
    preferredOrientation: 'landscape',
    defaultBlockOrder: ['headline', 'message', 'eventInfo'],
    defaultContent: {
      headline: 'Aviso importante',
      message: 'Comunicado para a comunidade e visitantes',
      eventInfo: 'Confira os detalhes na recepção',
    },
  },
  institutional: {
    label: 'Institucional',
    defaultTitle: 'Institucional',
    accentColor: '#2e7d32',
    preferredOrientation: 'landscape',
    defaultBlockOrder: ['headline', 'message', 'line1', 'line2', 'line3'],
    defaultContent: {
      headline: 'Presença de marca',
      message: 'Serviços e confiança no seu ambiente',
      line1: 'Atendimento de qualidade',
      line2: 'Experiência premium',
      line3: 'Sempre perto de você',
    },
  },
};

export function findPublishPreset(preset: PublishBoardPresetType): PublishPresetDefaults {
  return DEFAULTS[preset] ?? DEFAULTS.ad;
}

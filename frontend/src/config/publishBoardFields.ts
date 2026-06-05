import type { QuickPublishPreset } from '../services/api';
import { findPublishPreset, findPublishSegment, PUBLISH_PRESETS } from './publishTemplates';

export interface PublishBoardFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

export interface PublishBoardBlockDef {
  id: string;
  label: string;
  fields: PublishBoardFieldDef[];
}

export interface PublishBoardPresetUi {
  preset: QuickPublishPreset;
  usesProductCatalog: boolean;
  defaultTitle: string;
  blocks: PublishBoardBlockDef[];
  defaultBlockOrder: string[];
  defaultContent: Record<string, string>;
}

function buildDefaults(preset: QuickPublishPreset): Record<string, string> {
  const cfg = findPublishPreset(preset);
  const segment = findPublishSegment(
    preset === 'menu'
      ? 'restaurant'
      : preset === 'promotion'
        ? 'retail'
        : preset === 'announcement'
          ? 'church'
          : 'retail'
  );
  return {
    headline: cfg.headline,
    subtitle: segment.shortLabel,
    message: cfg.descriptionTemplate.slice(0, 120),
    offer: cfg.titleSuffix,
    price: '',
    urgency: 'Por tempo limitado',
    brand: segment.shortLabel,
    cta: 'Saiba mais',
    eventInfo: 'Confira na recepção',
    line1: cfg.bullets[0] || '',
    line2: cfg.bullets[1] || '',
    line3: cfg.bullets[2] || '',
    logoUrl: '',
  };
}

export const PUBLISH_BOARD_PRESETS: PublishBoardPresetUi[] = [
  {
    preset: 'menu',
    usesProductCatalog: true,
    defaultTitle: 'Cardápio',
    blocks: [],
    defaultBlockOrder: [],
    defaultContent: {},
  },
  {
    preset: 'promotion',
    usesProductCatalog: false,
    defaultTitle: 'Promoção do dia',
    defaultBlockOrder: ['headline', 'offer', 'price', 'urgency'],
    defaultContent: buildDefaults('promotion'),
    blocks: [
      {
        id: 'headline',
        label: 'Chamada',
        fields: [{ key: 'headline', label: 'Chamada principal', placeholder: 'Oferta em destaque' }],
      },
      {
        id: 'offer',
        label: 'Oferta',
        fields: [{ key: 'offer', label: 'Texto da oferta', placeholder: 'Combo família 2 pessoas' }],
      },
      {
        id: 'price',
        label: 'Preço',
        fields: [{ key: 'price', label: 'Preço em destaque', placeholder: 'R$ 29,90' }],
      },
      {
        id: 'urgency',
        label: 'Urgência',
        fields: [{ key: 'urgency', label: 'Urgência', placeholder: 'Só hoje!' }],
      },
    ],
  },
  {
    preset: 'ad',
    usesProductCatalog: false,
    defaultTitle: 'Anúncio indoor',
    defaultBlockOrder: ['logo', 'headline', 'brand', 'message', 'cta'],
    defaultContent: buildDefaults('ad'),
    blocks: [
      {
        id: 'logo',
        label: 'Logo',
        fields: [{ key: 'logoUrl', label: 'URL do logo (opcional)', placeholder: 'https://...' }],
      },
      {
        id: 'headline',
        label: 'Impacto',
        fields: [{ key: 'headline', label: 'Título principal', placeholder: 'Anúncio de impacto' }],
      },
      {
        id: 'brand',
        label: 'Marca',
        fields: [{ key: 'brand', label: 'Marca / nome', placeholder: 'Sua marca' }],
      },
      {
        id: 'message',
        label: 'Mensagem',
        fields: [{ key: 'message', label: 'Mensagem', multiline: true, placeholder: 'Mensagem objetiva' }],
      },
      {
        id: 'cta',
        label: 'Chamada',
        fields: [{ key: 'cta', label: 'Chamada para ação', placeholder: 'Visite-nos' }],
      },
    ],
  },
  {
    preset: 'announcement',
    usesProductCatalog: false,
    defaultTitle: 'Comunicado',
    defaultBlockOrder: ['headline', 'message', 'eventInfo'],
    defaultContent: buildDefaults('announcement'),
    blocks: [
      {
        id: 'headline',
        label: 'Título',
        fields: [{ key: 'headline', label: 'Título do comunicado', placeholder: 'Aviso importante' }],
      },
      {
        id: 'message',
        label: 'Mensagem',
        fields: [{ key: 'message', label: 'Texto', multiline: true }],
      },
      {
        id: 'eventInfo',
        label: 'Detalhe',
        fields: [{ key: 'eventInfo', label: 'Data / local / contato', placeholder: 'Sábado, 19h — salão principal' }],
      },
    ],
  },
  {
    preset: 'institutional',
    usesProductCatalog: false,
    defaultTitle: 'Institucional',
    defaultBlockOrder: ['logo', 'headline', 'message', 'line1', 'line2', 'line3'],
    defaultContent: buildDefaults('institutional'),
    blocks: [
      {
        id: 'logo',
        label: 'Logo',
        fields: [{ key: 'logoUrl', label: 'URL do logo (opcional)', placeholder: 'https://...' }],
      },
      {
        id: 'headline',
        label: 'Marca',
        fields: [{ key: 'headline', label: 'Título institucional', placeholder: 'Presença de marca' }],
      },
      {
        id: 'message',
        label: 'Mensagem',
        fields: [{ key: 'message', label: 'Texto principal', multiline: true }],
      },
      {
        id: 'line1',
        label: 'Destaque 1',
        fields: [{ key: 'line1', label: 'Linha 1' }],
      },
      {
        id: 'line2',
        label: 'Destaque 2',
        fields: [{ key: 'line2', label: 'Linha 2' }],
      },
      {
        id: 'line3',
        label: 'Destaque 3',
        fields: [{ key: 'line3', label: 'Linha 3' }],
      },
    ],
  },
];

export function findPublishBoardPresetUi(preset: QuickPublishPreset): PublishBoardPresetUi {
  return PUBLISH_BOARD_PRESETS.find((p) => p.preset === preset) ?? PUBLISH_BOARD_PRESETS[2];
}

export function resolvePublishBoardPreset(value: string | null): QuickPublishPreset {
  return PUBLISH_PRESETS.some((p) => p.value === value) ? (value as QuickPublishPreset) : 'ad';
}

/**
 * Fonte única de templates de publicação rápida (Studio Vx4).
 * Dashboard e QuickPublish importam daqui — evita divergência.
 */

import type { QuickPublishPreset } from '../services/api';

export type PublishOrientation = 'portrait' | 'landscape';

export interface PublishPresetConfig {
  value: QuickPublishPreset;
  label: string;
  description: string;
  headline: string;
  badge: string;
  accentColor: string;
  background: string;
  recommendedDurationMs: number;
  titleSuffix: string;
  descriptionTemplate: string;
  bullets: string[];
  preferredOrientation: PublishOrientation;
  premium?: boolean;
}

export interface PublishSegmentConfig {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  visualLanguage: string;
  defaultPreset: QuickPublishPreset;
  bullets: string[];
}

export interface FeaturedTemplateConfig {
  value: QuickPublishPreset;
  segment: string;
  title: string;
  description: string;
  /** MUI icon name key for dashboard cards */
  iconKey: 'storefront' | 'campaign' | 'tv' | 'auto_awesome' | 'business';
}

export const PUBLISH_PRESETS: PublishPresetConfig[] = [
  {
    value: 'menu',
    label: 'Cardápio Digital',
    description: 'Para cardápios, preços e ofertas do dia.',
    headline: 'Cardápio pronto para vender',
    badge: 'Restaurante',
    accentColor: '#ff9800',
    background: 'linear-gradient(135deg, #2b1400 0%, #7a3a00 100%)',
    recommendedDurationMs: 12000,
    titleSuffix: 'Cardápio do dia',
    descriptionTemplate:
      'Template de cardápio digital com foco em leitura rápida, preços claros e chamada para pedido.',
    bullets: ['Preços e combos', 'Visual vertical 9:16', 'Ideal para balcão e salão'],
    preferredOrientation: 'portrait',
    premium: true,
  },
  {
    value: 'promotion',
    label: 'Promoção',
    description: 'Para ofertas rápidas e chamadas comerciais.',
    headline: 'Oferta em destaque',
    badge: 'Venda rápida',
    accentColor: '#e91e63',
    background: 'linear-gradient(135deg, #2a0010 0%, #b0003a 100%)',
    recommendedDurationMs: 8000,
    titleSuffix: 'Promoção especial',
    descriptionTemplate: 'Template promocional para destacar oferta, preço e urgência de compra.',
    bullets: ['Chamada forte', 'Preço em evidência', 'Campanhas curtas'],
    preferredOrientation: 'landscape',
    premium: true,
  },
  {
    value: 'ad',
    label: 'Anúncio',
    description: 'Para mídia indoor e anúncios em tela cheia.',
    headline: 'Anúncio de impacto',
    badge: 'Indoor mídia',
    accentColor: '#1976d2',
    background: 'linear-gradient(135deg, #001a33 0%, #0d47a1 100%)',
    recommendedDurationMs: 10000,
    titleSuffix: 'Anúncio em tela',
    descriptionTemplate: 'Template padrão para anúncio em tela cheia com mídia principal e mensagem objetiva.',
    bullets: ['Tela cheia', 'Marca em destaque', 'Uso geral'],
    preferredOrientation: 'landscape',
  },
  {
    value: 'announcement',
    label: 'Comunicado',
    description: 'Para avisos, eventos e informações locais.',
    headline: 'Aviso claro na tela',
    badge: 'Comunicado',
    accentColor: '#7b1fa2',
    background: 'linear-gradient(135deg, #160021 0%, #6a1b9a 100%)',
    recommendedDurationMs: 9000,
    titleSuffix: 'Comunicado importante',
    descriptionTemplate:
      'Template para comunicação local com mensagem direta e leitura confortável à distância.',
    bullets: ['Informação direta', 'Eventos e avisos', 'Boa legibilidade'],
    preferredOrientation: 'landscape',
  },
  {
    value: 'institutional',
    label: 'Institucional',
    description: 'Para conteúdo fixo de marca ou ambiente.',
    headline: 'Presença de marca',
    badge: 'Marca',
    accentColor: '#2e7d32',
    background: 'linear-gradient(135deg, #001f12 0%, #1b5e20 100%)',
    recommendedDurationMs: 15000,
    titleSuffix: 'Institucional',
    descriptionTemplate: 'Template institucional para reforçar marca, serviços e presença no ambiente.',
    bullets: ['Marca e confiança', 'Conteúdo perene', 'Ambiente premium'],
    preferredOrientation: 'landscape',
  },
];

export const PUBLISH_SEGMENTS: PublishSegmentConfig[] = [
  {
    value: 'restaurant',
    label: 'Restaurante / Lancheria',
    shortLabel: 'Restaurante',
    description: 'Cardápios, combos, promoções e chamadas para pedido.',
    visualLanguage: 'preços legíveis, fotos apetitosas, contraste forte e leitura rápida no balcão.',
    defaultPreset: 'menu',
    bullets: ['Cardápio', 'Combos', 'Preço em destaque'],
  },
  {
    value: 'retail',
    label: 'Loja / Varejo',
    shortLabel: 'Varejo',
    description: 'Ofertas, vitrines digitais e anúncios de produto.',
    visualLanguage: 'mensagem direta, urgência comercial e destaque para produto ou marca.',
    defaultPreset: 'promotion',
    bullets: ['Oferta', 'Vitrine', 'Chamada rápida'],
  },
  {
    value: 'church',
    label: 'Igreja / Evento',
    shortLabel: 'Evento',
    description: 'Avisos, agenda, eventos e comunicação com a comunidade.',
    visualLanguage: 'comunicados claros, clima acolhedor e boa leitura à distância.',
    defaultPreset: 'announcement',
    bullets: ['Avisos', 'Agenda', 'Comunidade'],
  },
  {
    value: 'health',
    label: 'Clínica / Saúde',
    shortLabel: 'Clínica',
    description: 'Orientações, serviços, campanhas preventivas e avisos de recepção.',
    visualLanguage: 'tom confiável, visual limpo, informação objetiva e sensação de cuidado.',
    defaultPreset: 'institutional',
    bullets: ['Recepção', 'Orientações', 'Confiança'],
  },
  {
    value: 'hotel',
    label: 'Hotel / Recepção',
    shortLabel: 'Hotel',
    description: 'Boas-vindas, serviços, eventos internos e comunicação institucional.',
    visualLanguage: 'aparência premium, mensagens elegantes e foco em experiência do visitante.',
    defaultPreset: 'institutional',
    bullets: ['Boas-vindas', 'Serviços', 'Premium'],
  },
  {
    value: 'gym',
    label: 'Academia',
    shortLabel: 'Academia',
    description: 'Planos, aulas, desafios, motivação e campanhas de retenção.',
    visualLanguage: 'energia visual, ritmo forte, chamadas motivacionais e movimento.',
    defaultPreset: 'ad',
    bullets: ['Energia', 'Aulas', 'Planos'],
  },
];

export const FEATURED_TEMPLATES: FeaturedTemplateConfig[] = [
  { value: 'menu', segment: 'restaurant', title: 'Cardápio digital', description: 'Ideal para restaurantes, lancherias e balcões.', iconKey: 'storefront' },
  { value: 'promotion', segment: 'retail', title: 'Promoção do dia', description: 'Oferta direta para vender rápido na tela.', iconKey: 'campaign' },
  { value: 'ad', segment: 'gym', title: 'Anúncio indoor', description: 'Conteúdo de impacto para TVs e totens.', iconKey: 'tv' },
  { value: 'announcement', segment: 'church', title: 'Comunicado', description: 'Avisos, eventos e mensagens locais.', iconKey: 'auto_awesome' },
  { value: 'institutional', segment: 'retail', title: 'Institucional', description: 'Marca, serviços e presença fixa no ambiente.', iconKey: 'business' },
];

export const FEATURED_SEGMENT_CHIPS: { label: string; preset: QuickPublishPreset; segment: string }[] = [
  { label: 'Restaurante', preset: 'menu', segment: 'restaurant' },
  { label: 'Varejo', preset: 'promotion', segment: 'retail' },
  { label: 'Igreja / evento', preset: 'announcement', segment: 'church' },
  { label: 'Clínica', preset: 'institutional', segment: 'health' },
  { label: 'Hotel', preset: 'institutional', segment: 'hotel' },
  { label: 'Academia', preset: 'ad', segment: 'gym' },
];

export function findPublishPreset(value: QuickPublishPreset): PublishPresetConfig {
  return PUBLISH_PRESETS.find((p) => p.value === value) ?? PUBLISH_PRESETS[2];
}

export function resolvePublishPreset(value: string | null): QuickPublishPreset {
  return PUBLISH_PRESETS.some((p) => p.value === value) ? (value as QuickPublishPreset) : 'ad';
}

export function findPublishSegment(value: string): PublishSegmentConfig {
  return PUBLISH_SEGMENTS.find((s) => s.value === value) ?? PUBLISH_SEGMENTS[0];
}

export function buildTemplateTitle(
  template: PublishPresetConfig,
  subscriberName?: string | null,
  segment?: PublishSegmentConfig
): string {
  const parts = [template.titleSuffix, segment?.shortLabel, subscriberName].filter(Boolean);
  return parts.join(' - ');
}

export function buildTemplateDescription(
  template: PublishPresetConfig,
  segment?: PublishSegmentConfig
): string {
  const segmentGuidance = segment ? ` Contexto: ${segment.visualLanguage}.` : '';
  return `${template.descriptionTemplate} Direção visual: ${template.headline}.${segmentGuidance}`;
}

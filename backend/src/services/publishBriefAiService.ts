import { getAIServiceInstance } from '../utils/globalInstances';
import { findPublishPreset } from '../config/publishBoardDefaults';
import { subscriberHasAiTextAssist } from '../utils/publishPlanFeatures';
import type { PublishBoardPresetType } from './publishBoardRenderService';

export interface SuggestPublishCopyInput {
  subscriberId: number;
  userId?: number;
  preset: PublishBoardPresetType;
  segment?: string;
  segmentLabel?: string;
  visualLanguage?: string;
  boardTitle?: string;
  currentContent?: Record<string, string>;
}

export interface SuggestPublishCopyResult {
  content: Record<string, string>;
  summary?: string;
}

const PRESET_FIELD_HINTS: Record<PublishBoardPresetType, string[]> = {
  menu: [],
  promotion: ['headline', 'offer', 'price', 'urgency'],
  ad: ['headline', 'brand', 'message', 'cta'],
  announcement: ['headline', 'message', 'eventInfo'],
  institutional: ['headline', 'brand', 'line1', 'line2', 'line3'],
};

export class PublishBriefAiService {
  async suggestCopy(input: SuggestPublishCopyInput): Promise<SuggestPublishCopyResult> {
    const allowed = await subscriberHasAiTextAssist(input.subscriberId);
    if (!allowed) {
      throw new Error('Assistente de textos por IA não disponível no plano atual');
    }

    const presetMeta = findPublishPreset(input.preset);
    const keys = PRESET_FIELD_HINTS[input.preset] || Object.keys(input.currentContent || {});
    const current = input.currentContent || {};

    const prompt = `Você é redator de digital signage para negócios locais no Brasil.
Gere textos curtos, legíveis em TV, em português do Brasil.

Preset: ${presetMeta.label}
Segmento: ${input.segmentLabel || input.segment || 'geral'}
Direção visual: ${input.visualLanguage || presetMeta.label}
Título do quadro: ${input.boardTitle || presetMeta.defaultTitle}

Campos a preencher (JSON): ${keys.join(', ')}
Conteúdo atual (pode melhorar): ${JSON.stringify(current)}

Responda APENAS com JSON válido no formato:
{"content":{"campo":"valor",...},"summary":"uma frase sobre o tom escolhido"}
Sem markdown, sem explicação fora do JSON.`;

    const ai = getAIServiceInstance();
    const response = await ai.processRequest(
      {
        prompt,
        maxTokens: 600,
        temperature: 0.65,
        systemPrompt:
          'Você retorna somente JSON. Textos curtos para telas comerciais. Preços em formato R$ XX,XX quando aplicável.',
      },
      input.userId && input.userId > 0 ? input.userId : 0
    );

    const parsed = this.parseJsonResponse(response.response);
    const content: Record<string, string> = { ...current };
    if (parsed.content && typeof parsed.content === 'object') {
      for (const [k, v] of Object.entries(parsed.content)) {
        if (keys.length === 0 || keys.includes(k)) {
          content[k] = String(v ?? '').trim();
        }
      }
    }

    return {
      content,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    };
  }

  private parseJsonResponse(raw: string): { content?: Record<string, unknown>; summary?: string } {
    const text = String(raw || '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('IA não retornou JSON válido');
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error('IA não retornou JSON válido');
    }
  }
}

let instance: PublishBriefAiService | null = null;

export function getPublishBriefAiService(): PublishBriefAiService {
  if (!instance) instance = new PublishBriefAiService();
  return instance;
}

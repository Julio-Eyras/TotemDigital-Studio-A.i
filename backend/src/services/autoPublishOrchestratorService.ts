/**
 * Orquestrador Onda A: layout → (IA opcional) → render HTML → quick-publish.
 * Não altera quickPublishService; apenas compõe serviços existentes.
 */

import { getPublishBoardService, type PublishBoardLayout } from './publishBoardService';
import { getPublishBriefAiService } from './publishBriefAiService';
import { getQuickPublishService, type QuickPublishPreset, type QuickPublishResult } from './quickPublishService';
import { subscriberHasAiTextAssist } from '../utils/publishPlanFeatures';
import { logError } from '../utils/loggerHelper';
import type { PublishBoardPresetType } from './publishBoardRenderService';

export interface AutoPublishLayoutInput {
  boardTitle?: string;
  accentColor?: string;
  preferredOrientation?: 'portrait' | 'landscape';
  content?: Record<string, string>;
  blockOrder?: string[];
  productOrder?: number[];
  showPrices?: boolean;
}

export interface AutoPublishOrchestratorInput {
  subscriberId: number;
  contractId?: number | null;
  totemIds: number[];
  preset: PublishBoardPresetType;
  userId: number;
  isAdmin: boolean;
  layout?: AutoPublishLayoutInput;
  segment?: string;
  segmentLabel?: string;
  visualLanguage?: string;
  /** Quando true, tenta sugerir textos antes do render; falha de IA não bloqueia publicação. */
  useAi?: boolean;
  title?: string;
  description?: string;
  durationMs?: number;
  publishNow?: boolean;
  /** Reutiliza mídia HTML existente em vez de criar duplicata com o mesmo nome. */
  replaceMediaId?: number;
}

export interface AutoPublishOrchestratorResult {
  mediaId: number;
  mediaName: string;
  mediaType: string;
  publish: QuickPublishResult;
  aiApplied: boolean;
  aiWarning?: string;
  message: string;
}

function mergeLayout(current: PublishBoardLayout, patch?: AutoPublishLayoutInput): PublishBoardLayout {
  return {
    subscriberId: current.subscriberId,
    preset: current.preset,
    boardTitle: patch?.boardTitle ?? current.boardTitle,
    accentColor: patch?.accentColor ?? current.accentColor,
    preferredOrientation: patch?.preferredOrientation ?? current.preferredOrientation,
    content: patch?.content ? { ...current.content, ...patch.content } : current.content,
    blockOrder: Array.isArray(patch?.blockOrder) ? patch.blockOrder : current.blockOrder,
    productOrder: Array.isArray(patch?.productOrder) ? patch.productOrder : current.productOrder,
    showPrices: patch?.showPrices ?? current.showPrices,
  };
}

export class AutoPublishOrchestratorService {
  async run(input: AutoPublishOrchestratorInput): Promise<AutoPublishOrchestratorResult> {
    const boardService = getPublishBoardService();
    const preset = input.preset;
    let aiApplied = false;
    let aiWarning: string | undefined;

    let layout = await boardService.getLayout(input.subscriberId, preset);
    layout = mergeLayout(layout, input.layout);

    const useAi = input.useAi === true && preset !== 'menu';
    if (useAi) {
      const allowed = await subscriberHasAiTextAssist(input.subscriberId);
      if (allowed) {
        try {
          const suggested = await getPublishBriefAiService().suggestCopy({
            subscriberId: input.subscriberId,
            userId: input.userId,
            preset,
            segment: input.segment,
            segmentLabel: input.segmentLabel,
            visualLanguage: input.visualLanguage,
            boardTitle: layout.boardTitle,
            currentContent: layout.content,
          });
          layout = {
            ...layout,
            content: { ...layout.content, ...suggested.content },
          };
          aiApplied = true;
        } catch (error: any) {
          aiWarning = error?.message || 'IA indisponível; publicação segue com textos atuais.';
          await logError('Auto-publish: falha IA textos (continua sem IA)', error);
        }
      } else {
        aiWarning = 'Assistente de textos não disponível no plano atual.';
      }
    }

    await boardService.saveLayout(layout);

    const rendered = await boardService.renderToMediaHtml(
      input.subscriberId,
      preset,
      input.userId,
      input.isAdmin,
      input.replaceMediaId
    );

    const publishTitle = String(input.title || layout.boardTitle || '').trim();
    const publishResult = await getQuickPublishService().publish(
      {
        subscriberId: input.subscriberId,
        contractId: input.contractId,
        totemIds: input.totemIds,
        mediaIds: [rendered.mediaId],
        preset: preset as QuickPublishPreset,
        title: publishTitle,
        description: input.description,
        publishNow: input.publishNow,
        durationMs: input.durationMs,
      },
      input.userId
    );

    const baseMessage = publishResult.message || 'Conteúdo publicado com sucesso nas telas selecionadas.';
    const message = aiApplied
      ? `Propaganda gerada com IA e publicada. ${baseMessage}`
      : aiWarning
        ? `Propaganda gerada e publicada. ${aiWarning}`
        : `Propaganda gerada e publicada. ${baseMessage}`;

    return {
      mediaId: rendered.mediaId,
      mediaName: rendered.name,
      mediaType: rendered.mediaType,
      publish: publishResult,
      aiApplied,
      aiWarning,
      message,
    };
  }
}

let instance: AutoPublishOrchestratorService | null = null;

export function getAutoPublishOrchestratorService(): AutoPublishOrchestratorService {
  if (!instance) instance = new AutoPublishOrchestratorService();
  return instance;
}

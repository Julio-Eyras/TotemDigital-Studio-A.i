/**
 * Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
 * Eyras Sistemas e Soluções — Todos os direitos reservados.
 */

export const DIRECT_FIRST_PUBLISH_DISMISS_KEY = 'td.directFirstPublish.dismissed';

export type DirectFirstPublishSnapshot = {
  publisherCount: number;
  localCount: number;
  totemCount: number;
  mediaCount: number;
  publishedTotemCount: number;
  onlineTotemCount: number;
};

export type DirectFirstPublishStepId = 'org' | 'local' | 'totem' | 'media' | 'publish';

export type DirectFirstPublishStep = {
  id: DirectFirstPublishStepId;
  label: string;
  description: string;
  complete: boolean;
  path: string;
};

export function totemHasDirectMedia(totem: {
  media_count?: unknown;
  media_count_total?: unknown;
  mediaCount?: unknown;
  mediaCountTotal?: unknown;
}): boolean {
  const total = Number(
    totem.media_count_total ?? totem.mediaCountTotal ?? totem.media_count ?? totem.mediaCount ?? 0
  );
  return Number.isFinite(total) && total > 0;
}

export function isTotemOnlineStatus(totem: { status?: unknown }): boolean {
  return String(totem?.status || '').toLowerCase() === 'online';
}

export function snapshotFromLists(input: {
  publishers: Array<{ locals_count?: unknown; localsCount?: unknown }>;
  totems: Array<{
    status?: unknown;
    media_count?: unknown;
    media_count_total?: unknown;
    mediaCount?: unknown;
    mediaCountTotal?: unknown;
  }>;
  mediaCount: number;
  localFallbackCount?: number;
}): DirectFirstPublishSnapshot {
  const fromPublishers = input.publishers.reduce((sum, publisher) => {
    const n = Number(publisher.locals_count ?? publisher.localsCount ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const localCount =
    fromPublishers > 0 ? fromPublishers : Math.max(0, Number(input.localFallbackCount) || 0);

  return {
    publisherCount: input.publishers.length,
    localCount,
    totemCount: input.totems.length,
    mediaCount: Math.max(0, Number(input.mediaCount) || 0),
    publishedTotemCount: input.totems.filter(totemHasDirectMedia).length,
    onlineTotemCount: input.totems.filter(isTotemOnlineStatus).length,
  };
}

export function buildDirectFirstPublishSteps(
  snapshot: DirectFirstPublishSnapshot
): DirectFirstPublishStep[] {
  return [
    {
      id: 'org',
      label: 'Sua organização',
      description: 'Confirme os dados da loja (nome, contacto).',
      complete: snapshot.publisherCount > 0,
      path: '/publishers',
    },
    {
      id: 'local',
      label: 'Unidade / local',
      description: 'Abra a organização e crie pelo menos um local.',
      complete: snapshot.localCount > 0,
      path: '/publishers',
    },
    {
      id: 'totem',
      label: 'Totem',
      description: 'Crie o totem (+ Novo totem) e anote o UIN para a TV box.',
      complete: snapshot.totemCount > 0,
      path: '/publish-totem',
    },
    {
      id: 'media',
      label: 'Biblioteca',
      description: 'Carregue um cardápio ou promoção (imagem ou vídeo).',
      complete: snapshot.mediaCount > 0,
      path: '/media',
    },
    {
      id: 'publish',
      label: 'Publicar no totem',
      description: 'No card, Mídia → adicionar da biblioteca. A TV actualiza sozinha.',
      complete: snapshot.publishedTotemCount > 0,
      path: '/publish-totem',
    },
  ];
}

export function directFirstPublishProgress(steps: DirectFirstPublishStep[]): {
  completedCount: number;
  total: number;
  allComplete: boolean;
  nextStep: DirectFirstPublishStep | undefined;
  percent: number;
} {
  const completedCount = steps.filter((step) => step.complete).length;
  const total = steps.length;
  return {
    completedCount,
    total,
    allComplete: total > 0 && completedCount === total,
    nextStep: steps.find((step) => !step.complete),
    percent: total ? Math.round((completedCount / total) * 100) : 0,
  };
}

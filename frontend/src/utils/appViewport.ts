function hasUserActivation(): boolean {
  const nav = navigator as Navigator & { userActivation?: { isActive: boolean } };
  if (nav.userActivation) {
    return nav.userActivation.isActive;
  }
  return true;
}

export async function requestAppFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  if (!hasUserActivation()) {
    return false;
  }

  const el = document.documentElement;
  const legacy = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return Boolean(document.fullscreenElement);
    }
  } catch {
    /* gesto do usuário pode ter expirado */
  }

  try {
    if (legacy.webkitRequestFullscreen) {
      await legacy.webkitRequestFullscreen();
      return Boolean(document.fullscreenElement);
    }
  } catch {
    /* Safari / WebKit */
  }

  try {
    if (legacy.msRequestFullscreen) {
      await legacy.msRequestFullscreen();
      return Boolean(document.fullscreenElement);
    }
  } catch {
    /* IE / Edge legado */
  }

  return false;
}

export async function exitAppFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

/** Tenta entrar em tela cheia após login. */
export async function enterAdminSessionViewport(): Promise<void> {
  await requestAppFullscreen();
}

/** Restaura viewport padrão (telas públicas / logout). */
export async function leaveAdminSessionViewport(): Promise<void> {
  await exitAppFullscreen();
}

import { useEffect } from 'react';
import { requestAppFullscreen } from '../utils/appViewport';

/** Tenta fullscreen ao montar layout autenticado (ex.: refresh com sessão). */
export function useAdminViewport(): void {
  useEffect(() => {
    void requestAppFullscreen();
  }, []);
}

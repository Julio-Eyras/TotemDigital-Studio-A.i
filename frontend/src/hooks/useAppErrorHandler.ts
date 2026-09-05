/**
 * useAppErrorHandler.ts — HOOK CENTRALIZADO SPRINT 5
 *
 * Une o utilitário `pickApiErrorMessage` (extração legível) com o
 * `useNotification` hook (UI feedback) + fallback seguro para capturar
 * todos os níveis de erro em handlers de página/componente.
 *
 * - NÃO substitui `console.*` proposital em ErrorBoundary (não há dispatch
 *   disponível lá) e index.tsx (é filtro de ruído benigno).
 * - Substitui o padrão espalhado `try { ... } catch (e) { console.error(e); }`
 *   por notificação estruturada + fallback console apenas em DEV.
 *
 * Uso em componente de página:
 *
 *   const { handleError, notifySuccess, notifyInfo } = useAppErrorHandler();
 *   try {
 *     await salvar();
 *     notifySuccess('Alterações salvas com sucesso');
 *   } catch (e) {
 *     handleError(e, 'Falha ao salvar alterações');
 *   }
 */

import { useCallback } from 'react';
import { pickApiErrorMessage } from '../utils/apiErrorMessage';
import { useNotification } from './useNotification';

export type NotifyKind = 'success' | 'error' | 'warning' | 'info';

export interface HandleErrorOptions {
  /** Mensagem amigável mostrada na notificação como título. */
  title?: string;
  /** Fallback text se o pickApiErrorMessage não conseguir extrair nada. */
  fallbackMessage?: string;
  /** true → console.error em DEV (default true). */
  logInDev?: boolean;
}

export function useAppErrorHandler() {
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  const handleError = useCallback(
    (err: unknown, opts: HandleErrorOptions | string = {}) => {
      const options: HandleErrorOptions =
        typeof opts === 'string' ? { fallbackMessage: opts } : opts;
      const {
        title = 'Erro',
        fallbackMessage = 'Ocorreu um erro. Tente novamente ou contate o suporte.',
        logInDev = true,
      } = options;

      if (logInDev && process.env.NODE_ENV === 'development') {
        // Fallback apenas em DEV para não poluir console de produção.
        // eslint-disable-next-line no-console
        console.error('[useAppErrorHandler]', err);
      }

      const readable = pickApiErrorMessage(err, fallbackMessage);
      showError(readable, title);
    },
    [showError]
  );

  const notifySuccess = useCallback(
    (message: string, title?: string) => showSuccess(message, title),
    [showSuccess]
  );

  const notifyWarning = useCallback(
    (message: string, title?: string) => showWarning(message, title),
    [showWarning]
  );

  const notifyInfo = useCallback(
    (message: string, title?: string) => showInfo(message, title),
    [showInfo]
  );

  /**
   * Wrapper seguro para async handlers.
   * Em vez de: `onClick={async () => { try... } }`
   * Use:      `onClick={safeAsync(salvar, 'Falha ao salvar')}`
   */
  const safeAsync = useCallback(
    <TArgs extends unknown[]>(
      fn: (...args: TArgs) => Promise<void> | void,
      onError?: HandleErrorOptions | string,
      onSuccess?: string,
    ) =>
      async (...args: TArgs) => {
        try {
          await fn(...args);
          if (onSuccess) notifySuccess(onSuccess);
        } catch (e) {
          handleError(e, onError ?? 'Falha na operação');
        }
      },
    [handleError, notifySuccess]
  );

  return {
    handleError,
    notifySuccess,
    notifyWarning,
    notifyInfo,
    safeAsync,
  } as const;
}

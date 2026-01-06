/**
 * useRateLimit Hook - Smart Signage v2.1
 * Hook para lidar com rate limiting
 */

import { useEffect } from 'react';
import { useNotification } from './useNotification';

export const useRateLimit = () => {
  const { showWarning } = useNotification();

  useEffect(() => {
    const handleRateLimit = (event: CustomEvent) => {
      const { retryAfter, message } = event.detail;
      const retryAfterMinutes = retryAfter ? Math.ceil(retryAfter / 60) : 1;
      showWarning(message || `Muitas requisições. Aguarde ${retryAfterMinutes} minuto(s) antes de tentar novamente.`);
    };

    const handlePayloadTooLarge = (event: CustomEvent) => {
      const { message } = event.detail;
      showWarning(message || 'Arquivo ou dados muito grandes. Reduza o tamanho e tente novamente.');
    };

    const handleValidationError = (event: CustomEvent) => {
      const { message } = event.detail;
      showWarning(message || 'Erro de validação. Verifique os dados e tente novamente.');
    };

    window.addEventListener('rateLimitExceeded' as any, handleRateLimit as EventListener);
    window.addEventListener('payloadTooLarge' as any, handlePayloadTooLarge as EventListener);
    window.addEventListener('validationError' as any, handleValidationError as EventListener);

    return () => {
      window.removeEventListener('rateLimitExceeded' as any, handleRateLimit as EventListener);
      window.removeEventListener('payloadTooLarge' as any, handlePayloadTooLarge as EventListener);
      window.removeEventListener('validationError' as any, handleValidationError as EventListener);
    };
  }, [showWarning]);
};


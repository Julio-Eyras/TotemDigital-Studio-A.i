/**
 * Logging API - Frontend
 * Serviço para enviar logs de erro do frontend para o backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Envia erro do frontend para o backend
 */
export async function logFrontendError(
  error: Error,
  errorInfo?: React.ErrorInfo,
  context?: Record<string, any>
): Promise<void> {
  try {
    // Não bloquear a UI se o log falhar
    await axios.post(
      `${API_BASE_URL}/logs/frontend-error`,
      {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        errorInfo: errorInfo ? {
          componentStack: errorInfo.componentStack,
        } : null,
        context: {
          ...context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        },
      },
      {
        timeout: 3000, // Timeout curto para não bloquear
      }
    );
  } catch (logError) {
    // Silenciosamente falhar - não queremos que o logging cause mais erros
    // Em desenvolvimento, ainda logar no console
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to send error to backend:', logError);
    }
  }
}



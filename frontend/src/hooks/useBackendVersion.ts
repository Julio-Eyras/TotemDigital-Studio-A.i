import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Lê a versão instalada do backend via GET /api/health (público).
 */
export function useBackendVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get<{ version?: string }>('/health', {
          validateStatus: (status) => status === 200 || status === 503,
        });
        const v = res.data?.version;
        if (!cancelled && v) {
          setVersion(String(v));
        }
      } catch {
        // Mantém null se a API não responder
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '../services/api';
import {
  defaultInstallationCapabilities,
  InstallationCapabilities,
} from '../types/installationCapabilities';
import { setInstallationCapabilities as setGlobalCapabilities } from '../config/installationCapabilities';

const InstallationCapabilitiesContext = createContext<InstallationCapabilities>(
  defaultInstallationCapabilities()
);

export const InstallationCapabilitiesProvider: React.FC<{
  children: React.ReactNode;
  enabled?: boolean;
}> = ({ children, enabled = true }) => {
  const [capabilities, setCapabilities] = useState<InstallationCapabilities>(
    defaultInstallationCapabilities()
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const ctx = await dashboardApi.getUiContext();
        if (cancelled) return;
        const caps = ctx.capabilities ?? defaultInstallationCapabilities();
        setCapabilities(caps);
        setGlobalCapabilities(caps);
      } catch {
        const fallback = defaultInstallationCapabilities();
        if (!cancelled) {
          setCapabilities(fallback);
          setGlobalCapabilities(fallback);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const value = useMemo(() => capabilities, [capabilities]);

  return (
    <InstallationCapabilitiesContext.Provider value={value}>
      {children}
    </InstallationCapabilitiesContext.Provider>
  );
};

export function useInstallationCapabilities(): InstallationCapabilities {
  return useContext(InstallationCapabilitiesContext);
}

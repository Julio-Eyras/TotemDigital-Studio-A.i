import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { dashboardApi } from '../services/api';
import {
  defaultInstallationCapabilities,
  InstallationCapabilities,
} from '../types/installationCapabilities';
import { setInstallationCapabilities as setGlobalCapabilities } from '../config/installationCapabilities';

type InstallationCapabilitiesContextValue = {
  capabilities: InstallationCapabilities;
  isReady: boolean;
};

const InstallationCapabilitiesContext = createContext<InstallationCapabilitiesContextValue>({
  capabilities: defaultInstallationCapabilities(),
  isReady: false,
});

export const InstallationCapabilitiesProvider: React.FC<{
  children: React.ReactNode;
  enabled?: boolean;
}> = ({ children, enabled = true }) => {
  const [capabilities, setCapabilities] = useState<InstallationCapabilities>(
    defaultInstallationCapabilities()
  );
  const [isReady, setIsReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }
    let cancelled = false;
    setIsReady(false);

    (async () => {
      try {
        const ctx = await dashboardApi.getUiContext();
        if (cancelled) return;
        const caps = {
          ...defaultInstallationCapabilities(),
          ...(ctx.capabilities ?? {}),
        };
        setCapabilities(caps);
        setGlobalCapabilities(caps);
      } catch {
        const fallback = defaultInstallationCapabilities();
        if (!cancelled) {
          setCapabilities(fallback);
          setGlobalCapabilities(fallback);
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const value = useMemo(() => ({ capabilities, isReady }), [capabilities, isReady]);

  if (!isReady) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <InstallationCapabilitiesContext.Provider value={value}>
      {children}
    </InstallationCapabilitiesContext.Provider>
  );
};

export function useInstallationCapabilities(): InstallationCapabilities {
  return useContext(InstallationCapabilitiesContext).capabilities;
}

export function useInstallationCapabilitiesReady(): boolean {
  return useContext(InstallationCapabilitiesContext).isReady;
}

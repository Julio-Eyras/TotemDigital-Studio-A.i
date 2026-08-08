import React from 'react';
import { Typography, SxProps, Theme } from '@mui/material';
import { FRONT_VERSION } from '../../config/version';
import { useBackendVersion } from '../../hooks/useBackendVersion';
import { useInstallationCapabilities } from '../../contexts/InstallationCapabilitiesContext';
import {
  getInstallationModeLabel,
  resolveInstallationMode,
} from '../../utils/installationMode';

type AppVersionLinesProps = {
  /** Estilos extras (ex.: cor branca no header do login). */
  sx?: SxProps<Theme>;
  /** Exibe o modo operacional activo no branding do painel autenticado. */
  showInstallationMode?: boolean;
};

/**
 * Linhas Back/Front sob o texto de branding ("Sistema de Sinalização Digital").
 */
const AppVersionLines: React.FC<AppVersionLinesProps> = ({ sx, showInstallationMode = false }) => {
  const backendVersion = useBackendVersion();
  const installationCapabilities = useInstallationCapabilities();
  const activeMode = resolveInstallationMode(installationCapabilities);

  return (
    <Typography
      variant="caption"
      component="div"
      sx={[
        {
          display: 'block',
          lineHeight: 1.4,
          mt: 0.5,
          opacity: 0.9,
          color: 'text.secondary',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      Back: {backendVersion || '…'}
      <br />
      Front: {FRONT_VERSION}
      {showInstallationMode && (
        <>
          <br />
          Modo: {getInstallationModeLabel(activeMode)}
        </>
      )}
    </Typography>
  );
};

export default AppVersionLines;

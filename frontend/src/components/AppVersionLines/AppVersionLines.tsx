import React from 'react';
import { Typography, SxProps, Theme } from '@mui/material';
import { FRONT_VERSION } from '../../config/version';
import { useBackendVersion } from '../../hooks/useBackendVersion';

type AppVersionLinesProps = {
  /** Estilos extras (ex.: cor branca no header do login). */
  sx?: SxProps<Theme>;
};

/**
 * Linhas Back/Front sob o texto de branding ("Sistema de Sinalização Digital").
 */
const AppVersionLines: React.FC<AppVersionLinesProps> = ({ sx }) => {
  const backendVersion = useBackendVersion();

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
    </Typography>
  );
};

export default AppVersionLines;

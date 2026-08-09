import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, LinearProgress, Typography } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { TelemetryObservationLease, totemApi } from '../../services/api';
import {
  formatNextMediaLine,
  formatPlaybackMedia,
  formatPlaybackTiming,
  normalizePlaybackState,
  playbackElapsedMs,
  TotemPlaybackState,
} from '../../utils/playbackTelemetry';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import type {
  PlaybackConnectionStatus,
  TotemObservationSample,
} from '../../hooks/useTotemPlaybackTelemetry';

interface Props {
  totemId: number;
  state?: TotemPlaybackState;
  fallback?: unknown;
  observationSample?: TotemObservationSample;
  offline?: boolean;
  enabled?: boolean;
  connectionStatus?: PlaybackConnectionStatus;
}

function leaseExpiry(lease: TelemetryObservationLease): string | undefined {
  return lease.expiresAt ?? lease.expires_at;
}

const TotemPlaybackStatus: React.FC<Props> = ({
  totemId,
  state,
  fallback,
  observationSample,
  offline = false,
  enabled = true,
  connectionStatus = 'connecting',
}) => {
  const [now, setNow] = useState(Date.now());
  const [lease, setLease] = useState<TelemetryObservationLease | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [leaseStartedAt, setLeaseStartedAt] = useState<number | null>(null);
  const playback = useMemo(
    () => state ?? normalizePlaybackState(fallback, totemId) ?? undefined,
    [fallback, state, totemId],
  );

  useEffect(() => {
    if (!enabled || !playback || playback.status !== 'playing' || playback.stale) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, playback]);

  const observe = async () => {
    try {
      setBusy(true);
      setLeaseError(null);
      const next = lease
        ? await totemApi.renewTelemetryObservation(totemId, 120)
        : await totemApi.startTelemetryObservation(totemId, 120);
      setLease(next);
      setLeaseStartedAt(Date.now());
    } catch (error) {
      setLeaseError(pickApiErrorMessage(error, 'Não foi possível observar a telemetria'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    try {
      setBusy(true);
      setLeaseError(null);
      await totemApi.stopTelemetryObservation(totemId);
      setLease(null);
      setLeaseStartedAt(null);
    } catch (error) {
      setLeaseError(pickApiErrorMessage(error, 'Não foi possível parar a observação'));
    } finally {
      setBusy(false);
    }
  };

  const expiry = lease ? leaseExpiry(lease) : undefined;
  const observationReceived =
    Boolean(observationSample?.occurredAt) &&
    (!leaseStartedAt || Date.parse(observationSample!.occurredAt) >= leaseStartedAt);
  const awaiting =
    lease &&
    (lease.awaitingHeartbeat ?? lease.awaiting_heartbeat ?? !observationReceived);
  const percent = playback?.durationMs
    ? Math.min(100, (playbackElapsedMs(playback, now) / playback.durationMs) * 100)
    : 0;
  const displayOff = playback?.status === 'display_off';
  const systemState = displayOff || playback?.status === 'idle';

  if (!enabled) {
    return (
      <Box sx={{ mt: 1.25 }} onClick={(event) => event.stopPropagation()}>
        <Typography variant="body2" color="warning.main" fontWeight={700}>
          Totem desabilitado
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Telemetria em tempo real e diagnóstico desativados.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ mt: 1.25 }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {playback ? (
        <>
          <Typography
            variant="body2"
            fontWeight={700}
            title={systemState ? playback.mediaName : formatPlaybackMedia(playback.mediaId, playback.mediaName)}
            noWrap
          >
            {systemState ? playback.mediaName : formatPlaybackMedia(playback.mediaId, playback.mediaName)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {formatPlaybackTiming(playback, now)}
          </Typography>
          {playback.durationMs > 0 && <LinearProgress variant="determinate" value={percent} sx={{ mt: 0.5 }} />}
            {!systemState && playback.nextMedia && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              title={formatNextMediaLine(playback.nextMedia)}
              noWrap
              sx={{ mt: 0.5 }}
            >
              {formatNextMediaLine(playback.nextMedia)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {playback.mediaType && <Chip size="small" variant="outlined" label={playback.mediaType} />}
            {offline && <Chip size="small" color="default" label="Offline" />}
            <Chip
              size="small"
              color={
                playback.stale || displayOff
                  ? 'warning'
                  : playback.status === 'error'
                    ? 'error'
                    : 'success'
              }
              label={
                playback.stale
                  ? `${playback.status} · estado desatualizado`
                  : displayOff
                    ? 'Tela off'
                    : playback.status
              }
            />
            <Chip
              size="small"
              variant="outlined"
              color={connectionStatus === 'connected' ? 'success' : 'warning'}
              label={
                connectionStatus === 'connected'
                  ? 'Tempo real conectado'
                  : connectionStatus === 'connecting'
                    ? 'Conectando tempo real'
                    : 'Fallback REST'
              }
            />
          </Box>
          {(offline || playback.stale) && (
            <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
              {offline
                ? `Totem offline · exibindo o último estado${playback.stale ? ' desatualizado' : ' recebido'}`
                : 'Estado de reprodução desatualizado'}
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" color={offline ? 'warning.main' : 'text.secondary'}>
          {offline ? 'Totem offline · sem estado de reprodução recente' : 'Sem estado de reprodução recente'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
        Estado normal por eventos/WebSocket, independente do diagnóstico.
      </Typography>
      <Box sx={{ mt: 1, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant={lease ? 'outlined' : 'text'}
            startIcon={<Visibility />}
            disabled={busy}
            onClick={() => void observe()}
          >
            {lease ? 'Renovar diagnóstico' : 'Diagnóstico ao vivo'}
          </Button>
          {lease && (
            <Button
              size="small"
              color="inherit"
              startIcon={<VisibilityOff />}
              disabled={busy}
              onClick={() => void stop()}
            >
              Parar
            </Button>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          Opcional; não interfere no estado de reprodução acima.
        </Typography>
      </Box>
      {lease && (
        <Typography variant="caption" color={awaiting ? 'warning.main' : 'success.main'} display="block">
          {awaiting ? 'Diagnóstico ativo · aguardando amostra' : 'Diagnóstico ativo'}
          {expiry ? ` até ${new Date(expiry).toLocaleTimeString('pt-BR', { hour12: false })}` : ' por 120s'}
          {!awaiting && observationSample?.occurredAt
            ? ` · amostra ${new Date(observationSample.occurredAt).toLocaleTimeString('pt-BR', { hour12: false })}`
            : ''}
        </Typography>
      )}
      {leaseError && <Typography variant="caption" color="error.main">{leaseError}</Typography>}
    </Box>
  );
};

export default TotemPlaybackStatus;

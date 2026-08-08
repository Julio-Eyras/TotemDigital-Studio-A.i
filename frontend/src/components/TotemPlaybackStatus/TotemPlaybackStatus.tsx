import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, LinearProgress, Typography } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { TelemetryObservationLease, totemApi } from '../../services/api';
import {
  formatPlaybackLine,
  normalizePlaybackState,
  playbackElapsedMs,
  TotemPlaybackState,
} from '../../utils/playbackTelemetry';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import type { TotemObservationSample } from '../../hooks/useTotemPlaybackTelemetry';

interface Props {
  totemId: number;
  state?: TotemPlaybackState;
  fallback?: unknown;
  observationSample?: TotemObservationSample;
}

function leaseExpiry(lease: TelemetryObservationLease): string | undefined {
  return lease.expiresAt ?? lease.expires_at;
}

const TotemPlaybackStatus: React.FC<Props> = ({ totemId, state, fallback, observationSample }) => {
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
    if (!playback || playback.status !== 'playing' || playback.stale) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [playback]);

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

  return (
    <Box
      sx={{ mt: 1.25 }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {playback ? (
        <>
          <Typography variant="body2" title={formatPlaybackLine(playback, now)} noWrap>
            {formatPlaybackLine(playback, now)}
          </Typography>
          {playback.durationMs > 0 && <LinearProgress variant="determinate" value={percent} sx={{ mt: 0.5 }} />}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {playback.mediaType && <Chip size="small" variant="outlined" label={playback.mediaType} />}
            <Chip
              size="small"
              color={playback.stale ? 'warning' : playback.status === 'error' ? 'error' : 'success'}
              label={playback.stale ? `${playback.status} · desatualizado` : playback.status}
            />
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">Sem estado de reprodução recente</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.75, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant={lease ? 'outlined' : 'text'}
          startIcon={<Visibility />}
          disabled={busy}
          onClick={() => void observe()}
        >
          {lease ? 'Renovar observação' : 'Observar ao vivo'}
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
      {lease && (
        <Typography variant="caption" color={awaiting ? 'warning.main' : 'success.main'} display="block">
          {awaiting ? 'Lease ativo · aguardando heartbeat' : 'Lease ativo'}
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

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, Divider, Grid, LinearProgress, Typography } from '@mui/material';
import { ExpandLess, ExpandMore, Visibility, VisibilityOff } from '@mui/icons-material';
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBytes(value: unknown): string {
  const bytes = numberValue(value);
  if (bytes === null || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatPosition(value: unknown): string {
  const milliseconds = numberValue(value);
  if (milliseconds === null || milliseconds < 0) return '—';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function exoStateLabel(value: unknown): string {
  switch (numberValue(value)) {
    case 1: return 'Idle';
    case 2: return 'Buffering';
    case 3: return 'Ready';
    case 4: return 'Ended';
    default: return 'Desconhecido';
  }
}

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{value ?? '—'}</Typography>
  </Box>
);

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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
      setDetailsOpen(true);
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
      setDetailsOpen(false);
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
  const metrics = record(observationSample?.metrics);
  const nowPlaying = record(metrics.nowPlaying);
  const playerSettings = record(metrics.playerSettings);
  const deviceClock = record(metrics.deviceClock);
  const storageFreePercent = numberValue(metrics.storageFreePercent);
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
        <>
          <Typography variant="caption" color={awaiting ? 'warning.main' : 'success.main'} display="block">
            {awaiting ? 'Diagnóstico ativo · aguardando amostra' : 'Diagnóstico ativo'}
            {expiry ? ` até ${new Date(expiry).toLocaleTimeString('pt-BR', { hour12: false })}` : ' por 120s'}
            {!awaiting && observationSample?.occurredAt
              ? ` · amostra ${new Date(observationSample.occurredAt).toLocaleTimeString('pt-BR', { hour12: false })}`
              : ''}
          </Typography>
          {!awaiting && observationReceived && (
            <>
              <Button
                size="small"
                color="inherit"
                endIcon={detailsOpen ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setDetailsOpen((open) => !open)}
                sx={{ mt: 0.5 }}
              >
                {detailsOpen ? 'Ocultar métricas' : 'Exibir métricas'}
              </Button>
              <Collapse in={detailsOpen}>
                <Box
                  sx={{
                    mt: 0.75,
                    p: 1.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="subtitle2">Reprodução e ExoPlayer</Typography>
                  <Grid container spacing={1.25} sx={{ mt: 0.1 }}>
                    <Grid item xs={6}><Metric label="Estado" value={exoStateLabel(metrics.exoPlaybackState)} /></Grid>
                    <Grid item xs={6}><Metric label="Tela" value={metrics.displayIdle === true ? 'Desligada' : 'Ligada'} /></Grid>
                    <Grid item xs={6}><Metric label="Posição" value={formatPosition(metrics.exoPositionMs)} /></Grid>
                    <Grid item xs={6}><Metric label="Buffer" value={formatPosition(metrics.exoBufferedPositionMs)} /></Grid>
                    <Grid item xs={12}><Metric label="Mídia atual" value={String(nowPlaying.name ?? nowPlaying.mediaName ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="ID da mídia" value={String(nowPlaying.mediaId ?? nowPlaying.id ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="Plano" value={String(metrics.planVersion ?? '—')} /></Grid>
                  </Grid>
                  <Divider sx={{ my: 1.25 }} />
                  <Typography variant="subtitle2">Saúde e armazenamento</Typography>
                  <Grid container spacing={1.25} sx={{ mt: 0.1 }}>
                    <Grid item xs={6}><Metric label="Heap usado" value={formatBytes(metrics.heapUsedBytes)} /></Grid>
                    <Grid item xs={6}><Metric label="Heap máximo" value={formatBytes(metrics.heapMaxBytes)} /></Grid>
                    <Grid item xs={6}>
                      <Metric
                        label="Espaço livre"
                        value={storageFreePercent === null ? '—' : `${storageFreePercent.toFixed(1)}%`}
                      />
                    </Grid>
                    <Grid item xs={6}><Metric label="Cache usado" value={formatBytes(metrics.cacheSizeBytes)} /></Grid>
                    <Grid item xs={6}><Metric label="Mídias em cache" value={String(metrics.propagandasCacheValidCount ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="Limite do cache" value={formatBytes(metrics.maxCacheSizeBytes)} /></Grid>
                  </Grid>
                  <Divider sx={{ my: 1.25 }} />
                  <Typography variant="subtitle2">Dispositivo e configuração</Typography>
                  <Grid container spacing={1.25} sx={{ mt: 0.1 }}>
                    <Grid item xs={6}><Metric label="Player" value={String(metrics.player ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="Plataforma" value={String(metrics.platform ?? '—')} /></Grid>
                    <Grid item xs={12}><Metric label="Device ID" value={String(metrics.deviceId ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="Rotação" value={String(metrics.displayRotation ?? '—')} /></Grid>
                    <Grid item xs={6}><Metric label="Kiosk" value={String(metrics.kioskMode ?? '—')} /></Grid>
                    <Grid item xs={6}>
                      <Metric
                        label="Heartbeat"
                        value={
                          playerSettings.batimentoCardiaco == null
                            ? '—'
                            : `${String(playerSettings.batimentoCardiaco)}s`
                        }
                      />
                    </Grid>
                    <Grid item xs={6}><Metric label="Horário TV Box" value={String(deviceClock.localFormatted ?? '—')} /></Grid>
                  </Grid>
                </Box>
              </Collapse>
            </>
          )}
        </>
      )}
      {leaseError && <Typography variant="caption" color="error.main">{leaseError}</Typography>}
    </Box>
  );
};

export default TotemPlaybackStatus;

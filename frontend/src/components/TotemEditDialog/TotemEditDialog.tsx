import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import { useNavigate } from 'react-router-dom';
import { labSystemApi, totemApi, UpdatePlayerRequest } from '../../services/api';
import { getTotemIdFromRow, getTotemLocalIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  DEFAULT_DISPLAY_SCHEDULE,
  DEFAULT_POLL_ADAPTIVE,
  DISPLAY_SCHEDULE_DAY_OPTIONS,
  DeviceClockInfo,
  DisplayScheduleInfo,
  PollAdaptiveInfo,
  normalizeHmInput,
  readDeviceClockFromTotem,
  readPollAdaptiveFromTotem,
  readScheduleFromTotem,
} from '../../utils/totemDisplaySchedule';
import { DEFAULT_FILL, readTdepFillFromTotem, tdepFillPayload, TdepFillForm } from '../../utils/totemTdepFill';
import { buildLabTickBody, summarizeLabTick } from '../../utils/labSystemTick';

export interface TotemEditDialogProps {
  open: boolean;
  totem: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

type DisplayScheduleForm = DisplayScheduleInfo;
type PollAdaptiveForm = PollAdaptiveInfo;

type PlayerAdForm = {
  serverUrl: string;
  deviceId: string;
  displayRotation: number;
  kioskMode: 'strong' | 'immersive';
  acceptImagesInPlaylist: boolean;
  allowPlaybackAudio: boolean;
  /** 0 = off, 1 = on — véu preto na troca de mídia (Player-AD). */
  mediaTransitionEnabled: number;
  batimentoCardiaco: number;
  maxSecondsWithoutServerCheck: number;
  storage: string;
  storagePathOverride: string;
  maxCacheSizeMb: number;
  maxCachePercentOfVolume: string;
  allowIdentityChange: boolean;
};

const DAY_OPTIONS = DISPLAY_SCHEDULE_DAY_OPTIONS;

const TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'UTC',
];

const DEFAULT_SCHEDULE = DEFAULT_DISPLAY_SCHEDULE;

const DEFAULT_PLAYER_AD: PlayerAdForm = {
  serverUrl: 'https://totemdigital.app.br',
  deviceId: '',
  displayRotation: 0,
  kioskMode: 'strong',
  acceptImagesInPlaylist: true,
  allowPlaybackAudio: false,
  mediaTransitionEnabled: 1,
  batimentoCardiaco: 30,
  maxSecondsWithoutServerCheck: 180,
  storage: 'external_primary',
  storagePathOverride: '',
  maxCacheSizeMb: 1000,
  maxCachePercentOfVolume: '',
  allowIdentityChange: false,
};

function orientationLabel(rotation: number): string {
  switch (((rotation % 4) + 4) % 4) {
    case 1:
      return '90° paisagem';
    case 2:
      return '180° retrato invertido';
    case 3:
      return '270° paisagem invertida';
    default:
      return '0° retrato';
  }
}

function readPlayerAdFromTotem(totem: Record<string, unknown> | null): PlayerAdForm {
  const settings = ((totem?.playerSettings || totem?.player_settings || {}) as Record<string, unknown>) || {};
  const rotRaw = Number(settings.displayRotation ?? 0);
  const rot = Number.isFinite(rotRaw) ? ((rotRaw % 4) + 4) % 4 : 0;
  const kiosk = String(settings.kioskMode || 'strong').toLowerCase() === 'immersive' ? 'immersive' : 'strong';
  return {
    ...DEFAULT_PLAYER_AD,
    serverUrl: String(settings.serverUrl || DEFAULT_PLAYER_AD.serverUrl),
    deviceId: String(settings.deviceId || totem?.deviceId || totem?.device_id || ''),
    displayRotation: rot,
    kioskMode: kiosk,
    acceptImagesInPlaylist: settings.acceptImagesInPlaylist !== false,
    allowPlaybackAudio: settings.allowPlaybackAudio === true,
    mediaTransitionEnabled: (() => {
      const raw = settings.mediaTransitionEnabled;
      if (raw === false || raw === 0 || raw === '0' || raw === 'false' || raw === 'off') return 0;
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') return 1;
      if (raw == null || raw === '') return 1;
      return Number(raw) === 0 ? 0 : 1;
    })(),
    batimentoCardiaco: Math.min(3600, Math.max(15, Number(settings.batimentoCardiaco) || 30)),
    maxSecondsWithoutServerCheck: Math.min(3600, Math.max(30, Number(settings.maxSecondsWithoutServerCheck) || 180)),
    storage: String(settings.storage || 'external_primary'),
    storagePathOverride: String(settings.storagePathOverride || ''),
    maxCacheSizeMb: Math.min(8192, Math.max(50, Number(settings.maxCacheSizeMb) || 1000)),
    maxCachePercentOfVolume:
      settings.maxCachePercentOfVolume != null && settings.maxCachePercentOfVolume !== ''
        ? String(settings.maxCachePercentOfVolume)
        : '',
    allowIdentityChange: false,
  };
}

const TotemEditDialog: React.FC<TotemEditDialogProps> = ({ open, totem, onClose, onSaved }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState<UpdatePlayerRequest>({
    name: '',
    identifier: '',
    uin: '',
    localId: undefined,
    isActive: true,
  });
  const [schedule, setSchedule] = useState<DisplayScheduleForm>(DEFAULT_SCHEDULE);
  const [pollAdaptive, setPollAdaptive] = useState<PollAdaptiveForm>(DEFAULT_POLL_ADAPTIVE);
  const [playerAd, setPlayerAd] = useState<PlayerAdForm>(DEFAULT_PLAYER_AD);
  const [deviceClock, setDeviceClock] = useState<DeviceClockInfo | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiOpenNetwork, setWifiOpenNetwork] = useState(false);
  const [wifiBusy, setWifiBusy] = useState(false);
  const [wifiMessage, setWifiMessage] = useState<string | null>(null);
  const [tdepFill, setTdepFill] = useState<TdepFillForm>(DEFAULT_FILL);
  const [labTickBusy, setLabTickBusy] = useState(false);
  const [labTickLine, setLabTickLine] = useState<string | null>(null);
  /** Após o 1º load, o poll só atualiza relógio — não apaga edições locais de horário. */
  const formHydratedRef = useRef(false);

  useEffect(() => {
    if (!open || !totem) return;

    formHydratedRef.current = false;
    const totemId = getTotemIdFromRow(totem);
    const localId = getTotemLocalIdFromRow(totem);
    setForm({
      name: String(totem.name || ''),
      identifier: String(totem.identifier || totem.name || ''),
      uin: String(totem.uin || ''),
      localId,
      isActive: totem.isActive !== false && totem.is_active !== false,
    });
    setSchedule(readScheduleFromTotem(totem));
    setPollAdaptive(readPollAdaptiveFromTotem(totem));
    setPlayerAd(readPlayerAdFromTotem(totem));
    setTdepFill(readTdepFillFromTotem(totem));
    setDeviceClock(readDeviceClockFromTotem(totem));
    setLastHeartbeat(
      totem.lastHeartbeat
        ? String(totem.lastHeartbeat)
        : totem.last_heartbeat
          ? String(totem.last_heartbeat)
          : null
    );
    setError(null);

    if (!totemId) return;

    let cancelled = false;
    const loadFull = async (mode: 'full' | 'clock') => {
      try {
        const full = await totemApi.getById(totemId);
        if (cancelled) return;
        if (mode === 'full') {
          const resolvedLocalId = getTotemLocalIdFromRow(full as any);
          setForm((prev) => ({
            ...prev,
            localId: resolvedLocalId || prev.localId,
            name: String((full as any).name || prev.name || ''),
            identifier: String((full as any).identifier || prev.identifier || ''),
            uin: String((full as any).uin || prev.uin || ''),
            isActive: (full as any).isActive !== false && (full as any).is_active !== false,
          }));
          setSchedule(readScheduleFromTotem(full as any));
          setPollAdaptive(readPollAdaptiveFromTotem(full as any));
          setPlayerAd(readPlayerAdFromTotem(full as any));
          setTdepFill(readTdepFillFromTotem(full as any));
          formHydratedRef.current = true;
        }
        setDeviceClock(readDeviceClockFromTotem(full as any));
        setLastHeartbeat(
          (full as any).lastHeartbeat
            ? String((full as any).lastHeartbeat)
            : (full as any).last_heartbeat
              ? String((full as any).last_heartbeat)
              : null
        );
      } catch {
        /* mantém formulário com dados da listagem */
      }
    };

    void loadFull('full');
    const poll = window.setInterval(() => {
      void loadFull(formHydratedRef.current ? 'clock' : 'full');
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [open, totem]);

  const scheduleHint = useMemo(() => {
    if (!schedule.enabled) return 'Horário desativado: a tela permanece sempre ligada.';
    return `Liga às ${schedule.onTime} e desliga às ${schedule.offTime} (${schedule.timezone}). Fora do horário a saída fica preta sem encerrar o player.`;
  }, [schedule]);

  const deviceClockHint = useMemo(() => {
    if (!deviceClock) {
      return 'Ainda sem relógio reportado pelo Player-AD. Aguarde o próximo heartbeat após instalar a versão com telemetria de hora.';
    }
    const hb = lastHeartbeat
      ? (() => {
          try {
            return new Date(lastHeartbeat).toLocaleString('pt-BR');
          } catch {
            return lastHeartbeat;
          }
        })()
      : null;
    return `Hora do player: ${deviceClock.localFormatted} (${deviceClock.timezoneId})${
      hb ? ` · último heartbeat: ${hb}` : ''
    }`;
  }, [deviceClock, lastHeartbeat]);

  const toggleDay = (day: number) => {
    setSchedule((prev) => {
      const has = prev.daysOfWeek.includes(day);
      const next = has ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: next.length ? next : prev.daysOfWeek };
    });
  };

  const handleSave = async () => {
    const totemId = totem ? getTotemIdFromRow(totem) : undefined;
    const identifier = String(form.identifier || '').trim();
    const name = String(form.name || '').trim();
    const uin = String(form.uin || '').trim();

    if (!totemId) {
      setError('Totem inválido para edição');
      return;
    }
    if (identifier.length < 2) {
      setError('Identificador deve ter pelo menos 2 caracteres');
      return;
    }
    if (schedule.enabled && schedule.onTime === schedule.offTime) {
      setError('Horário de ligar e desligar não podem ser iguais');
      return;
    }
    if (schedule.enabled && schedule.daysOfWeek.length === 0) {
      setError('Selecione pelo menos um dia da semana');
      return;
    }

    const onTime = normalizeHmInput(schedule.onTime, DEFAULT_SCHEDULE.onTime);
    const offTime = normalizeHmInput(schedule.offTime, DEFAULT_SCHEDULE.offTime);
    if (schedule.enabled && onTime === offTime) {
      setError('Horário de ligar e desligar não podem ser iguais');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload: UpdatePlayerRequest = {
        identifier,
        isActive: form.isActive !== false,
        playerSettings: {
          displaySchedule: {
            enabled: schedule.enabled,
            timezone: schedule.timezone,
            daysOfWeek: schedule.daysOfWeek,
            onTime,
            offTime,
            keepAliveWhileOff: schedule.keepAliveWhileOff,
            keepAliveIntervalMinutes: schedule.keepAliveIntervalMinutes,
          },
          pollAdaptive: {
            enabled: pollAdaptive.enabled,
            unchangedStreakBeforeSleep: pollAdaptive.unchangedStreakBeforeSleep,
            sleepGrowthFactor: pollAdaptive.sleepGrowthFactor,
            maxHeartbeatSeconds: pollAdaptive.maxHeartbeatSeconds,
            maxDispatchSeconds: pollAdaptive.maxDispatchSeconds,
            idleHeartbeatSeconds: pollAdaptive.idleHeartbeatSeconds,
            idleDispatchSeconds: pollAdaptive.idleDispatchSeconds,
          },
          displayRotation: playerAd.displayRotation,
          screenOrientation:
            playerAd.displayRotation === 1
              ? 'landscape'
              : playerAd.displayRotation === 2
                ? 'reverse_portrait'
                : playerAd.displayRotation === 3
                  ? 'reverse_landscape'
                  : 'portrait',
          kioskMode: playerAd.kioskMode,
          acceptImagesInPlaylist: playerAd.acceptImagesInPlaylist,
          allowPlaybackAudio: playerAd.allowPlaybackAudio,
          mediaTransitionEnabled: playerAd.mediaTransitionEnabled === 0 ? 0 : 1,
          batimentoCardiaco: playerAd.batimentoCardiaco,
          maxSecondsWithoutServerCheck: playerAd.maxSecondsWithoutServerCheck,
          storage: playerAd.storage,
          storagePathOverride: playerAd.storagePathOverride || undefined,
          maxCacheSizeMb: playerAd.maxCacheSizeMb,
          maxCachePercentOfVolume: playerAd.maxCachePercentOfVolume
            ? Number(playerAd.maxCachePercentOfVolume)
            : null,
          allowIdentityChange: playerAd.allowIdentityChange,
          ...(playerAd.allowIdentityChange
            ? {
                serverUrl: playerAd.serverUrl.trim(),
                deviceId: playerAd.deviceId.trim().toUpperCase(),
                uin,
              }
            : {}),
        },
      };
      if (name) payload.name = name;
      if (uin) payload.uin = uin;
      if (form.localId) payload.localId = form.localId;
      if (playerAd.deviceId.trim()) payload.deviceId = playerAd.deviceId.trim().toUpperCase();
      payload.tdepFill = tdepFillPayload(tdepFill);

      await totemApi.update(totemId, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar totem'));
    } finally {
      setLoading(false);
    }
  };

  const title = String(totem?.name || totem?.identifier || 'Totem');

  const rotateCw = () =>
    setPlayerAd((prev) => ({ ...prev, displayRotation: (prev.displayRotation + 1) % 4 }));
  const rotateCcw = () =>
    setPlayerAd((prev) => ({ ...prev, displayRotation: (prev.displayRotation + 3) % 4 }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>Editar totem</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Parâmetros do totem e config do Player-AD (empurrados via <code>apply_player_config</code>) para{' '}
          <strong>{title}</strong>.
        </Typography>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          label="Nome"
          margin="normal"
          value={form.name || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <TextField
          fullWidth
          label="Identificador"
          margin="normal"
          required
          value={form.identifier || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
          helperText="Identificação única do totem no sistema"
        />
        <TextField
          fullWidth
          label="Código de ativação (UIN)"
          margin="normal"
          value={form.uin || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, uin: e.target.value }))}
          helperText="Informe este código no player para vincular a tela a este totem"
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Switch
              checked={form.isActive !== false}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
          }
          label="Totem habilitado"
        />

        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <ScreenRotationIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1">Configuração Player-AD</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Espelho do painel de configuração do aparelho. Alterações são enviadas ao totem no próximo
            heartbeat.
          </Typography>

          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Orientação do painel
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <IconButton aria-label="Rodar 90 anti-horário" onClick={rotateCcw} color="primary">
              <RotateLeftIcon />
            </IconButton>
            <Typography variant="body1" sx={{ minWidth: 180, textAlign: 'center', fontWeight: 600 }}>
              {orientationLabel(playerAd.displayRotation)}
            </Typography>
            <IconButton aria-label="Rodar 90 horário" onClick={rotateCw} color="primary">
              <RotateRightIcon />
            </IconButton>
          </Stack>

          <TextField
            fullWidth
            label="URL do servidor (serverUrl)"
            margin="dense"
            value={playerAd.serverUrl}
            onChange={(e) => setPlayerAd((prev) => ({ ...prev, serverUrl: e.target.value }))}
            helperText="Ex.: https://totemdigital.app.br — só aplica no aparelho se permitir alterar identidade"
          />
          <TextField
            fullWidth
            label="ID do dispositivo (deviceId)"
            margin="dense"
            value={playerAd.deviceId}
            onChange={(e) => setPlayerAd((prev) => ({ ...prev, deviceId: e.target.value.toUpperCase() }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={playerAd.allowIdentityChange}
                onChange={(e) =>
                  setPlayerAd((prev) => ({ ...prev, allowIdentityChange: e.target.checked }))
                }
              />
            }
            label="Permitir alterar URL / UIN / deviceId no totem (allowIdentityChange)"
          />

          <FormControlLabel
            control={
              <Switch
                checked={playerAd.kioskMode === 'strong'}
                onChange={(e) =>
                  setPlayerAd((prev) => ({
                    ...prev,
                    kioskMode: e.target.checked ? 'strong' : 'immersive',
                  }))
                }
              />
            }
            label="Kiosk forte (bloqueio HOME/recents)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={playerAd.acceptImagesInPlaylist}
                onChange={(e) =>
                  setPlayerAd((prev) => ({ ...prev, acceptImagesInPlaylist: e.target.checked }))
                }
              />
            }
            label="Aceitar imagens na playlist"
          />
          <FormControlLabel
            control={
              <Switch
                checked={playerAd.allowPlaybackAudio}
                onChange={(e) =>
                  setPlayerAd((prev) => ({ ...prev, allowPlaybackAudio: e.target.checked }))
                }
              />
            }
            label="Áudio na reprodução (vídeo)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={playerAd.mediaTransitionEnabled !== 0}
                onChange={(e) =>
                  setPlayerAd((prev) => ({
                    ...prev,
                    mediaTransitionEnabled: e.target.checked ? 1 : 0,
                  }))
                }
              />
            }
            label="Transição escura entre mídias (Player-AD)"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5, mb: 1, ml: 4 }}>
            Ligado (1): véu preto curto na troca. Desligado (0): troca directa sem escurecer.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <TextField
              label="Batimento (s)"
              type="number"
              size="small"
              value={playerAd.batimentoCardiaco}
              onChange={(e) =>
                setPlayerAd((prev) => ({
                  ...prev,
                  batimentoCardiaco: Math.min(3600, Math.max(15, Number(e.target.value) || 30)),
                }))
              }
              inputProps={{ min: 15, max: 3600 }}
              sx={{ width: 140 }}
            />
            <TextField
              label="Atualizar plano (s)"
              type="number"
              size="small"
              value={playerAd.maxSecondsWithoutServerCheck}
              onChange={(e) =>
                setPlayerAd((prev) => ({
                  ...prev,
                  maxSecondsWithoutServerCheck: Math.min(
                    3600,
                    Math.max(30, Number(e.target.value) || 180)
                  ),
                }))
              }
              inputProps={{ min: 30, max: 3600 }}
              sx={{ width: 160 }}
            />
            <TextField
              label="Cache máx. (MB)"
              type="number"
              size="small"
              value={playerAd.maxCacheSizeMb}
              onChange={(e) =>
                setPlayerAd((prev) => ({
                  ...prev,
                  maxCacheSizeMb: Math.min(8192, Math.max(50, Number(e.target.value) || 1000)),
                }))
              }
              inputProps={{ min: 50, max: 8192 }}
              sx={{ width: 140 }}
            />
            <TextField
              label="% volume (opc.)"
              size="small"
              value={playerAd.maxCachePercentOfVolume}
              onChange={(e) =>
                setPlayerAd((prev) => ({ ...prev, maxCachePercentOfVolume: e.target.value }))
              }
              sx={{ width: 130 }}
            />
          </Box>

          <FormControl fullWidth margin="dense" size="small" sx={{ mt: 1, maxWidth: 360 }}>
            <InputLabel id="player-storage-label">Storage</InputLabel>
            <Select
              labelId="player-storage-label"
              label="Storage"
              value={playerAd.storage}
              onChange={(e) => setPlayerAd((prev) => ({ ...prev, storage: String(e.target.value) }))}
            >
              <MenuItem value="auto">auto</MenuItem>
              <MenuItem value="internal">internal</MenuItem>
              <MenuItem value="external_primary">external_primary</MenuItem>
              <MenuItem value="sdcard">sdcard</MenuItem>
              <MenuItem value="removable_preferred">removable_preferred</MenuItem>
              <MenuItem value="path_override">path_override</MenuItem>
            </Select>
          </FormControl>
          {playerAd.storage === 'path_override' && (
            <TextField
              fullWidth
              margin="dense"
              label="Caminho absoluto (storagePathOverride)"
              value={playerAd.storagePathOverride}
              onChange={(e) =>
                setPlayerAd((prev) => ({ ...prev, storagePathOverride: e.target.value }))
              }
            />
          )}
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
              mb: 1,
            }}
          >
            <Typography variant="subtitle1" component="span">
              Horário de tela
            </Typography>
            <Typography
              variant="body2"
              component="span"
              sx={{ fontFamily: 'monospace', color: 'primary.light', fontWeight: 600 }}
              title={deviceClockHint}
            >
              {deviceClock
                ? `${deviceClock.localFormatted}${
                    deviceClock.timezoneId && deviceClock.timezoneId !== '—'
                      ? ` · ${deviceClock.timezoneId}`
                      : ''
                  }`
                : '— aguardando heartbeat —'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {scheduleHint}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={schedule.enabled}
                onChange={(e) => setSchedule((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Ativar horário de trabalho da tela"
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <TextField
              label="Ligar às"
              type="time"
              value={schedule.onTime}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setSchedule((prev) => ({ ...prev, onTime: normalizeHmInput(v, prev.onTime) }));
              }}
              disabled={!schedule.enabled}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              sx={{ minWidth: 140 }}
            />
            <TextField
              label="Desligar às"
              type="time"
              value={schedule.offTime}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setSchedule((prev) => ({ ...prev, offTime: normalizeHmInput(v, prev.offTime) }));
              }}
              disabled={!schedule.enabled}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              sx={{ minWidth: 140 }}
            />
            <FormControl sx={{ minWidth: 220 }} disabled={!schedule.enabled}>
              <InputLabel id="tz-label">Fuso horário</InputLabel>
              <Select
                labelId="tz-label"
                label="Fuso horário"
                value={schedule.timezone}
                onChange={(e) => setSchedule((prev) => ({ ...prev, timezone: String(e.target.value) }))}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    {tz}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Typography variant="body2" sx={{ mt: 2, mb: 0.5 }}>
            Dias da semana
          </Typography>
          <FormGroup row>
            {DAY_OPTIONS.map((d) => (
              <FormControlLabel
                key={d.value}
                disabled={!schedule.enabled}
                control={
                  <Checkbox
                    size="small"
                    checked={schedule.daysOfWeek.includes(d.value)}
                    onChange={() => toggleDay(d.value)}
                  />
                }
                label={d.label}
              />
            ))}
          </FormGroup>
          <FormControlLabel
            sx={{ mt: 1 }}
            disabled={!schedule.enabled}
            control={
              <Switch
                checked={schedule.keepAliveWhileOff}
                onChange={(e) => setSchedule((prev) => ({ ...prev, keepAliveWhileOff: e.target.checked }))}
              />
            }
            label="Manter TV acordada no período off (anti-standby)"
          />
          <TextField
            label="Intervalo keep-alive (min)"
            type="number"
            size="small"
            disabled={!schedule.enabled || !schedule.keepAliveWhileOff}
            value={schedule.keepAliveIntervalMinutes}
            onChange={(e) =>
              setSchedule((prev) => ({
                ...prev,
                keepAliveIntervalMinutes: Math.min(30, Math.max(5, Number(e.target.value) || 10)),
              }))
            }
            inputProps={{ min: 5, max: 30 }}
            sx={{ mt: 1, maxWidth: 200 }}
          />
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            Sonolência do batimento
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Reduz tráfego quando o servidor responde sem mudanças e fora do horário de tela. Enviado ao
            Player-AD no heartbeat (`pollAdaptive`).
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={pollAdaptive.enabled}
                onChange={(e) => setPollAdaptive((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Ativar sonolência progressiva"
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <TextField
              label="Iguais antes de dormir"
              type="number"
              size="small"
              disabled={!pollAdaptive.enabled}
              value={pollAdaptive.unchangedStreakBeforeSleep}
              onChange={(e) =>
                setPollAdaptive((prev) => ({
                  ...prev,
                  unchangedStreakBeforeSleep: Math.min(20, Math.max(1, Number(e.target.value) || 2)),
                }))
              }
              inputProps={{ min: 1, max: 20 }}
              sx={{ width: 160 }}
            />
            <TextField
              label="HB idle (s)"
              type="number"
              size="small"
              disabled={!pollAdaptive.enabled}
              value={pollAdaptive.idleHeartbeatSeconds}
              onChange={(e) =>
                setPollAdaptive((prev) => ({
                  ...prev,
                  idleHeartbeatSeconds: Math.min(3600, Math.max(30, Number(e.target.value) || 120)),
                }))
              }
              inputProps={{ min: 30, max: 3600 }}
              sx={{ width: 140 }}
            />
            <TextField
              label="HB teto (s)"
              type="number"
              size="small"
              disabled={!pollAdaptive.enabled}
              value={pollAdaptive.maxHeartbeatSeconds}
              onChange={(e) =>
                setPollAdaptive((prev) => ({
                  ...prev,
                  maxHeartbeatSeconds: Math.min(3600, Math.max(60, Number(e.target.value) || 600)),
                }))
              }
              inputProps={{ min: 60, max: 3600 }}
              sx={{ width: 140 }}
            />
            <TextField
              label="Dispatch idle (s)"
              type="number"
              size="small"
              disabled={!pollAdaptive.enabled}
              value={pollAdaptive.idleDispatchSeconds}
              onChange={(e) =>
                setPollAdaptive((prev) => ({
                  ...prev,
                  idleDispatchSeconds: Math.min(7200, Math.max(60, Number(e.target.value) || 600)),
                }))
              }
              inputProps={{ min: 60, max: 7200 }}
              sx={{ width: 150 }}
            />
            <TextField
              label="Dispatch teto (s)"
              type="number"
              size="small"
              disabled={!pollAdaptive.enabled}
              value={pollAdaptive.maxDispatchSeconds}
              onChange={(e) =>
                setPollAdaptive((prev) => ({
                  ...prev,
                  maxDispatchSeconds: Math.min(7200, Math.max(120, Number(e.target.value) || 1800)),
                }))
              }
              inputProps={{ min: 120, max: 7200 }}
              sx={{ width: 150 }}
            />
          </Box>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Wi‑Fi remoto (Player-AD ≥ 2.12)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Envia <code>configure_wifi</code> ao aparelho. Requer ligação actual à Internet; sem rede,
            configure no próprio totem (3 toques OK → Config → Wi‑Fi).
          </Typography>
          <TextField
            fullWidth
            label="SSID"
            margin="dense"
            value={wifiSsid}
            onChange={(e) => setWifiSsid(e.target.value)}
            autoComplete="off"
          />
          <TextField
            fullWidth
            type="password"
            label="Senha Wi‑Fi"
            margin="dense"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            disabled={wifiOpenNetwork}
            autoComplete="new-password"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={wifiOpenNetwork}
                onChange={(e) => setWifiOpenNetwork(e.target.checked)}
              />
            }
            label="Rede aberta (sem senha)"
          />
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              disabled={
                wifiBusy ||
                loading ||
                !wifiSsid.trim() ||
                (!wifiOpenNetwork && !wifiPassword) ||
                !getTotemIdFromRow(totem)
              }
              onClick={async () => {
                const id = getTotemIdFromRow(totem);
                if (!id) {
                  setError('Totem sem id');
                  return;
                }
                const ssid = wifiSsid.trim();
                try {
                  setWifiBusy(true);
                  setError(null);
                  setWifiMessage(null);
                  await totemApi.sendCommand(id, 'configure_wifi', {
                    ssid,
                    password: wifiOpenNetwork ? '' : wifiPassword,
                    secured: !wifiOpenNetwork,
                  });
                  setWifiPassword('');
                  setWifiMessage('Comando configure_wifi enfileirado — sync/heartbeat entrega ao Player-AD.');
                } catch (err: unknown) {
                  setError(pickApiErrorMessage(err, 'Erro ao enviar configure_wifi'));
                } finally {
                  setWifiBusy(false);
                }
              }}
            >
              {wifiBusy ? 'A enviar…' : 'Enviar Wi‑Fi ao totem'}
            </Button>
          </Box>
          {wifiMessage && (
            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
              {wifiMessage}
            </Typography>
          )}
        </Box>

        <Accordion
          defaultExpanded={false}
          disableGutters
          elevation={0}
          sx={{ mt: 3, border: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Laboratório — ceder ar ocioso</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              TotemNet lab. Default desligado. O cardápio local continua a ganhar. Não entra no pitch de
              15 min. Máximo 10% do ar.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={tdepFill.enabled}
                  onChange={(e) => setTdepFill((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label="Ceder até 10% do ar ocioso a parceiro"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tdepFill.killSwitch}
                  onChange={(e) => setTdepFill((prev) => ({ ...prev, killSwitch: e.target.checked }))}
                />
              }
              label="Cortar parceiro agora (kill-switch)"
            />
          </AccordionDetails>
        </Accordion>

        <Accordion
          defaultExpanded={false}
          disableGutters
          elevation={0}
          sx={{ mt: 1, border: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Laboratório — ciclo de sistema</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Tick mock ACE + Maestro + TDEP. Não é o Player-AD. Fora do pitch de 15 min.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                disabled={labTickBusy || !getTotemIdFromRow(totem)}
                onClick={async () => {
                  const id = getTotemIdFromRow(totem);
                  if (!id) return;
                  setLabTickBusy(true);
                  setLabTickLine(null);
                  try {
                    const result = await labSystemApi.tick(buildLabTickBody('default_off', id) as Record<string, unknown>);
                    const s = summarizeLabTick(result);
                    setLabTickLine(`${s.winnerId || '—'} · ${s.winnerLane || '—'} · ${s.tdepCode || 'ok'}`);
                  } catch (err: unknown) {
                    setLabTickLine(pickApiErrorMessage(err, 'Falha no tick de lab'));
                  } finally {
                    setLabTickBusy(false);
                  }
                }}
              >
                {labTickBusy ? 'A correr…' : 'Correr tick (default off)'}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  const id = getTotemIdFromRow(totem);
                  onClose();
                  navigate(id ? `/lab/system?totemId=${id}` : '/lab/system');
                }}
              >
                Abrir consola
              </Button>
            </Stack>
            {labTickLine && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {labTickLine}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={loading}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TotemEditDialog;

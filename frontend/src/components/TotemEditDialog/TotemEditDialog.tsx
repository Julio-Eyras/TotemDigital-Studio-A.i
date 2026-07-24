import React, { useEffect, useMemo, useState } from 'react';
import {
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
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { totemApi, UpdatePlayerRequest } from '../../services/api';
import { getTotemIdFromRow, getTotemLocalIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  DEFAULT_DISPLAY_SCHEDULE,
  DISPLAY_SCHEDULE_DAY_OPTIONS,
  DeviceClockInfo,
  DisplayScheduleInfo,
  readDeviceClockFromTotem,
  readScheduleFromTotem,
} from '../../utils/totemDisplaySchedule';

export interface TotemEditDialogProps {
  open: boolean;
  totem: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

type DisplayScheduleForm = DisplayScheduleInfo;

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

const TotemEditDialog: React.FC<TotemEditDialogProps> = ({ open, totem, onClose, onSaved }) => {
  const [form, setForm] = useState<UpdatePlayerRequest>({
    name: '',
    identifier: '',
    uin: '',
    localId: undefined,
    isActive: true,
  });
  const [schedule, setSchedule] = useState<DisplayScheduleForm>(DEFAULT_SCHEDULE);
  const [deviceClock, setDeviceClock] = useState<DeviceClockInfo | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !totem) return;

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
    const loadFull = async () => {
      try {
        const full = await totemApi.getById(totemId);
        if (cancelled) return;
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

    void loadFull();
    const poll = window.setInterval(() => {
      void loadFull();
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
            onTime: schedule.onTime,
            offTime: schedule.offTime,
            keepAliveWhileOff: schedule.keepAliveWhileOff,
            keepAliveIntervalMinutes: schedule.keepAliveIntervalMinutes,
          },
        },
      };
      if (name) payload.name = name;
      if (uin) payload.uin = uin;
      if (form.localId) payload.localId = form.localId;

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar totem</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ajuste o nome, identificador, código de ativação e horário de tela de <strong>{title}</strong>.
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
                ? `${deviceClock.localFormatted}`
                : '— aguardando heartbeat —'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {deviceClock
              ? `Data/hora do Player-AD (heartbeat)${
                  deviceClock.timezoneId ? ` · ${deviceClock.timezoneId}` : ''
                }`
              : 'Aguardando o Player-AD enviar a hora no heartbeat.'}
          </Typography>
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
              onChange={(e) => setSchedule((prev) => ({ ...prev, onTime: e.target.value }))}
              disabled={!schedule.enabled}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              sx={{ minWidth: 140 }}
            />
            <TextField
              label="Desligar às"
              type="time"
              value={schedule.offTime}
              onChange={(e) => setSchedule((prev) => ({ ...prev, offTime: e.target.value }))}
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

/**
 * Consola lab do ciclo de sistema (mocks).
 * Rota /lab/system — fora do menu Direct e do pitch de 15 min.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { labSystemApi } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  LAB_TICK_SCENARIOS,
  LabSystemTickResponse,
  LabTickScenarioId,
  buildLabTickBody,
  parseLabTotemId,
  summarizeLabTick,
} from '../../utils/labSystemTick';

const LabSystem: React.FC = () => {
  const [params] = useSearchParams();
  const [totemId, setTotemId] = useState(() => parseLabTotemId(params.get('totemId'), 41));
  const [aceOptIn, setAceOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<LabSystemTickResponse | null>(null);
  const [lastScenario, setLastScenario] = useState<LabTickScenarioId | null>(null);

  const summary = useMemo(() => summarizeLabTick(raw), [raw]);

  useEffect(() => {
    let cancelled = false;
    void labSystemApi
      .getOptin(totemId)
      .then((row) => {
        if (!cancelled) setAceOptIn(row?.aceEnabled === true);
      })
      .catch(() => {
        if (!cancelled) setAceOptIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [totemId]);

  const run = async (id: LabTickScenarioId) => {
    setBusy(true);
    setError(null);
    try {
      if (id === 'ace_optin') {
        await labSystemApi.patchOptin(totemId, { aceEnabled: true });
        setAceOptIn(true);
      }
      const body = buildLabTickBody(id, totemId);
      const result = (await labSystemApi.tick(body as Record<string, unknown>)) as LabSystemTickResponse;
      setRaw(result);
      setLastScenario(id);
    } catch (err: unknown) {
      setError(pickApiErrorMessage(err, 'Falha no tick de lab'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setError(null);
    try {
      await labSystemApi.revoke();
      await run('fill_idle');
    } catch (err: unknown) {
      setError(pickApiErrorMessage(err, 'Falha no revoke de lab'));
      setBusy(false);
    }
  };

  const toggleOptIn = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const row = await labSystemApi.patchOptin(totemId, { aceEnabled: enabled });
      setAceOptIn(row?.aceEnabled === true);
    } catch (err: unknown) {
      setError(pickApiErrorMessage(err, 'Falha no opt-in ACE mock'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960 }}>
      <Typography variant="h5" gutterBottom>
        Laboratório — ciclo de sistema
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        ACE + Maestro + TDEP no mesmo tick. Player-AD, TV box, câmara e CMS parceiro são mocks.
        Fora do pitch de 15 min. Direct default off. Sem <code>/tdep/v1</code> de produto.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Esta página não está no menu. URL de lab: <code>/lab/system</code>. Opt-in ACE é mock do SQL
        (sem Postgres).
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          label="Totem mock"
          type="number"
          size="small"
          value={totemId}
          onChange={(e) => setTotemId(parseLabTotemId(e.target.value, 41))}
          inputProps={{ min: 1 }}
          sx={{ width: 140 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={aceOptIn}
              disabled={busy}
              onChange={(e) => void toggleOptIn(e.target.checked)}
            />
          }
          label="Opt-in ACE (mock SQL)"
        />
        <Button variant="outlined" disabled={busy} onClick={() => void revoke()}>
          Revoke + fill
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {LAB_TICK_SCENARIOS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            clickable
            disabled={busy}
            color={lastScenario === s.id ? 'primary' : 'default'}
            onClick={() => void run(s.id)}
            title={s.hint}
          />
        ))}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {raw && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Resultado {lastScenario ? `(${lastScenario})` : ''}
          </Typography>
          <Typography variant="body2">
            ACE: {summary.aceEnabled ? 'on' : 'off'}
            {summary.optInSource ? ` (${summary.optInSource})` : ''}
            {summary.hintCategory ? ` · hint ${summary.hintCategory}` : ''}
            {summary.gatewayCode ? ` · ${summary.gatewayCode}` : ''}
            {summary.identityLeak ? ' · IDENTITY_LEAK' : ''}
          </Typography>
          <Typography variant="body2">vencedor: {summary.winnerId || '—'}</Typography>
          <Typography variant="body2">lane: {summary.winnerLane || '—'}</Typography>
          <Typography variant="body2">TDEP: {summary.tdepCode || 'ok'}</Typography>
          <Typography variant="body2">
            Maestro: cue {summary.cueSent ? 'enviado' : 'recusado'}
            {summary.maestroCode ? ` (${summary.maestroCode})` : ''}
          </Typography>
          <Typography variant="body2">
            proof: {summary.proofSig ? `${summary.proofSig.slice(0, 16)}…` : 'nenhum'}
          </Typography>
          <Typography variant="body2">totens no ciclo: {summary.totemCount}</Typography>
          {JSON.stringify(raw).includes('audience') && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Leak: o tick devolveu audience.
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default LabSystem;

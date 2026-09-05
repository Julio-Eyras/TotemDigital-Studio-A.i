import React, { useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchFxDashboard,
  setActiveFilters,
  clearKind
} from '../../../store/slices/dashboardsSlice';
import type { DashboardFilters } from '../../../services/api/dashboardsApi';

import {
  KpiCard,
  TimelineChart,
  CompareAB,
  UptimeGauge,
  TopTable,
  type TopTableColumn,
  type CompareABEntry
} from '../../../components/dashboards/widgets';
import type {
  FxEffectStat,
  FxUptimeStat,
  FxTimelineEvent
} from '../../../services/api/dashboardsApi';

const effectColumns: TopTableColumn<FxEffectStat>[] = [
  { key: 'effectName', header: 'Efeito', sortable: true, width: '38%' },
  { key: 'executions', header: 'Execuções', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'executions' } },
  { key: 'avgLatencyMs', header: 'Latência média (ms)', sortable: true, numeric: true, align: 'right' },
  { key: 'p95LatencyMs', header: 'P95 (ms)', sortable: true, numeric: true, align: 'right' },
  { key: 'errors', header: 'Erros', sortable: true, numeric: true, align: 'right' },
  {
    key: 'successRate',
    header: 'Sucesso (%)',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => `${(Number(v) * 100).toFixed(2)}%`,
    progressBar: { valueKey: 'successRate', max: 1 }
  }
];

const uptimeColumns: TopTableColumn<FxUptimeStat>[] = [
  { key: 'totemId', header: 'Totem ID', sortable: true, numeric: true, align: 'right' },
  { key: 'totemName', header: 'Nome', sortable: true },
  {
    key: 'uptimePercent',
    header: 'Uptime (%)',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => `${Number(v).toFixed(2)}%`,
    progressBar: { valueKey: 'uptimePercent', max: 100 }
  },
  { key: 'downtimeMinutes', header: 'Downtime (min)', sortable: true, numeric: true, align: 'right' },
  { key: 'syncDriftMs', header: 'Drift (ms)', sortable: true, numeric: true, align: 'right' },
  { key: 'lastOfflineAt', header: 'Último offline', sortable: true }
];

export const FxDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const data = useAppSelector((s) => s.dashboards.fx);
  const loading = useAppSelector((s) => s.dashboards.loading.fx);
  const error = useAppSelector((s) => s.dashboards.error.fx);
  const filters = useAppSelector((s) => s.dashboards.activeFilters);
  const cachePolicy = useAppSelector((s) => ({ useCache: s.dashboards.useCache, ttlSec: s.dashboards.ttlSec }));

  useEffect(() => {
    dispatch(fetchFxDashboard({ filters, useCache: cachePolicy.useCache, ttlSec: cachePolicy.ttlSec }));
    return () => {
      dispatch(clearKind('fx'));
    };
  }, [dispatch, filters, cachePolicy.useCache, cachePolicy.ttlSec]);

  const update = <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) =>
    dispatch(setActiveFilters({ [k]: v } as Partial<DashboardFilters> as DashboardFilters));

  const onRefresh = () => dispatch(fetchFxDashboard({ filters, useCache: false, ttlSec: cachePolicy.ttlSec }));

  const timelinePoints = (data?.timeline ?? []).map<FxTimelineEvent extends infer T ? any : never>((e) => ({
    timestamp: e.timestamp,
    label: `${e.effectName ?? e.type} #${e.totemId ?? '-'}`,
    value: e.ok ? (e.durationMs ?? 1) : 0,
    group: e.ok ? 'OK' : 'Erros'
  }));

  const compareEntries: CompareABEntry[] = (data?.compareAB ?? []).map((e) => ({
    label: e.label,
    before: e.before,
    after: e.after,
    deltaPercent: e.deltaPercent,
    metric: e.metric
  }));

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 3 }} useFlexGap>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t('dashboards:fx.title', 'Dashboard SmartDisplay FX')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboards:fx.subtitle', 'Latência, sincronismo multi-tela, uptime e orquestração.')}
          </Typography>
        </Box>
        <Tooltip title={t('dashboards:common.refreshBypass', 'Recarregar (ignorar cache)')}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
          >
            {t('dashboards:common.refresh', 'Atualizar')}
          </Button>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label={t('dashboards:common.startDate', 'Data inicial')}
              value={filters.startDate ?? ''}
              onChange={(e) => update('startDate', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label={t('dashboards:common.endDate', 'Data final')}
              value={filters.endDate ?? ''}
              onChange={(e) => update('endDate', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('dashboards:common.granularity', 'Granularidade')}</InputLabel>
              <Select
                label={t('dashboards:common.granularity', 'Granularidade')}
                value={filters.granularity ?? 'day'}
                onChange={(e) => update('granularity', e.target.value as DashboardFilters['granularity'])}
              >
                <MenuItem value="hour">{t('dashboards:common.hour', 'Hora')}</MenuItem>
                <MenuItem value="day">{t('dashboards:common.day', 'Dia')}</MenuItem>
                <MenuItem value="week">{t('dashboards:common.week', 'Semana')}</MenuItem>
                <MenuItem value="month">{t('dashboards:common.month', 'Mês')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack direction="row" spacing={1} useFlexGap>
              <Chip
                label={data?.meta.generatedAt ? new Date(data.meta.generatedAt).toLocaleString() : '—'}
                variant="outlined"
                sx={{ flex: 1, justifyContent: 'flex-start', overflow: 'hidden' }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearKind('fx'))}>
          {error}
        </Alert>
      ) : null}

      <Grid container spacing={2.5} mb={3}>
        {loading && !data ? (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress />
            </Box>
          </Grid>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:fx.kpi.totalExecutions', 'Execuções')}
                value={data?.kpis.totalExecutions.value ?? 0}
                previous={data?.kpis.totalExecutions.previous}
                deltaPercent={data?.kpis.totalExecutions.deltaPercent}
                trend={data?.kpis.totalExecutions.trend}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:fx.kpi.avgLatencyMs', 'Latência média')}
                value={data?.kpis.avgLatencyMs.value ?? 0}
                previous={data?.kpis.avgLatencyMs.previous}
                deltaPercent={data?.kpis.avgLatencyMs.deltaPercent}
                trend={data?.kpis.avgLatencyMs.trend}
                unit="ms"
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:fx.kpi.fleetUptime', 'Uptime Fleet')}
                value={data?.kpis.fleetUptimePercent.value ?? 0}
                previous={data?.kpis.fleetUptimePercent.previous}
                deltaPercent={data?.kpis.fleetUptimePercent.deltaPercent}
                trend={data?.kpis.fleetUptimePercent.trend}
                unit="%"
                progress={data?.kpis.fleetUptimePercent.value}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:fx.kpi.syncSuccess', 'Sucesso Sync')}
                value={data?.kpis.syncSuccessRate.value ?? 0}
                previous={data?.kpis.syncSuccessRate.previous}
                deltaPercent={data?.kpis.syncSuccessRate.deltaPercent}
                trend={data?.kpis.syncSuccessRate.trend}
                unit="%"
                progress={data?.kpis.syncSuccessRate.value}
                color="info"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:fx.kpi.totalErrors', 'Erros')}
                value={data?.kpis.totalErrors.value ?? 0}
                previous={data?.kpis.totalErrors.previous}
                deltaPercent={data?.kpis.totalErrors.deltaPercent}
                trend={data?.kpis.totalErrors.trend}
                color="error"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={2.5} mb={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <UptimeGauge
            title={t('dashboards:fx.fleetGauge.title', 'Saúde Fleet (FX)')}
            subheader={t('dashboards:fx.fleetGauge.subheader', 'Uptime médio da frota.')}
            value={data?.kpis.fleetUptimePercent.value ?? 0}
            label={t('dashboards:fx.fleetGauge.label', '% uptime')}
            extraStats={[
              { label: 'Totens', value: data?.uptimeByTotem.length ?? 0 },
              { label: 'Latência média (ms)', value: data?.kpis.avgLatencyMs.value ?? 0 },
              { label: 'Sync sucesso (%)', value: data?.kpis.syncSuccessRate.value ?? 0 },
              { label: 'Erros', value: data?.kpis.totalErrors.value ?? 0 }
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <CompareAB
            title={t('dashboards:fx.compareAB.title', 'Compare A/B (Antes × Depois FX)')}
            subheader={t('dashboards:fx.compareAB.subheader', 'Métricas antes vs. depois da ativação dos efeitos.')}
            entries={compareEntries}
            unit="uni"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mb={3}>
        <Grid size={{ xs: 12 }}>
          <TimelineChart
            kind="bar"
            title={t('dashboards:fx.timeline.title', 'Timeline Orquestração')}
            subheader={t('dashboards:fx.timeline.subheader', 'Duração por evento de orquestração / sincronismo.')}
            points={timelinePoints}
            showLegend
            yLabel="Duração (ms)"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <TopTable
            title={t('dashboards:fx.topEffects.title', 'Top Efeitos Executados')}
            columns={effectColumns}
            rows={data?.topEffects ?? []}
            defaultOrderBy="executions"
            maxRows={20}
            stickyHeader
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <TopTable
            title={t('dashboards:fx.uptimeByTotem.title', 'Uptime por Totem')}
            columns={uptimeColumns}
            rows={data?.uptimeByTotem ?? []}
            defaultOrderBy="uptimePercent"
            defaultOrder="asc"
            maxRows={50}
            stickyHeader
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default FxDashboardPage;

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
  fetchAceDashboard,
  setActiveFilters,
  clearKind
} from '../../../store/slices/dashboardsSlice';
import type { DashboardFilters } from '../../../services/api/dashboardsApi';

import {
  KpiCard,
  HeatmapGrid,
  TimelineChart,
  TopTable,
  UptimeGauge,
  type TopTableColumn,
  type HeatmapCellData
} from '../../../components/dashboards/widgets';
import type {
  AceAudienceTimeline,
  AceTopContent,
  AceDemographicBucket
} from '../../../services/api/dashboardsApi';

const audienceColumns: TopTableColumn<AceAudienceTimeline>[] = [
  { key: 'weekday', header: 'Dia', sortable: true },
  { key: 'hour', header: 'Hora', sortable: true, numeric: true, align: 'right' },
  { key: 'detected', header: 'Detectados', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'detected', max: 1000 } },
  { key: 'engaged', header: 'Engajados', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'engaged', max: 1000 } }
];

const topContentColumns: TopTableColumn<AceTopContent>[] = [
  { key: 'mediaName', header: 'Conteúdo', sortable: true, width: '40%' },
  { key: 'impressions', header: 'Impressões', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'impressions' } },
  { key: 'engagements', header: 'Engajamentos', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'engagements' } },
  { key: 'targetProfile', header: 'Perfil Alvo', sortable: true }
];

const demoColumns: TopTableColumn<AceDemographicBucket>[] = [
  { key: 'ageRange', header: 'Faixa Etária', sortable: true },
  { key: 'gender', header: 'Gênero', sortable: true },
  { key: 'detections', header: 'Detecções', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'detections' } },
  { key: 'engagements', header: 'Engajamentos', sortable: true, numeric: true, align: 'right' },
  { key: 'avgDurationSec', header: 'Duração média (s)', sortable: true, numeric: true, align: 'right' }
];

export const AceDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const data = useAppSelector((s) => s.dashboards.ace);
  const loading = useAppSelector((s) => s.dashboards.loading.ace);
  const error = useAppSelector((s) => s.dashboards.error.ace);
  const filters = useAppSelector((s) => s.dashboards.activeFilters);
  const cachePolicy = useAppSelector((s) => ({ useCache: s.dashboards.useCache, ttlSec: s.dashboards.ttlSec }));

  useEffect(() => {
    dispatch(fetchAceDashboard({ filters, useCache: cachePolicy.useCache, ttlSec: cachePolicy.ttlSec }));
    return () => {
      dispatch(clearKind('ace'));
    };
  }, [dispatch, filters, cachePolicy.useCache, cachePolicy.ttlSec]);

  const update = <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) =>
    dispatch(setActiveFilters({ [k]: v } as Partial<DashboardFilters> as DashboardFilters));

  const onRefresh = () => {
    dispatch(fetchAceDashboard({ filters, useCache: false, ttlSec: cachePolicy.ttlSec }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 3 }} useFlexGap>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t('dashboards:ace.title', 'Dashboard ACE')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboards:ace.subtitle', 'Reconhecimento facial, audiência demográfica e engajamento por conteúdo.')}
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearKind('ace'))}>
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
                title={t('dashboards:ace.kpi.totalDetections', 'Detecções totais')}
                value={data?.kpis.totalDetections.value ?? 0}
                previous={data?.kpis.totalDetections.previous}
                deltaPercent={data?.kpis.totalDetections.deltaPercent}
                trend={data?.kpis.totalDetections.trend}
                unit="pessoas"
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:ace.kpi.uniqueFaces', 'Faces únicas')}
                value={data?.kpis.uniqueFaces.value ?? 0}
                previous={data?.kpis.uniqueFaces.previous}
                deltaPercent={data?.kpis.uniqueFaces.deltaPercent}
                trend={data?.kpis.uniqueFaces.trend}
                unit="pessoas"
                color="info"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:ace.kpi.engagementRate', 'Taxa engajamento')}
                value={data?.kpis.engagementRate.value ?? 0}
                previous={data?.kpis.engagementRate.previous}
                deltaPercent={data?.kpis.engagementRate.deltaPercent}
                trend={data?.kpis.engagementRate.trend}
                unit="%"
                progress={data?.kpis.engagementRate.value}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:ace.kpi.recallRate', 'Recall')}
                value={data?.kpis.recallRate.value ?? 0}
                previous={data?.kpis.recallRate.previous}
                deltaPercent={data?.kpis.recallRate.deltaPercent}
                trend={data?.kpis.recallRate.trend}
                unit="%"
                progress={data?.kpis.recallRate.value}
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 12, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:ace.kpi.avgWatchTime', 'Tempo médio')}
                value={data?.kpis.avgWatchTimeSec.value ?? 0}
                previous={data?.kpis.avgWatchTimeSec.previous}
                deltaPercent={data?.kpis.avgWatchTimeSec.deltaPercent}
                trend={data?.kpis.avgWatchTimeSec.trend}
                unit="s"
                color="info"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <HeatmapGrid
            title={t('dashboards:ace.demographicHeatmap.title', 'Audiência × Faixa Etária')}
            subheader={t('dashboards:ace.demographicHeatmap.subheader', 'Densidade de detecções (colunas) por perfil demográfico (linhas).')}
            cells={(data?.demographicHeatmap ?? []) as HeatmapCellData[]}
            xLabel="Hora / Dia"
            yLabel="Perfil"
            valueLabel="Detecções"
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <UptimeGauge
            title={t('dashboards:ace.recallGauge.title', 'Recall Facial')}
            subheader={t('dashboards:ace.recallGauge.subheader', 'Engajados / Detectados.')}
            value={(data?.recall.recallRate ?? 0) * 100}
            label={t('dashboards:ace.recallGauge.label', 'Taxa de Recall')}
            size={180}
            extraStats={[
              { label: 'Detecções', value: data?.recall.totalDetections ?? 0 },
              { label: 'Faces únicas', value: data?.recall.uniqueFaces ?? 0 },
              { label: 'Engajados', value: data?.recall.engagedFaces ?? 0 },
              { label: 'Duração média (s)', value: data?.recall.avgEngagementDurationSec?.toFixed(1) ?? '—' }
            ]}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <TimelineChart
            title={t('dashboards:ace.audienceTimeline.title', 'Audiência por Horário')}
            subheader={t('dashboards:ace.audienceTimeline.subheader', 'Detectados vs. Engajados por janela temporal.')}
            points={
              (data?.audienceTimeline ?? []).flatMap<AceAudienceTimeline extends infer T ? any : never>((p) => [
                {
                  label: `${p.weekday} ${String(p.hour).padStart(2, '0')}h`,
                  value: p.detected,
                  group: 'Detectados',
                  timestamp: new Date().toISOString()
                },
                {
                  label: `${p.weekday} ${String(p.hour).padStart(2, '0')}h`,
                  value: p.engaged,
                  group: 'Engajados',
                  timestamp: new Date().toISOString()
                }
              ])
            }
            showLegend
            yLabel="Pessoas"
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <TopTable
            title={t('dashboards:ace.demographicBuckets.title', 'Distribuição Demográfica')}
            columns={demoColumns}
            rows={data?.demographicBuckets ?? []}
            defaultOrderBy="detections"
            maxRows={10}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TopTable
            title={t('dashboards:ace.topContents.title', 'Top Conteúdos por Perfil')}
            columns={topContentColumns}
            rows={data?.topContents ?? []}
            defaultOrderBy="impressions"
            maxRows={20}
            sizeTag={`TOP ${Math.min(20, data?.topContents.length ?? 0)}`}
            stickyHeader
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TopTable
            title={t('dashboards:ace.audienceTimeline.tableTitle', 'Detalhe Audiência')}
            columns={audienceColumns}
            rows={data?.audienceTimeline ?? []}
            defaultOrderBy="detected"
            maxRows={50}
            stickyHeader
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AceDashboardPage;

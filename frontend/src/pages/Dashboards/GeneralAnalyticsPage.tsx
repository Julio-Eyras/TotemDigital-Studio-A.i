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
  Tooltip,
  Divider
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchGeneralDashboard,
  setActiveFilters,
  clearKind
} from '../../../store/slices/dashboardsSlice';
import type { DashboardFilters } from '../../../services/api/dashboardsApi';

import {
  KpiCard,
  TimelineChart,
  UptimeGauge,
  TopTable,
  type TopTableColumn
} from '../../../components/dashboards/widgets';
import type {
  GeneralMediaStat,
  GeneralCampaignStat,
  GeneralPlaylistStat,
  TimeSeriesPoint
} from '../../../services/api/dashboardsApi';

const mediaColumns: TopTableColumn<GeneralMediaStat>[] = [
  { key: 'mediaName', header: 'Mídia', sortable: true, width: '38%' },
  { key: 'mediaType', header: 'Tipo', sortable: true },
  { key: 'impressions', header: 'Impressões', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'impressions' } },
  { key: 'plays', header: 'Plays', sortable: true, numeric: true, align: 'right' },
  {
    key: 'ctrPercent',
    header: 'CTR (%)',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => `${Number(v).toFixed(2)}%`,
    progressBar: { valueKey: 'ctrPercent' }
  },
  {
    key: 'avgWatchPercent',
    header: 'Watch %',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '–'),
    progressBar: { valueKey: 'avgWatchPercent', max: 100 }
  }
];

const campaignColumns: TopTableColumn<GeneralCampaignStat>[] = [
  { key: 'campaignName', header: 'Campanha', sortable: true, width: '32%' },
  { key: 'impressions', header: 'Impressões', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'impressions' } },
  { key: 'clicks', header: 'Cliques', sortable: true, numeric: true, align: 'right' },
  { key: 'conversions', header: 'Conversões', sortable: true, numeric: true, align: 'right' },
  {
    key: 'budgetSpent',
    header: 'Budget usado',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => (typeof v === 'number' ? `R$ ${v.toFixed(2)}` : '–')
  },
  { key: 'roi', header: 'ROI', sortable: true, numeric: true, align: 'right' }
];

const playlistColumns: TopTableColumn<GeneralPlaylistStat>[] = [
  { key: 'playlistName', header: 'Playlist', sortable: true, width: '38%' },
  { key: 'impressions', header: 'Impressões', sortable: true, numeric: true, align: 'right', progressBar: { valueKey: 'impressions' } },
  { key: 'plays', header: 'Plays', sortable: true, numeric: true, align: 'right' },
  {
    key: 'skipRate',
    header: 'Skip rate',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => (typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '–'),
    progressBar: { valueKey: 'skipRate', max: 1 }
  },
  {
    key: 'avgCompletionPercent',
    header: 'Conclusão (%)',
    sortable: true,
    numeric: true,
    align: 'right',
    format: (_r, v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '–'),
    progressBar: { valueKey: 'avgCompletionPercent', max: 100 }
  }
];

export const GeneralAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const data = useAppSelector((s) => s.dashboards.general);
  const loading = useAppSelector((s) => s.dashboards.loading.general);
  const error = useAppSelector((s) => s.dashboards.error.general);
  const filters = useAppSelector((s) => s.dashboards.activeFilters);
  const cachePolicy = useAppSelector((s) => ({ useCache: s.dashboards.useCache, ttlSec: s.dashboards.ttlSec }));

  useEffect(() => {
    dispatch(fetchGeneralDashboard({ filters, useCache: cachePolicy.useCache, ttlSec: cachePolicy.ttlSec }));
    return () => {
      dispatch(clearKind('general'));
    };
  }, [dispatch, filters, cachePolicy.useCache, cachePolicy.ttlSec]);

  const update = <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) =>
    dispatch(setActiveFilters({ [k]: v } as Partial<DashboardFilters> as DashboardFilters));

  const onRefresh = () => dispatch(fetchGeneralDashboard({ filters, useCache: false, ttlSec: cachePolicy.ttlSec }));

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 3 }} useFlexGap>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t('dashboards:general.title', 'Analytics Gerais')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboards:general.subtitle', 'Impressões, plays, CTR, fleet, campanhas e billing.')}
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearKind('general'))}>
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
                title={t('dashboards:general.kpi.totalImpressions', 'Impressões')}
                value={data?.kpis.totalImpressions.value ?? 0}
                previous={data?.kpis.totalImpressions.previous}
                deltaPercent={data?.kpis.totalImpressions.deltaPercent}
                trend={data?.kpis.totalImpressions.trend}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:general.kpi.totalPlays', 'Plays')}
                value={data?.kpis.totalPlays.value ?? 0}
                previous={data?.kpis.totalPlays.previous}
                deltaPercent={data?.kpis.totalPlays.deltaPercent}
                trend={data?.kpis.totalPlays.trend}
                color="info"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:general.kpi.ctrPercent', 'CTR playlist')}
                value={data?.kpis.ctrPercent.value ?? 0}
                previous={data?.kpis.ctrPercent.previous}
                deltaPercent={data?.kpis.ctrPercent.deltaPercent}
                trend={data?.kpis.ctrPercent.trend}
                unit="%"
                progress={data?.kpis.ctrPercent.value}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:general.kpi.avgWatchTimeSec', 'Watch Time')}
                value={data?.kpis.avgWatchTimeSec.value ?? 0}
                previous={data?.kpis.avgWatchTimeSec.previous}
                deltaPercent={data?.kpis.avgWatchTimeSec.deltaPercent}
                trend={data?.kpis.avgWatchTimeSec.trend}
                unit="s"
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 2.4 }}>
              <KpiCard
                title={t('dashboards:general.kpi.fleetUptimePercent', 'Uptime Fleet')}
                value={data?.kpis.fleetUptimePercent.value ?? 0}
                previous={data?.kpis.fleetUptimePercent.previous}
                deltaPercent={data?.kpis.fleetUptimePercent.deltaPercent}
                trend={data?.kpis.fleetUptimePercent.trend}
                unit="%"
                progress={data?.kpis.fleetUptimePercent.value}
                color="success"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={2.5} mb={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <TimelineChart
            title={t('dashboards:general.impressionsTimeline.title', 'Impressões no período')}
            subheader={t('dashboards:general.impressionsTimeline.subheader', 'Volume de impressões ao longo do tempo.')}
            points={(data?.impressionsTimeline ?? []) as TimeSeriesPoint[]}
            showLegend
            yLabel="Impressões"
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <UptimeGauge
            title={t('dashboards:general.fleetGauge.title', 'Status Fleet')}
            subheader={t('dashboards:general.fleetGauge.subheader', 'Saúde geral dos totens.')}
            value={data?.fleet.avgUptimePercent ?? 0}
            label={t('dashboards:general.fleetGauge.label', '% Uptime')}
            extraStats={[
              { label: 'Totais', value: data?.fleet.total ?? 0 },
              { label: 'Online', value: data?.fleet.online ?? 0 },
              { label: 'Warning', value: data?.fleet.warning ?? 0 },
              { label: 'Offline', value: data?.fleet.offline ?? 0 },
              { label: 'Heartbeats (24h)', value: data?.fleet.totalHeartbeats24h ?? 0 }
            ]}
          />
        </Grid>
      </Grid>

      {data?.billing ? (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" spacing={2} useFlexGap alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('dashboards:general.billing.title', 'Resumo Billing')}
            </Typography>
            {data.billing.plan ? (
              <Chip label={data.billing.plan} variant="outlined" color="primary" />
            ) : null}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.metered.impressions', 'Impressões')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {data.billing.meteredUsage?.impressions ?? 0}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.metered.bandwidth', 'Banda larga (MB)')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {data.billing.meteredUsage?.bandwidthMB ?? 0}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.metered.storage', 'Armazenamento (MB)')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {data.billing.meteredUsage?.storageMB ?? 0}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.metered.aiCredits', 'Créditos IA')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {data.billing.meteredUsage?.aiCreditsUsed ?? 0}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.currentMonthCost', 'Custo do mês')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {typeof data.billing.currentMonthCost === 'number'
                  ? `R$ ${data.billing.currentMonthCost.toFixed(2)}`
                  : '–'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboards:general.billing.projectedCost', 'Projetado')}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {typeof data.billing.projectedCost === 'number'
                  ? `R$ ${data.billing.projectedCost.toFixed(2)}`
                  : '–'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <TopTable
            title={t('dashboards:general.topMedias.title', 'Top Mídias')}
            columns={mediaColumns}
            rows={data?.topMedias ?? []}
            defaultOrderBy="impressions"
            maxRows={20}
            stickyHeader
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <TopTable
            title={t('dashboards:general.topCampaigns.title', 'Top Campanhas')}
            columns={campaignColumns}
            rows={data?.topCampaigns ?? []}
            defaultOrderBy="impressions"
            maxRows={20}
            stickyHeader
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TopTable
            title={t('dashboards:general.playlists.title', 'Playlists Mais Executadas')}
            columns={playlistColumns}
            rows={data?.playlists ?? []}
            defaultOrderBy="impressions"
            maxRows={30}
            stickyHeader
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default GeneralAnalyticsPage;

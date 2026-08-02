/**
 * Complementos do sistema — master switch multi-agência + opções avançadas.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Business, ExpandMore, Extension, Save } from '@mui/icons-material';
import { installationModulesApi } from '../../services/api';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { useAppSelector } from '../../store';
import type { InstallationModuleFlags } from '../../types/installationCapabilities';

type CatalogItem = {
  id: keyof InstallationModuleFlags;
  title: string;
  description: string;
  locked?: boolean;
  requires?: string[];
  group: 'core' | 'content' | 'commercial' | 'ops' | 'ux';
};

const GROUP_LABEL: Record<CatalogItem['group'], string> = {
  core: 'Núcleo',
  ux: 'Experiência / modos',
  content: 'Conteúdo',
  commercial: 'Comercial',
  ops: 'Operação avançada',
};

const PRESET_ON_LABELS = [
  'Várias organizações (multi-agência Pro)',
  'Anunciantes, contratos, planos e faturamento',
  'Campanhas, playlists avançadas e quick-publish',
  'Devices, OTA, dispatcher e analytics',
  'Menu Direct Totem desactiva-se (UI completa)',
];

const PRESET_LITE_LABELS = [
  'Várias organizações + publicar + mídias + devices',
  'Sem anunciantes, billing, campanhas nem playlists avançadas',
  'Direct Totem desactiva-se (mutuamente exclusivo)',
  'Para cadastrar anunciantes use Multi-agência Pro',
];

const PRESET_OFF_LABELS = [
  'Volta ao núcleo: Publicar em Totem + organização + mídias',
  'Direct Totem volta a activar-se automaticamente',
  'Superfícies comerciais ficam inacessíveis no menu/API',
  'Dados existentes NÃO são apagados',
  'Portal / SmartDisplayFX (avançado) também desligam com o modo',
];

const PURGE_CONFIRM_PHRASE = 'APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO';

type MultiAgencyMode = 'off' | 'lite' | 'full';

type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  severity: 'info' | 'warning' | 'blocking';
  detail?: string;
};

const SystemModules: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const { user } = useAppSelector((s) => s.auth);
  const canManage = user?.role === 'owner_system' || user?.role === 'admin_sql';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [modules, setModules] = useState<InstallationModuleFlags | null>(null);
  const [profile, setProfile] = useState<string>('');
  const [multiAgencyEnabled, setMultiAgencyEnabled] = useState(false);
  const [multiAgencyMode, setMultiAgencyMode] = useState<MultiAgencyMode>('off');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<MultiAgencyMode | null>(null);
  const [purgePreview, setPurgePreview] = useState<any>(null);
  const [purgePhrase, setPurgePhrase] = useState('');
  const [purgePublisherId, setPurgePublisherId] = useState('');
  const [purgeKeepMedia, setPurgeKeepMedia] = useState(true);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const [purgeCron, setPurgeCron] = useState('0 3 * * 0');
  const [purgeScheduleEnabled, setPurgeScheduleEnabled] = useState(false);
  const [portalBaseDomain, setPortalBaseDomain] = useState('');
  const [portalDnsMode, setPortalDnsMode] = useState<'off' | 'public_wildcard' | 'local_dnsmasq'>(
    'off'
  );
  const [portalSyncEnabled, setPortalSyncEnabled] = useState(false);
  const [portalDnsProvider, setPortalDnsProvider] = useState<'off' | 'manual' | 'cloudflare'>('off');
  const [portalCfZoneId, setPortalCfZoneId] = useState('');
  const [portalDnsIpv4, setPortalDnsIpv4] = useState('');
  const [portalSslEnabled, setPortalSslEnabled] = useState(false);
  const [portalSslEmail, setPortalSslEmail] = useState('');
  const [portalSeedSecond, setPortalSeedSecond] = useState(true);
  const [portalTokenConfigured, setPortalTokenConfigured] = useState(false);
  const [portalHosts, setPortalHosts] = useState<
    Array<{ role: string; slug: string; host: string; name: string }>
  >([]);
  const [portalPatterns, setPortalPatterns] = useState<Record<string, string | null>>({});
  const [portalSyncMsg, setPortalSyncMsg] = useState<string | null>(null);

  const markRestartNeeded = (needed: boolean) => {
    setRestartNeeded(needed);
    try {
      if (needed) sessionStorage.setItem('ssp.restartBackendNeeded', '1');
      else sessionStorage.removeItem('ssp.restartBackendNeeded');
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      setError('Apenas owner_system ou admin_sql podem gerir o modo multi-agência.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await installationModulesApi.getAll();
      setCatalog(Array.isArray(data?.catalog) ? data.catalog : []);
      setModules(data?.modules || null);
      setProfile(data?.profile || '');
      setMultiAgencyEnabled(Boolean(data?.multiAgencyEnabled ?? data?.modules?.multi_agency));
      setMultiAgencyMode((data?.multiAgencyMode as MultiAgencyMode) || 'off');
      setChecklist(Array.isArray(data?.activationChecklist?.items) ? data.activationChecklist.items : []);
      try {
        const sched = await installationModulesApi.getCommercialPurgeSchedule();
        if (sched?.schedule) {
          setPurgeCron(String(sched.schedule.cron_expression || '0 3 * * 0'));
          setPurgeScheduleEnabled(Boolean(sched.schedule.enabled));
        }
      } catch {
        /* schema antigo */
      }
      try {
        const portal = await installationModulesApi.getPortal();
        setPortalBaseDomain(portal?.settings?.baseDomain || '');
        setPortalDnsMode(portal?.settings?.dnsMode || 'off');
        setPortalSyncEnabled(Boolean(portal?.settings?.syncEnabled));
        setPortalDnsProvider(portal?.settings?.dnsProvider || 'off');
        setPortalCfZoneId(portal?.settings?.cloudflareZoneId || '');
        setPortalDnsIpv4(portal?.settings?.dnsTargetIpv4 || '');
        setPortalSslEnabled(Boolean(portal?.settings?.sslWildcardEnabled));
        setPortalSslEmail(portal?.settings?.sslEmail || '');
        setPortalSeedSecond(portal?.settings?.seedSecondAgency !== false);
        setPortalTokenConfigured(Boolean(portal?.settings?.cloudflareTokenConfigured));
        setPortalHosts(Array.isArray(portal?.hosts) ? portal.hosts : []);
        setPortalPatterns(portal?.patterns || {});
      } catch {
        /* portal opcional se schema antigo */
      }
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar modo da instalação'));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const byGroup = useMemo(() => {
    const map = new Map<CatalogItem['group'], CatalogItem[]>();
    for (const item of catalog) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [catalog]);

  const requestModeChange = (mode: MultiAgencyMode) => {
    if (saving || mode === multiAgencyMode) return;
    setPendingMode(mode);
    setConfirmOpen(true);
  };

  const confirmMasterToggle = async () => {
    if (pendingMode === null) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      setConfirmOpen(false);
      const result = await installationModulesApi.setMultiAgency(pendingMode);
      setModules(result.modules || modules);
      setMultiAgencyEnabled(Boolean(result.enabled));
      setMultiAgencyMode((result.mode as MultiAgencyMode) || pendingMode);
      setProfile(result.profile || profile);
      const needsRestart = Boolean(result.requiresBackendRestart);
      markRestartNeeded(needsRestart);
      if (needsRestart) {
        setSuccess(
          `${result.message || 'Modo actualizado.'} Hot-reload falhou — reinicie o backend. A UI vai recarregar.`
        );
      } else if (result.workersReconciled) {
        setSuccess(
          `${result.message || 'Modo actualizado.'} Workers aplicados em runtime. A aplicar menu…`
        );
      } else {
        setSuccess(`${result.message || 'Modo actualizado.'} A aplicar…`);
      }
      window.setTimeout(() => {
        window.location.reload();
      }, needsRestart ? 2200 : 900);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao alterar modo multi-agência'));
      setSaving(false);
    } finally {
      setPendingMode(null);
    }
  };

  const handleSavePortal = async () => {
    try {
      setSaving(true);
      setError(null);
      const data = await installationModulesApi.savePortal({
        baseDomain: portalBaseDomain,
        dnsMode: portalDnsMode,
        syncEnabled: portalSyncEnabled,
        dnsProvider: portalDnsProvider,
        cloudflareZoneId: portalCfZoneId,
        dnsTargetIpv4: portalDnsIpv4,
        sslWildcardEnabled: portalSslEnabled,
        sslEmail: portalSslEmail,
        seedSecondAgency: portalSeedSecond,
      });
      const s = data?.settings;
      setPortalBaseDomain(s?.baseDomain || portalBaseDomain);
      setPortalDnsMode(s?.dnsMode || portalDnsMode);
      setPortalDnsProvider(s?.dnsProvider || portalDnsProvider);
      setPortalCfZoneId(s?.cloudflareZoneId || '');
      setPortalDnsIpv4(s?.dnsTargetIpv4 || '');
      setPortalSslEnabled(Boolean(s?.sslWildcardEnabled));
      setPortalSslEmail(s?.sslEmail || '');
      setPortalSeedSecond(s?.seedSecondAgency !== false);
      setPortalTokenConfigured(Boolean(s?.cloudflareTokenConfigured));
      setSuccess('Definições de portal guardadas.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao guardar portal DNS'));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPortal = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await installationModulesApi.syncPortal({
        dryRunDns: true,
        applyCloudflare: portalDnsProvider === 'cloudflare',
      });
      setPortalSyncMsg(result.message || 'Sync concluído');
      setSuccess(result.message || 'Snippets Nginx/dnsmasq gerados');
      const portal = await installationModulesApi.getPortal();
      setPortalHosts(Array.isArray(portal?.hosts) ? portal.hosts : []);
      setPortalPatterns(portal?.patterns || {});
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao sincronizar portal hosts'));
    } finally {
      setSaving(false);
    }
  };

  const handleSimSsl = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await installationModulesApi.issuePortalSsl({ dryRun: true });
      setPortalSyncMsg(result.message || 'SSL simulado');
      setSuccess(result.message || 'Plano SSL gerado (sim)');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao simular SSL wildcard'));
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSecondAgency = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await installationModulesApi.seedSecondAgency();
      setSuccess(result.message || result.detail || 'Seed 2ª agência');
      const portal = await installationModulesApi.getPortal();
      setPortalHosts(Array.isArray(portal?.hosts) ? portal.hosts : []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar 2ª agência demo'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (id: keyof InstallationModuleFlags, checked: boolean) => {
    if (!modules) return;
    setModules({ ...modules, [id]: checked });
    setSuccess(null);
  };

  const handleSaveAdvanced = async () => {
    if (!modules) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const data = await installationModulesApi.update(modules);
      setModules(data?.modules || modules);
      setMultiAgencyEnabled(Boolean(data?.modules?.multi_agency));
      if (data?.profile) setProfile(data.profile);
      const needsRestart = Boolean(data?.requiresBackendRestart);
      markRestartNeeded(needsRestart);
      setSuccess(
        needsRestart
          ? 'Opções avançadas guardadas. Hot-reload falhou — reinicie o backend; a UI vai recarregar.'
          : data?.workersReconciled
            ? 'Opções avançadas guardadas. Workers aplicados em runtime. A aplicar menu…'
            : 'Opções avançadas guardadas. A aplicar…'
      );
      window.setTimeout(() => {
        window.location.reload();
      }, needsRestart ? 2200 : 600);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao guardar opções avançadas'));
    } finally {
      setSaving(false);
    }
  };

  const handlePurgePreview = async () => {
    try {
      setSaving(true);
      setPurgeMsg(null);
      const pubId = purgePublisherId.trim() ? Number(purgePublisherId) : null;
      const data = await installationModulesApi.previewCommercialPurge({
        publisherId: Number.isFinite(pubId as number) ? pubId : null,
        keepMediaFiles: purgeKeepMedia,
        keepPublishers: true,
      });
      setPurgePreview(data);
      setPurgeMsg(data?.message || 'Preview OK');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro no preview de purge'));
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeRun = async (dryRun: boolean) => {
    try {
      setSaving(true);
      setPurgeMsg(null);
      const pubId = purgePublisherId.trim() ? Number(purgePublisherId) : null;
      const result = await installationModulesApi.runCommercialPurge({
        dryRun,
        confirmPhrase: dryRun ? undefined : purgePhrase,
        publisherId: Number.isFinite(pubId as number) ? pubId : null,
        keepMediaFiles: purgeKeepMedia,
        keepPublishers: true,
      });
      setPurgePreview(result);
      setPurgeMsg(result.message || (dryRun ? 'Dry-run OK' : 'Purge executado'));
      if (!dryRun && result.ok) setPurgePhrase('');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao executar purge'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePurgeSchedule = async () => {
    try {
      setSaving(true);
      const result = await installationModulesApi.saveCommercialPurgeSchedule({
        cronExpression: purgeCron,
        enabled: purgeScheduleEnabled,
        keepMediaFiles: purgeKeepMedia,
        keepPublishers: true,
      });
      setPurgeMsg(result.message || 'Agendamento guardado');
      setSuccess(result.message || 'Agendamento de purge guardado');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao guardar agendamento'));
    } finally {
      setSaving(false);
    }
  };

  const confirmLabels =
    pendingMode === 'full'
      ? PRESET_ON_LABELS
      : pendingMode === 'lite'
        ? PRESET_LITE_LABELS
        : PRESET_OFF_LABELS;

  const modeLabel =
    multiAgencyMode === 'full' ? 'Pro' : multiAgencyMode === 'lite' ? 'Lite' : 'Desactivado';

  return (
    <Box>
      <PageHeader
        title="Complementos do sistema"
        subtitle="Modo de operação da instalação. Flags de utilizador (escudo) são outra camada."
        breadcrumbs={breadcrumbs}
        loading={loading || saving}
        onRefresh={() => void load()}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {restartNeeded && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => markRestartNeeded(false)}
        >
          Reinício do backend necessário: o hot-reload de workers falhou. Reinicie o serviço
          (ex.: <code>systemctl restart</code> ou o script de update da instância). Recarregar a
          UI não basta.
        </Alert>
      )}

      {!canManage ? (
        <Alert severity="warning">Apenas owner_system ou admin_sql podem gerir este modo.</Alert>
      ) : loading && !modules ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Card
            variant="outlined"
            sx={{
              mb: 3,
              borderColor: multiAgencyEnabled ? theme.palette.primary.main : theme.palette.divider,
              boxShadow: multiAgencyEnabled
                ? `inset 0 0 0 1px ${theme.palette.primary.main}`
                : undefined,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Business color={multiAgencyEnabled ? 'primary' : 'action'} sx={{ mt: 0.5 }} />
                <Box sx={{ flex: 1, minWidth: 240 }}>
                  <Typography variant="h6" fontWeight={800}>
                    Modo multi-agência
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Escolha Direct Totem (off), multi-agência lite (várias orgs sem anunciantes/ERP) ou
                    Pro completo (anunciantes, comercial, OTA). Portal e SmartDisplayFX ficam nas opções
                    avançadas.
                  </Typography>
                  {profile && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Perfil: <strong>{profile}</strong>
                      {' · '}
                      Estado:{' '}
                      <Chip
                        size="small"
                        color={multiAgencyEnabled ? 'primary' : 'default'}
                        label={modeLabel}
                        sx={{ ml: 0.5, fontWeight: 700 }}
                      />
                    </Typography>
                  )}
                </Box>
                <TextField
                  select
                  size="small"
                  label="Modo"
                  value={multiAgencyMode}
                  disabled={saving}
                  onChange={(e) => requestModeChange(e.target.value as MultiAgencyMode)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="off">Direct Totem (off)</MenuItem>
                  <MenuItem value="lite">Multi-agência lite</MenuItem>
                  <MenuItem value="full">Multi-agência Pro</MenuItem>
                </TextField>
              </Box>
              <Alert severity="info" sx={{ mt: 2 }} icon={<Extension />}>
                Desactivar não apaga dados — apenas esconde menu/API até voltar a activar.
              </Alert>
              {checklist.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Checklist de activação
                  </Typography>
                  <List dense>
                    {checklist.map((item) => (
                      <ListItem key={item.id} sx={{ py: 0.25, alignItems: 'flex-start' }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={600}>
                              {item.ok ? '✓' : '⚠'} {item.label}
                            </Typography>
                          }
                          secondary={item.detail}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                Portal DNS / Nginx
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Parametrização por organização e anunciante via slug. Padrões:{' '}
                <code>{portalPatterns.publisherTenant || '{slug}.publisher.…'}</code> ·{' '}
                <code>{portalPatterns.subscriberTenant || '{slug}.subscriber.…'}</code>
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Domínio base"
                    value={portalBaseDomain}
                    onChange={(e) => setPortalBaseDomain(e.target.value)}
                    helperText="Ex.: totemdigital.app.br (vazio = só .local)"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    label="Modo DNS"
                    value={portalDnsMode}
                    onChange={(e) =>
                      setPortalDnsMode(
                        e.target.value as 'off' | 'public_wildcard' | 'local_dnsmasq'
                      )
                    }
                  >
                    <MenuItem value="off">off</MenuItem>
                    <MenuItem value="public_wildcard">public_wildcard</MenuItem>
                    <MenuItem value="local_dnsmasq">local_dnsmasq</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={portalSyncEnabled}
                        onChange={(e) => setPortalSyncEnabled(e.target.checked)}
                      />
                    }
                    label="Sync automático (sudo)"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    label="Provedor DNS"
                    value={portalDnsProvider}
                    onChange={(e) =>
                      setPortalDnsProvider(e.target.value as 'off' | 'manual' | 'cloudflare')
                    }
                    helperText={
                      portalTokenConfigured
                        ? 'Token Cloudflare detectado no ambiente'
                        : 'Token: CLOUDFLARE_API_TOKEN no .env (nunca na BD)'
                    }
                  >
                    <MenuItem value="off">off</MenuItem>
                    <MenuItem value="manual">manual</MenuItem>
                    <MenuItem value="cloudflare">cloudflare</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Cloudflare Zone ID"
                    value={portalCfZoneId}
                    onChange={(e) => setPortalCfZoneId(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="IPv4 alvo (A records)"
                    value={portalDnsIpv4}
                    onChange={(e) => setPortalDnsIpv4(e.target.value)}
                    helperText="IP público do VPS"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={portalSslEnabled}
                        onChange={(e) => setPortalSslEnabled(e.target.checked)}
                      />
                    }
                    label="LE wildcard DNS-01"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Email Let's Encrypt"
                    value={portalSslEmail}
                    onChange={(e) => setPortalSslEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={portalSeedSecond}
                        onChange={(e) => setPortalSeedSecond(e.target.checked)}
                      />
                    }
                    label="Seed 2ª agência ao activar"
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button variant="contained" disabled={saving} onClick={() => void handleSavePortal()}>
                  Guardar portal
                </Button>
                <Button variant="outlined" disabled={saving} onClick={() => void handleSyncPortal()}>
                  Gerar / sync (DNS dry-run)
                </Button>
                <Button variant="outlined" disabled={saving} onClick={() => void handleSimSsl()}>
                  Simular SSL wildcard
                </Button>
                <Button
                  variant="outlined"
                  disabled={saving}
                  onClick={() => void handleSeedSecondAgency()}
                >
                  Seed 2ª agência
                </Button>
              </Box>
              {portalSyncMsg && (
                <Alert severity="info" sx={{ mt: 2 }} onClose={() => setPortalSyncMsg(null)}>
                  {portalSyncMsg}
                </Alert>
              )}
              {portalHosts.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Hosts com slug</Typography>
                  <List dense>
                    {portalHosts.map((h) => (
                      <ListItem key={`${h.role}-${h.slug}`} sx={{ py: 0 }}>
                        <ListItemText
                          primary={`${h.host}`}
                          secondary={`${h.role} · ${h.name} · slug=${h.slug}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>

          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mb: 2,
              border: `1px solid ${theme.palette.error.light}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(244,67,54,0.06)' : 'rgba(244,67,54,0.03)',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700} color="error">
                Zona de perigo — Purge de dados comerciais
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Independente do OFF do multi-agência. Dry-run por defeito. Execução real exige a frase
                exacta: <code>{PURGE_CONFIRM_PHRASE}</code>
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="publisher_id (opcional)"
                    value={purgePublisherId}
                    onChange={(e) => setPurgePublisherId(e.target.value)}
                    helperText="Vazio = instalação inteira"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={purgeKeepMedia}
                        onChange={(e) => setPurgeKeepMedia(e.target.checked)}
                      />
                    }
                    label="Manter ficheiros de media"
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Frase de confirmação (só para execução real)"
                    value={purgePhrase}
                    onChange={(e) => setPurgePhrase(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="outlined" disabled={saving} onClick={() => void handlePurgePreview()}>
                      Pré-visualizar
                    </Button>
                    <Button variant="outlined" disabled={saving} onClick={() => void handlePurgeRun(true)}>
                      Dry-run
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      disabled={saving || purgePhrase !== PURGE_CONFIRM_PHRASE}
                      onClick={() => void handlePurgeRun(false)}
                    >
                      Executar purge
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Cron do agendamento"
                    value={purgeCron}
                    onChange={(e) => setPurgeCron(e.target.value)}
                    helperText="Ex.: 0 3 * * 0 (domingo 03:00)"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={purgeScheduleEnabled}
                        onChange={(e) => setPurgeScheduleEnabled(e.target.checked)}
                      />
                    }
                    label="Agendamento activo"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={saving}
                    onClick={() => void handleSavePurgeSchedule()}
                  >
                    Guardar agenda
                  </Button>
                </Grid>
              </Grid>
              {purgeMsg && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {purgeMsg}
                </Alert>
              )}
              {purgePreview && (
                <Box
                  component="pre"
                  sx={{
                    mt: 2,
                    p: 1.5,
                    maxHeight: 240,
                    overflow: 'auto',
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(
                    {
                      counts: purgePreview.counts,
                      warnings: purgePreview.warnings,
                      deleted: purgePreview.deleted,
                      filesDeleted: purgePreview.filesDeleted,
                      message: purgePreview.message,
                    },
                    null,
                    2
                  )}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700}>Opções avançadas (módulos individuais)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Preferir o botão multi-agência. Alterações manuais podem criar estados inconsistentes.
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  disabled={saving || !modules}
                  onClick={() => void handleSaveAdvanced()}
                >
                  Guardar avançado
                </Button>
              </Box>
              <Grid container spacing={2}>
                {(['core', 'ux', 'content', 'commercial', 'ops'] as const).map((group) => {
                  const items = byGroup.get(group) || [];
                  if (!items.length) return null;
                  return (
                    <Grid item xs={12} key={group}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {GROUP_LABEL[group]}
                      </Typography>
                      <Divider sx={{ mb: 1.5 }} />
                      <Grid container spacing={1}>
                        {items.map((item) => {
                          const enabled = modules?.[item.id] === true;
                          return (
                            <Grid item xs={12} md={6} key={item.id}>
                              <Box
                                sx={{
                                  p: 1.5,
                                  borderRadius: 1,
                                  border: `1px solid ${theme.palette.divider}`,
                                }}
                              >
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={enabled}
                                      disabled={!!item.locked || saving}
                                      onChange={(e) => handleToggle(item.id, e.target.checked)}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2" fontWeight={700}>
                                        {item.title}
                                        {item.locked && (
                                          <Chip size="small" label="Núcleo" sx={{ ml: 1 }} />
                                        )}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {item.description}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => (!saving ? setConfirmOpen(false) : undefined)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {pendingMode === 'full'
            ? 'Activar multi-agência Pro?'
            : pendingMode === 'lite'
              ? 'Activar multi-agência lite?'
              : 'Desactivar modo multi-agência?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Isto aplica um preset completo (não um módulo isolado):
          </Typography>
          <List dense>
            {confirmLabels.map((text) => (
              <ListItem key={text} sx={{ py: 0.25 }}>
                <ListItemText primary={text} />
              </ListItem>
            ))}
          </List>
          <Alert severity="info" sx={{ mt: 1 }}>
            Workers (Bull, billing, playlists) tentam ligar/desligar em runtime. Só será preciso
            reiniciar o backend se o hot-reload falhar.
          </Alert>
          {pendingMode && pendingMode !== 'off' && checklist.some((i) => !i.ok && i.severity === 'warning') && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Há avisos no checklist (ex.: organização ou Redis). Pode activar na mesma; corrija depois se
              necessário.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={pendingMode === 'off' ? 'warning' : 'primary'}
            disabled={saving}
            onClick={() => void confirmMasterToggle()}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemModules;

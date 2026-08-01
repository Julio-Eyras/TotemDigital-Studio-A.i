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
  Switch,
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
  'Várias organizações (multi-agência)',
  'Anunciantes, contratos, planos e faturamento',
  'Campanhas, playlists avançadas e quick-publish',
  'Devices, OTA, dispatcher e analytics',
  'Menu Direct Totem desactiva-se (UI completa)',
];

const PRESET_OFF_LABELS = [
  'Volta ao núcleo: Publicar em Totem + organização + mídias',
  'Direct Totem volta a activar-se automaticamente',
  'Superfícies comerciais ficam inacessíveis no menu/API',
  'Dados existentes NÃO são apagados',
  'Portal / SmartDisplayFX (avançado) também desligam com o modo',
];

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [modules, setModules] = useState<InstallationModuleFlags | null>(null);
  const [profile, setProfile] = useState<string>('');
  const [multiAgencyEnabled, setMultiAgencyEnabled] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [restartNeeded, setRestartNeeded] = useState(() => {
    try {
      return sessionStorage.getItem('ssp.restartBackendNeeded') === '1';
    } catch {
      return false;
    }
  });

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
      setChecklist(Array.isArray(data?.activationChecklist?.items) ? data.activationChecklist.items : []);
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

  const requestMasterToggle = (checked: boolean) => {
    if (saving) return;
    setPendingEnabled(checked);
    setConfirmOpen(true);
  };

  const confirmMasterToggle = async () => {
    if (pendingEnabled === null) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      setConfirmOpen(false);
      const result = await installationModulesApi.setMultiAgency(pendingEnabled);
      setModules(result.modules || modules);
      setMultiAgencyEnabled(Boolean(result.enabled));
      setProfile(result.profile || profile);
      const needsRestart = Boolean(result.requiresBackendRestart);
      markRestartNeeded(needsRestart);
      if (needsRestart) {
        setSuccess(
          `${result.message || 'Modo actualizado.'} A UI vai recarregar — reinicie também o serviço backend.`
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
      setPendingEnabled(null);
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
          ? 'Opções avançadas guardadas. Reinicie o backend para filas/workers; a UI vai recarregar.'
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

  const confirmLabels = pendingEnabled ? PRESET_ON_LABELS : PRESET_OFF_LABELS;

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
          Reinício do backend necessário: filas Bull, billing e playlist mix/engine só mudam no
          arranque do serviço (ex.: <code>systemctl restart</code> ou o script de update da
          instância). Recarregar a UI não basta.
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
                    Um único interruptor para alternar entre operação núcleo (TotemDigital) e rede
                    Pro (várias organizações, anunciantes, comercial). Portal e SmartDisplayFX
                    ficam nas opções avançadas.
                  </Typography>
                  {profile && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Perfil: <strong>{profile}</strong>
                      {' · '}
                      Estado:{' '}
                      <Chip
                        size="small"
                        color={multiAgencyEnabled ? 'primary' : 'default'}
                        label={multiAgencyEnabled ? 'Activado' : 'Desactivado'}
                        sx={{ ml: 0.5, fontWeight: 700 }}
                      />
                    </Typography>
                  )}
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={multiAgencyEnabled}
                      disabled={saving}
                      color="primary"
                      onChange={(e) => requestMasterToggle(e.target.checked)}
                    />
                  }
                  label={multiAgencyEnabled ? 'Activado' : 'Desactivado'}
                  sx={{ ml: 0 }}
                />
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
          {pendingEnabled ? 'Activar modo multi-agência?' : 'Desactivar modo multi-agência?'}
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
          <Alert severity="warning" sx={{ mt: 1 }}>
            Após confirmar, reinicie o backend para aplicar/parar workers (Bull, billing, playlists).
          </Alert>
          {pendingEnabled && checklist.some((i) => !i.ok && i.severity === 'warning') && (
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
            color={pendingEnabled ? 'primary' : 'warning'}
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

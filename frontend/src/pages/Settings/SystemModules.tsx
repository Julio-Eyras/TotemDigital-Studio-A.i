/**
 * Complementos do sistema — Fase A (persistência + painel).
 * Módulos = produto da instalação; flag_smart_* = permissão por utilizador.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Switch,
  Typography,
  useTheme,
} from '@mui/material';
import { Extension, Save } from '@mui/icons-material';
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
  const [phaseNote, setPhaseNote] = useState('');

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      setError('Apenas owner_system ou admin_sql podem gerir complementos.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await installationModulesApi.getAll();
      setCatalog(Array.isArray(data?.catalog) ? data.catalog : []);
      setModules(data?.modules || null);
      setProfile(data?.profile || '');
      setPhaseNote(
        data?.enforcement === 'menu_and_api'
          ? 'Fase B: os interruptores afectam menu e API. Após Guardar, a página recarrega para aplicar.'
          : 'As alterações são guardadas na instalação.'
      );
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar complementos'));
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

  const handleToggle = (id: keyof InstallationModuleFlags, checked: boolean) => {
    if (!modules) return;
    setModules({ ...modules, [id]: checked });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!modules) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const data = await installationModulesApi.update(modules);
      setModules(data?.modules || modules);
      setSuccess('Complementos guardados. A aplicar…');
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao guardar complementos'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Complementos do sistema"
        subtitle="Active ou desactive módulos de produto desta instalação (não confundir com flags de utilizador)."
        breadcrumbs={breadcrumbs}
        loading={loading || saving}
        onRefresh={() => void load()}
        actions={[
          {
            label: 'Guardar',
            icon: <Save />,
            onClick: () => void handleSave(),
            variant: 'contained',
          },
        ]}
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
      {phaseNote && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<Extension />}>
          {phaseNote}
        </Alert>
      )}

      {profile && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Perfil actual da instalação: <strong>{profile}</strong>
        </Typography>
      )}

      {!canManage ? (
        <Alert severity="warning">Apenas owner_system ou admin_sql podem gerir complementos.</Alert>
      ) : loading && !modules ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {(['core', 'ux', 'content', 'commercial', 'ops'] as const).map((group) => {
            const items = byGroup.get(group) || [];
            if (!items.length) return null;
            return (
              <Grid item xs={12} key={group}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {GROUP_LABEL[group]}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
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
                                bgcolor: theme.palette.background.paper,
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
                                    <Typography variant="body1" fontWeight={700}>
                                      {item.title}
                                      {item.locked && (
                                        <Chip
                                          size="small"
                                          label="Núcleo"
                                          sx={{ ml: 1 }}
                                          color="default"
                                        />
                                      )}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {item.description}
                                    </Typography>
                                    {item.requires?.length ? (
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        Requer: {item.requires.join(', ')}
                                      </Typography>
                                    ) : null}
                                  </Box>
                                }
                              />
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default SystemModules;

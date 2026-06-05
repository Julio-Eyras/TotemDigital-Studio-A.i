import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, ContentCopy, Edit, Refresh, Save } from '@mui/icons-material';
import type { QuickPublishPreset } from '../../services/api';
import { PUBLISH_PRESETS } from '../../config/publishTemplates';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { publishTemplatesApi, PublishTemplateDto } from '../../services/api';
import { TemplatePreviewStrip } from '../../components/Publish/TemplatePreviewStrip';
import { findPublishPreset } from '../../config/publishTemplates';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const ICON_KEYS = ['storefront', 'campaign', 'tv', 'auto_awesome', 'business'] as const;

const PublishTemplatesAdmin: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [templates, setTemplates] = useState<PublishTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PublishTemplateDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    preset: 'ad' as QuickPublishPreset,
    title: '',
    segment: 'retail',
    description: '',
    headline: '',
    featured: false,
    featuredSort: 0,
    recommendedDurationMs: 10000,
    accentColor: '#1976d2',
    backgroundCss: '',
    preferredOrientation: 'landscape' as 'portrait' | 'landscape',
    iconKey: 'campaign',
  });
  const [form, setForm] = useState({
    title: '',
    headline: '',
    description: '',
    featured: false,
    featuredSort: 0,
    recommendedDurationMs: 10000,
    accentColor: '#1976d2',
    backgroundCss: '',
    preferredOrientation: 'landscape' as 'portrait' | 'landscape',
    iconKey: 'campaign',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publishTemplatesApi.getAll();
      setTemplates(res.data || []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar templates.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row: PublishTemplateDto) => {
    setEditRow(row);
    setForm({
      title: row.title,
      headline: row.headline || '',
      description: row.description || '',
      featured: row.featured,
      featuredSort: row.featuredSort,
      recommendedDurationMs: row.recommendedDurationMs,
      accentColor: row.accentColor || '#1976d2',
      backgroundCss: row.backgroundCss || findPublishPreset(row.preset).background,
      preferredOrientation: row.preferredOrientation,
      iconKey: row.iconKey,
    });
  };

  const handleSave = async () => {
    if (!editRow) return;
    try {
      await publishTemplatesApi.update(editRow.templateId, form);
      setSuccess('Template atualizado.');
      setEditRow(null);
      await load();
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar template.'));
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      setError('Informe o título do template.');
      return;
    }
    try {
      await publishTemplatesApi.create(createForm);
      setSuccess('Template criado.');
      setCreateOpen(false);
      setCreateForm({
        preset: 'ad',
        title: '',
        segment: 'retail',
        description: '',
        headline: '',
        featured: false,
        featuredSort: 0,
        recommendedDurationMs: 10000,
        accentColor: '#1976d2',
        backgroundCss: '',
        preferredOrientation: 'landscape',
        iconKey: 'campaign',
      });
      await load();
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar template.'));
    }
  };

  const handleDuplicate = async (row: PublishTemplateDto) => {
    try {
      await publishTemplatesApi.duplicate(row.templateId);
      setSuccess('Template duplicado.');
      await load();
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao duplicar template.'));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Templates de publicação"
        subtitle="Administração dos modelos do dashboard e da publicação rápida (BD publish_templates)."
        breadcrumbs={breadcrumbs}
        actions={[
          { label: 'Novo template', icon: <Add />, onClick: () => setCreateOpen(true), variant: 'contained' },
          { label: 'Recarregar', icon: <Refresh />, onClick: load, variant: 'outlined' },
        ]}
        loading={loading}
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
      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Preview</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Preset</TableCell>
                <TableCell>Destaque</TableCell>
                <TableCell>Ordem</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((row) => {
                const preset = findPublishPreset(row.preset);
                return (
                  <TableRow key={row.templateId}>
                    <TableCell sx={{ width: 160 }}>
                      <TemplatePreviewStrip preset={preset} height={48} />
                    </TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.preset}</TableCell>
                    <TableCell>{row.featured ? 'Sim' : 'Não'}</TableCell>
                    <TableCell>{row.featuredSort}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<Edit />} onClick={() => openEdit(row)} sx={{ mr: 0.5 }}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ContentCopy />}
                        onClick={() => handleDuplicate(row)}
                      >
                        Duplicar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Preset</InputLabel>
                <Select
                  label="Preset"
                  value={createForm.preset}
                  onChange={(e) => {
                    const preset = e.target.value as QuickPublishPreset;
                    const cfg = findPublishPreset(preset);
                    setCreateForm({
                      ...createForm,
                      preset,
                      recommendedDurationMs: cfg.recommendedDurationMs,
                      backgroundCss: cfg.background,
                      preferredOrientation: cfg.preferredOrientation,
                    });
                  }}
                >
                  {PUBLISH_PRESETS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Segmento"
                value={createForm.segment}
                onChange={(e) => setCreateForm({ ...createForm, segment: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Descrição"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Headline (preview)"
                value={createForm.headline}
                onChange={(e) => setCreateForm({ ...createForm, headline: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Ordem destaque"
                value={createForm.featuredSort}
                onChange={(e) => setCreateForm({ ...createForm, featuredSort: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Duração (ms)"
                value={createForm.recommendedDurationMs}
                onChange={(e) =>
                  setCreateForm({ ...createForm, recommendedDurationMs: Number(e.target.value) })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createForm.featured}
                    onChange={(e) => setCreateForm({ ...createForm, featured: e.target.checked })}
                  />
                }
                label="Exibir em destaque no dashboard"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleCreate}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar template #{editRow?.templateId}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Headline (preview)"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Descrição"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Ordem destaque"
                value={form.featuredSort}
                onChange={(e) => setForm({ ...form, featuredSort: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Duração (ms)"
                value={form.recommendedDurationMs}
                onChange={(e) => setForm({ ...form, recommendedDurationMs: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Cor destaque"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Orientação</InputLabel>
                <Select
                  label="Orientação"
                  value={form.preferredOrientation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preferredOrientation: e.target.value as 'portrait' | 'landscape',
                    })
                  }
                >
                  <MenuItem value="portrait">Vertical 9:16</MenuItem>
                  <MenuItem value="landscape">Horizontal 16:9</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Background CSS"
                value={form.backgroundCss}
                onChange={(e) => setForm({ ...form, backgroundCss: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Ícone</InputLabel>
                <Select
                  label="Ícone"
                  value={form.iconKey}
                  onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                >
                  {ICON_KEYS.map((k) => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                }
                label="Exibir em destaque no dashboard"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)}>Cancelar</Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublishTemplatesAdmin;

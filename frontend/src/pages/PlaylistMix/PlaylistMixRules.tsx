import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  Shuffle,
  SmartToy,
  Settings,
} from '@mui/icons-material';
import { getMixRules, createMixRule, updateMixRule, deleteMixRule, MixRule } from '../../services/api/playlistMixApi';
import { totemApi, Player } from '../../services/api';
import { getForeignTotemIdFromRow, getTotemIdFromRow } from '../../utils/totemRowIds';

const PlaylistMixRules: React.FC = () => {
  const theme = useTheme();
  const [rules, setRules] = useState<MixRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MixRule | null>(null);

  const [scopeTotems, setScopeTotems] = useState<Player[]>([]);
  const [loadingScopeTotems, setLoadingScopeTotems] = useState(false);
  const [scopeTotemsError, setScopeTotemsError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    totem_id: null as number | null,
    rule_type: 'systematic' as 'systematic' | 'ai' | 'hybrid',
    priority_weight: 1.0,
    time_weight: 1.0,
    tag_weight: 0.5,
    subscriber_weight: 0.5,
    ai_enabled: false,
    ai_provider: '',
    ai_model: '',
    use_pedestrian_detection: false,
    use_sentiment_analysis: false,
    use_context_awareness: false,
    use_historical_optimization: false,
    max_items_per_playlist: 50,
    rotation_strategy: 'round_robin' as 'round_robin' | 'priority' | 'weighted' | 'ai_optimized',
    shuffle_enabled: false,
    is_default: false,
    is_active: true,
  });

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingScopeTotems(true);
      setScopeTotemsError(null);
      try {
        const res = await totemApi.getAll({ page: 1, limit: 500 });
        if (!cancelled) setScopeTotems(Array.isArray(res?.data) ? res.data : []);
      } catch (e: any) {
        if (!cancelled) {
          setScopeTotems([]);
          setScopeTotemsError(
            e?.response?.data?.error || e?.message || 'Não foi possível carregar a lista de totems.'
          );
        }
      } finally {
        if (!cancelled) setLoadingScopeTotems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  const totemIdNotInCatalog = useMemo(() => {
    const wanted = formData.totem_id;
    if (wanted == null) return false;
    return !scopeTotems.some((t) => getTotemIdFromRow(t as Record<string, unknown>) === wanted);
  }, [formData.totem_id, scopeTotems]);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getMixRules();
      setRules(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setScopeTotemsError(null);
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      totem_id: null,
      rule_type: 'systematic',
      priority_weight: 1.0,
      time_weight: 1.0,
      tag_weight: 0.5,
      subscriber_weight: 0.5,
      ai_enabled: false,
      ai_provider: '',
      ai_model: '',
      use_pedestrian_detection: false,
      use_sentiment_analysis: false,
      use_context_awareness: false,
      use_historical_optimization: false,
      max_items_per_playlist: 50,
      rotation_strategy: 'round_robin',
      shuffle_enabled: false,
      is_default: false,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (rule: MixRule) => {
    setScopeTotemsError(null);
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      totem_id: getForeignTotemIdFromRow(rule as Record<string, unknown>) ?? rule.totem_id ?? null,
      rule_type: rule.rule_type,
      priority_weight: rule.priority_weight,
      time_weight: rule.time_weight,
      tag_weight: rule.tag_weight,
      subscriber_weight: rule.subscriber_weight,
      ai_enabled: rule.ai_enabled,
      ai_provider: rule.ai_provider || '',
      ai_model: rule.ai_model || '',
      use_pedestrian_detection: rule.use_pedestrian_detection,
      use_sentiment_analysis: rule.use_sentiment_analysis,
      use_context_awareness: rule.use_context_awareness,
      use_historical_optimization: rule.use_historical_optimization,
      max_items_per_playlist: rule.max_items_per_playlist,
      rotation_strategy: rule.rotation_strategy,
      shuffle_enabled: rule.shuffle_enabled,
      is_default: rule.is_default || false,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const normalizedTotemIdForApi = (): number | undefined => {
    const v = formData.totem_id;
    if (v == null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n;
  };

  const handleSave = async () => {
    setError(null);
    try {
      const totem_id = normalizedTotemIdForApi();
      const payload = { ...formData, totem_id };
      if (editingRule) {
        await updateMixRule(editingRule.rule_id, payload);
      } else {
        await createMixRule(payload);
      }
      setDialogOpen(false);
      loadRules();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar regra');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta regra?')) {
      return;
    }
    try {
      await deleteMixRule(id);
      loadRules();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir regra');
    }
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'systematic': return theme.palette.info.main;
      case 'ai': return theme.palette.warning.main;
      case 'hybrid': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  if (loading && rules.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando regras...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Regras de Mixagem de Playlists
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Configure regras sistemáticas e de IA para controlar como as playlists são mixadas nos totens
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreate}
          sx={{ 
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Nova Regra
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Rules Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Escopo</TableCell>
              <TableCell>IA</TableCell>
              <TableCell>Estratégia</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.rule_id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {rule.name}
                  </Typography>
                  {rule.description && (
                    <Typography variant="caption" color="text.secondary">
                      {rule.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={rule.rule_type}
                    size="small"
                    sx={{ bgcolor: getRuleTypeColor(rule.rule_type), color: 'white' }}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const tid = getForeignTotemIdFromRow(rule as Record<string, unknown>) ?? rule.totem_id;
                    return tid ? `Totem #${tid}` : 'Global';
                  })()}
                </TableCell>
                <TableCell>
                  {rule.ai_enabled ? (
                    <Chip label="Ativa" size="small" color="warning" />
                  ) : (
                    <Chip label="Inativa" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {rule.rotation_strategy.replace('_', ' ')}
                  </Typography>
                </TableCell>
                <TableCell>
                  {rule.is_default && (
                    <Chip label="Padrão" size="small" color="primary" sx={{ mr: 1 }} />
                  )}
                  {rule.is_active ? (
                    <Chip label="Ativa" size="small" color="success" />
                  ) : (
                    <Chip label="Inativa" size="small" color="default" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleEdit(rule)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  {!rule.is_default && (
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDelete(rule.rule_id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Shuffle sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
                  <Typography variant="h6">Nenhuma regra encontrada</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Comece criando sua primeira regra de mixagem
                  </Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
                    Criar Primeira Regra
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRule ? 'Editar Regra de Mixagem' : 'Nova Regra de Mixagem'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Descrição"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo de Regra</InputLabel>
            <Select
              value={formData.rule_type}
              onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
              label="Tipo de Regra"
            >
              <MenuItem value="systematic">Systematic (Apenas regras)</MenuItem>
              <MenuItem value="ai">AI (Apenas IA)</MenuItem>
              <MenuItem value="hybrid">Hybrid (Regras + IA)</MenuItem>
            </Select>
          </FormControl>

          {loadingScopeTotems && <LinearProgress sx={{ my: 1 }} />}

          <FormControl fullWidth margin="normal" disabled={loadingScopeTotems} error={Boolean(scopeTotemsError)}>
            <InputLabel id="mix-rule-totem-scope-label">Escopo (totem)</InputLabel>
            <Select
              labelId="mix-rule-totem-scope-label"
              label="Escopo (totem)"
              value={formData.totem_id == null ? '' : String(formData.totem_id)}
              onChange={(e) => {
                const raw = e.target.value;
                setFormData({
                  ...formData,
                  totem_id: raw === '' ? null : Number(raw),
                });
              }}
            >
              <MenuItem value="">
                <em>Global (todos os totems)</em>
              </MenuItem>
              {totemIdNotInCatalog && formData.totem_id != null && (
                <MenuItem value={String(formData.totem_id)}>
                  Totem #{formData.totem_id} (fora da lista atual)
                </MenuItem>
              )}
              {scopeTotems.flatMap((t) => {
                const id = getTotemIdFromRow(t as Record<string, unknown>);
                if (id === undefined) return [];
                const label = t.name || t.identifier || t.uin || `Totem #${id}`;
                const loc = (t as any).location || (t as any).localName || '';
                return [
                  <MenuItem key={id} value={String(id)}>
                    {label}
                    {loc ? ` · ${loc}` : ''}
                  </MenuItem>,
                ];
              })}
            </Select>
            <FormHelperText error={Boolean(scopeTotemsError)}>
              {scopeTotemsError || (
                <>
                  Regra <strong>global</strong> aplica-se sem vínculo a um totem específico. Escolha um totem para
                  restringir a regra a esse equipamento.
                </>
              )}
            </FormHelperText>
          </FormControl>

          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Pesos Sistemáticos
            </Typography>
            <TextField
              fullWidth
              label="Peso de Prioridade"
              type="number"
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              value={formData.priority_weight}
              onChange={(e) => setFormData({ ...formData, priority_weight: parseFloat(e.target.value) || 0 })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Peso de Horário"
              type="number"
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              value={formData.time_weight}
              onChange={(e) => setFormData({ ...formData, time_weight: parseFloat(e.target.value) || 0 })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Peso de Tags"
              type="number"
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              value={formData.tag_weight}
              onChange={(e) => setFormData({ ...formData, tag_weight: parseFloat(e.target.value) || 0 })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Peso de Subscriber"
              type="number"
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              value={formData.subscriber_weight}
              onChange={(e) => setFormData({ ...formData, subscriber_weight: parseFloat(e.target.value) || 0 })}
              margin="normal"
            />
          </Box>

          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Configurações de IA
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.ai_enabled}
                  onChange={(e) => setFormData({ ...formData, ai_enabled: e.target.checked })}
                />
              }
              label="Habilitar IA"
            />
            {formData.ai_enabled && (
              <>
                <TextField
                  fullWidth
                  label="Provedor de IA"
                  value={formData.ai_provider}
                  onChange={(e) => setFormData({ ...formData, ai_provider: e.target.value })}
                  margin="normal"
                  helperText="Ex: ollama, openai, anthropic"
                />
                <TextField
                  fullWidth
                  label="Modelo de IA"
                  value={formData.ai_model}
                  onChange={(e) => setFormData({ ...formData, ai_model: e.target.value })}
                  margin="normal"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_pedestrian_detection}
                      onChange={(e) => setFormData({ ...formData, use_pedestrian_detection: e.target.checked })}
                    />
                  }
                  label="Detecção de Transeuntes"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_sentiment_analysis}
                      onChange={(e) => setFormData({ ...formData, use_sentiment_analysis: e.target.checked })}
                    />
                  }
                  label="Análise de Sentimento"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_context_awareness}
                      onChange={(e) => setFormData({ ...formData, use_context_awareness: e.target.checked })}
                    />
                  }
                  label="Consciência Contextual"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_historical_optimization}
                      onChange={(e) => setFormData({ ...formData, use_historical_optimization: e.target.checked })}
                    />
                  }
                  label="Otimização Histórica"
                />
              </>
            )}
          </Box>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Máximo de Itens por Playlist"
              type="number"
              inputProps={{ min: 1, max: 1000 }}
              value={formData.max_items_per_playlist}
              onChange={(e) => setFormData({ ...formData, max_items_per_playlist: parseInt(e.target.value) || 50 })}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Estratégia de Rotação</InputLabel>
              <Select
                value={formData.rotation_strategy}
                onChange={(e) => setFormData({ ...formData, rotation_strategy: e.target.value as any })}
                label="Estratégia de Rotação"
              >
                <MenuItem value="round_robin">Round Robin</MenuItem>
                <MenuItem value="priority">Prioridade</MenuItem>
                <MenuItem value="weighted">Ponderado</MenuItem>
                <MenuItem value="ai_optimized">Otimizado por IA</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.shuffle_enabled}
                  onChange={(e) => setFormData({ ...formData, shuffle_enabled: e.target.checked })}
                />
              }
              label="Embaralhar dentro da mesma prioridade"
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
              }
              label="Regra Padrão"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Ativa"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formData.name}>
            {editingRule ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlaylistMixRules;


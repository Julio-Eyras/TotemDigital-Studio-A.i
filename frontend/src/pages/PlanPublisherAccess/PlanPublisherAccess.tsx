import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Settings,
  Info,
} from '@mui/icons-material';
import { planApi, Plan } from '../../services/api';
import { publisherApi, Publisher } from '../../services/api';
import { subscriberAccessApi, PlanPublisherAccess } from '../../services/api';

const PlanPublisherAccessPage: React.FC = () => {
  const theme = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [accessList, setAccessList] = useState<PlanPublisherAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<PlanPublisherAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    planId: '',
    publisherId: '',
  });

  const [formData, setFormData] = useState({
    planId: '',
    publisherId: '',
    isAllowed: true,
    restrictions: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansRes, publishersRes, accessRes] = await Promise.all([
        planApi.getAll(),
        publisherApi.getAll({ active_only: true }),
        subscriberAccessApi.getPlanPublisherAccess({
          planId: filters.planId ? parseInt(filters.planId) : undefined,
          publisherId: filters.publisherId ? parseInt(filters.publisherId) : undefined,
        }),
      ]);

      setPlans(plansRes || []);
      setPublishers(publishersRes.data || []);
      setAccessList(accessRes);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setError(error?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (access?: PlanPublisherAccess) => {
    if (access) {
      setEditMode(true);
      setSelectedAccess(access);
      setFormData({
        planId: access.plan_id.toString(),
        publisherId: access.publisher_id.toString(),
        isAllowed: access.is_allowed,
        restrictions: access.restrictions ? JSON.stringify(access.restrictions, null, 2) : '',
        notes: access.notes || '',
      });
    } else {
      setEditMode(false);
      setSelectedAccess(null);
      setFormData({
        planId: '',
        publisherId: '',
        isAllowed: true,
        restrictions: '',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedAccess(null);
    setFormData({
      planId: '',
      publisherId: '',
      isAllowed: true,
      restrictions: '',
      notes: '',
    });
  };

  const handleSubmit = async () => {
    try {
      setError(null);

      let restrictions = null;
      if (formData.restrictions.trim()) {
        try {
          restrictions = JSON.parse(formData.restrictions);
        } catch (e) {
          setError('Restrições devem ser um JSON válido');
          return;
        }
      }

      await subscriberAccessApi.setPlanPublisherAccess({
        planId: parseInt(formData.planId),
        publisherId: parseInt(formData.publisherId),
        isAllowed: formData.isAllowed,
        restrictions,
        notes: formData.notes || undefined,
      });

      handleCloseDialog();
      await loadData();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar configuração');
    }
  };

  const handleDelete = async (planId: number, publisherId: number) => {
    if (!window.confirm('Tem certeza que deseja remover este acesso?')) {
      return;
    }

    try {
      setError(null);
      await subscriberAccessApi.removePlanPublisherAccess(planId, publisherId);
      await loadData();
    } catch (error: any) {
      console.error('Erro ao remover acesso:', error);
      setError(error?.response?.data?.error || 'Erro ao remover acesso');
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Configuração Planos → Publishers
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Configure quais publishers cada plano permite acessar
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Nova Configuração
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Plano</InputLabel>
                <Select
                  value={filters.planId}
                  onChange={(e) => setFilters({ ...filters, planId: e.target.value })}
                  label="Filtrar por Plano"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {plans.map((plan) => (
                    <MenuItem key={plan.plan_id} value={plan.plan_id.toString()}>
                      {plan.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Publisher</InputLabel>
                <Select
                  value={filters.publisherId}
                  onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
                  label="Filtrar por Publisher"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {publishers.map((publisher) => (
                    <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                      {publisher.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                onClick={loadData}
              >
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Access List */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Plano</strong></TableCell>
                  <TableCell><strong>Publisher</strong></TableCell>
                  <TableCell><strong>Acesso Permitido</strong></TableCell>
                  <TableCell><strong>Restrições</strong></TableCell>
                  <TableCell><strong>Notas</strong></TableCell>
                  <TableCell><strong>Ações</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accessList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma configuração encontrada. Clique em "Nova Configuração" para criar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  accessList.map((access) => (
                    <TableRow key={`${access.plan_id}-${access.publisher_id}`}>
                      <TableCell>{access.plan_name}</TableCell>
                      <TableCell>{access.publisher_name}</TableCell>
                      <TableCell>
                        <Chip
                          icon={access.is_allowed ? <CheckCircle /> : <Cancel />}
                          label={access.is_allowed ? 'Permitido' : 'Bloqueado'}
                          color={access.is_allowed ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {access.restrictions ? (
                          <Tooltip title={JSON.stringify(access.restrictions, null, 2)}>
                            <Chip
                              icon={<Info />}
                              label="Configurado"
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Nenhuma
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {access.notes ? (
                          <Tooltip title={access.notes}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {access.notes}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleOpenDialog(access)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(access.plan_id, access.publisher_id)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? 'Editar Configuração' : 'Nova Configuração'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Plano *</InputLabel>
              <Select
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                label="Plano *"
                disabled={editMode}
              >
                <MenuItem value="">Selecione um plano</MenuItem>
                {plans.map((plan) => (
                  <MenuItem key={plan.plan_id} value={plan.plan_id.toString()}>
                    {plan.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Publisher *</InputLabel>
              <Select
                value={formData.publisherId}
                onChange={(e) => setFormData({ ...formData, publisherId: e.target.value })}
                label="Publisher *"
                disabled={editMode}
              >
                <MenuItem value="">Selecione um publisher</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isAllowed}
                  onChange={(e) => setFormData({ ...formData, isAllowed: e.target.checked })}
                />
              }
              label="Acesso Permitido"
              sx={{ mt: 2 }}
            />

            <TextField
              fullWidth
              label="Restrições (JSON)"
              multiline
              rows={4}
              value={formData.restrictions}
              onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
              margin="normal"
              helperText="Exemplo: { 'max_campaigns': 10, 'revenue_share_min': 5 }"
              placeholder='{ "max_campaigns": 10, "revenue_share_min": 5 }'
            />

            <TextField
              fullWidth
              label="Notas"
              multiline
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.planId || !formData.publisherId}
          >
            {editMode ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanPublisherAccessPage;


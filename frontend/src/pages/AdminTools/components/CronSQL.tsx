import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Paper,
  Container,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../../../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface ExportQuery {
  query_id: number;
  name: string;
  description: string | null;
  provider: string;
  sql_query: string;
  database_config: any;
  export_config: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface ExportSchedule {
  schedule_id: number;
  name: string;
  description: string | null;
  query_id: number;
  cron_expression: string;
  enabled: boolean;
  last_execution: string | null;
  next_execution: string | null;
  execution_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
}

const CronSQL: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [queries, setQueries] = useState<ExportQuery[]>([]);
  const [schedules, setSchedules] = useState<ExportSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog de query
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<ExportQuery | null>(null);
  const [queryForm, setQueryForm] = useState({
    name: '',
    description: '',
    provider: 'PostgreSQL' as 'PostgreSQL' | 'Redis' | 'Grafana' | 'Prometheus',
    sqlQuery: '',
    databaseConfig: {}, // Usa configuração do sistema
    exportConfig: {
      outputDirectory: './exports',
      fileName: 'export',
      format: 'xlsx' as 'xlsx' | 'pdf' | 'csv',
      sheetName: 'Data', // Apenas para Excel
      applyFormatting: true,
      timestampSuffix: true,
    },
    enabled: true,
  });

  // Dialog de schedule
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExportSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    description: '',
    queryId: 0,
    cronExpression: '0 8 * * *', // Diário às 8h
    enabled: true,
  });

  // Carregar dados
  useEffect(() => {
    loadQueries();
    loadSchedules();
  }, []);

  const loadQueries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/export-queries');
      if (response.data.success) {
        setQueries(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao carregar queries');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await api.get('/export-schedules');
      if (response.data.success) {
        setSchedules(response.data.data);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao carregar agendamentos');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenQueryDialog = (query?: ExportQuery) => {
    if (query) {
      setEditingQuery(query);
      setQueryForm({
        name: query.name,
        description: query.description || '',
        provider: query.provider,
        sqlQuery: query.sql_query,
        databaseConfig: typeof query.database_config === 'string'
          ? JSON.parse(query.database_config)
          : query.database_config || {},
        exportConfig: typeof query.export_config === 'string'
          ? JSON.parse(query.export_config)
          : query.export_config,
        enabled: query.enabled,
      });
    } else {
      setEditingQuery(null);
      setQueryForm({
        name: '',
        description: '',
        provider: 'PostgreSQL',
        sqlQuery: '',
        databaseConfig: {},
        exportConfig: {
          outputDirectory: './exports',
          fileName: 'export',
          format: 'xlsx',
          sheetName: 'Data',
          applyFormatting: true,
          timestampSuffix: true,
        },
        enabled: true,
      });
    }
    setQueryDialogOpen(true);
  };

  const handleSaveQuery = async () => {
    try {
      setLoading(true);
      setError(null);

      if (editingQuery) {
        // Atualizar
        await api.put(`/export-queries/${editingQuery.query_id}`, queryForm);
      } else {
        // Criar
        await api.post('/export-queries', queryForm);
      }

      setQueryDialogOpen(false);
      loadQueries();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao salvar query');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuery = async (queryId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta query?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/export-queries/${queryId}`);
      loadQueries();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao excluir query');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScheduleDialog = (schedule?: ExportSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        name: schedule.name,
        description: schedule.description || '',
        queryId: schedule.query_id,
        cronExpression: schedule.cron_expression,
        enabled: schedule.enabled,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        name: '',
        description: '',
        queryId: queries.length > 0 ? queries[0].query_id : 0,
        cronExpression: '0 8 * * *',
        enabled: true,
      });
    }
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      if (editingSchedule) {
        // Atualizar
        await api.put(`/export-schedules/${editingSchedule.schedule_id}`, scheduleForm);
      } else {
        // Criar
        await api.post('/export-schedules', scheduleForm);
      }

      setScheduleDialogOpen(false);
      loadSchedules();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao salvar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/export-schedules/${scheduleId}`);
      loadSchedules();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao excluir agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSchedule = async (scheduleId: number) => {
    try {
      setLoading(true);
      await api.post(`/export-schedules/${scheduleId}/execute-now`);
      alert('Execução iniciada com sucesso!');
      loadSchedules();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao executar agendamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          CronSQL - Exportação Agendada
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadQueries();
              loadSchedules();
            }}
            sx={{ mr: 2 }}
          >
            Atualizar
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Queries SQL" />
          <Tab label="Agendamentos" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Queries de Exportação</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenQueryDialog()}
            >
              Nova Query
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Criado em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : queries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Nenhuma query encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  queries.map((query) => (
                    <TableRow key={query.query_id}>
                      <TableCell>{query.name}</TableCell>
                      <TableCell>{query.provider}</TableCell>
                      <TableCell>
                        <Chip
                          label={query.enabled ? 'Ativo' : 'Inativo'}
                          color={query.enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(query.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenQueryDialog(query)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteQuery(query.query_id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Agendamentos</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenScheduleDialog()}
              disabled={queries.length === 0}
            >
              Novo Agendamento
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Query</TableCell>
                  <TableCell>Cron</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Próxima Execução</TableCell>
                  <TableCell>Última Execução</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Nenhum agendamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => {
                    const query = queries.find(q => q.query_id === schedule.query_id);
                    return (
                      <TableRow key={schedule.schedule_id}>
                        <TableCell>{schedule.name}</TableCell>
                        <TableCell>{query?.name || `Query #${schedule.query_id}`}</TableCell>
                        <TableCell>
                          <code>{schedule.cron_expression}</code>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={schedule.enabled ? 'Ativo' : 'Inativo'}
                            color={schedule.enabled ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {schedule.next_execution
                            ? new Date(schedule.next_execution).toLocaleString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {schedule.last_execution
                            ? new Date(schedule.last_execution).toLocaleString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Executar Agora">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleExecuteSchedule(schedule.schedule_id)}
                            >
                              <PlayIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenScheduleDialog(schedule)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteSchedule(schedule.schedule_id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* Dialog de Query */}
      <Dialog
        open={queryDialogOpen}
        onClose={() => setQueryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingQuery ? 'Editar Query' : 'Nova Query'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Nome"
              value={queryForm.name}
              onChange={(e) => setQueryForm({ ...queryForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Descrição"
              value={queryForm.description}
              onChange={(e) => setQueryForm({ ...queryForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                value={queryForm.provider}
                onChange={(e) => setQueryForm({ ...queryForm, provider: e.target.value })}
                label="Provider"
              >
                <MenuItem value="PostgreSQL">PostgreSQL</MenuItem>
                <MenuItem value="SQLServer">SQL Server</MenuItem>
                <MenuItem value="MySQL">MySQL</MenuItem>
                <MenuItem value="SQLite">SQLite</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Query SQL"
              value={queryForm.sqlQuery}
              onChange={(e) => setQueryForm({ ...queryForm, sqlQuery: e.target.value })}
              fullWidth
              multiline
              rows={6}
              required
              placeholder="SELECT * FROM totems WHERE active = true"
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              A configuração do banco de dados será usada do sistema automaticamente.
            </Alert>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Configuração de Exportação</Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Formato de Exportação</InputLabel>
              <Select
                value={queryForm.exportConfig.format}
                onChange={(e) => setQueryForm({
                  ...queryForm,
                  exportConfig: { ...queryForm.exportConfig, format: e.target.value as any }
                })}
                label="Formato de Exportação"
              >
                <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Diretório de Saída"
              value={queryForm.exportConfig.outputDirectory}
              onChange={(e) => setQueryForm({
                ...queryForm,
                exportConfig: { ...queryForm.exportConfig, outputDirectory: e.target.value }
              })}
              fullWidth
            />
            <TextField
              label="Nome do Arquivo"
              value={queryForm.exportConfig.fileName}
              onChange={(e) => setQueryForm({
                ...queryForm,
                exportConfig: { ...queryForm.exportConfig, fileName: e.target.value }
              })}
              fullWidth
            />
            {queryForm.exportConfig.format === 'xlsx' && (
              <TextField
                label="Nome da Planilha"
                value={queryForm.exportConfig.sheetName}
                onChange={(e) => setQueryForm({
                  ...queryForm,
                  exportConfig: { ...queryForm.exportConfig, sheetName: e.target.value }
                })}
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.exportConfig.applyFormatting !== false}
                  onChange={(e) => setQueryForm({
                    ...queryForm,
                    exportConfig: { ...queryForm.exportConfig, applyFormatting: e.target.checked }
                  })}
                />
              }
              label="Aplicar Formatação"
              sx={{ mt: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.exportConfig.timestampSuffix !== false}
                  onChange={(e) => setQueryForm({
                    ...queryForm,
                    exportConfig: { ...queryForm.exportConfig, timestampSuffix: e.target.checked }
                  })}
                />
              }
              label="Adicionar Timestamp no Nome do Arquivo"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.enabled}
                  onChange={(e) => setQueryForm({ ...queryForm, enabled: e.target.checked })}
                />
              }
              label="Habilitado"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQueryDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveQuery}
            disabled={loading || !queryForm.name || !queryForm.sqlQuery}
          >
            {loading ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Schedule */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Nome"
              value={scheduleForm.name}
              onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Descrição"
              value={scheduleForm.description}
              onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Query</InputLabel>
              <Select
                value={scheduleForm.queryId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, queryId: e.target.value as number })}
                label="Query"
              >
                {queries.map((query) => (
                  <MenuItem key={query.query_id} value={query.query_id}>
                    {query.name} ({query.provider})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Expressão Cron"
              value={scheduleForm.cronExpression}
              onChange={(e) => setScheduleForm({ ...scheduleForm, cronExpression: e.target.value })}
              fullWidth
              required
              placeholder="0 8 * * *"
              helperText="Ex: 0 8 * * * (diário às 8h), 0 */6 * * * (a cada 6 horas)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={scheduleForm.enabled}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                />
              }
              label="Habilitado"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveSchedule}
            disabled={loading || !scheduleForm.name || !scheduleForm.cronExpression || scheduleForm.queryId === 0}
          >
            {loading ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CronSQL;


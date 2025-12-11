import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Science as ValidateIcon,
  Lan as ConnectionIcon,
} from '@mui/icons-material';
import {
  cronSqlApi,
  ExportExecutionRecord,
  ExportProvider,
  ExportQueryRecord,
  ExportScheduleRecord,
} from '../../../services/api';

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

type QueryEnabledFilter = 'all' | 'true' | 'false';
type ScheduleEnabledFilter = 'all' | 'true' | 'false';
type ExecutionStatusFilter = 'all' | ExportExecutionRecord['status'];

interface QueryFilters {
  provider: '' | ExportProvider;
  enabled: QueryEnabledFilter;
  search: string;
}

interface ScheduleFilters {
  queryId: number | 'all';
  enabled: ScheduleEnabledFilter;
  search: string;
}

interface ExecutionFilters {
  status: ExecutionStatusFilter;
  search: string;
  startDate: string;
  endDate: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

interface SqlValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  tables?: string[];
  columns?: string[];
}

const providerOptions: ExportProvider[] = ['PostgreSQL', 'Redis', 'Grafana', 'Prometheus'];
const rowsPerPageOptions = [5, 10, 25, 50];

const statusColorMap: Record<ExportExecutionRecord['status'], 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'info',
  running: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const numBytes = typeof bytes === 'number' ? bytes : parseFloat(String(bytes || 0));
  if (numBytes <= 0) return '-';
  const power = Math.min(Math.floor(Math.log(numBytes) / Math.log(1024)), units.length - 1);
  const size = numBytes / Math.pow(1024, power);
  return `${typeof size === 'number' ? size.toFixed(1) : parseFloat(String(size)).toFixed(1)} ${units[power]}`;
};

const CronSQL: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const [queries, setQueries] = useState<ExportQueryRecord[]>([]);
  const [queryFilters, setQueryFilters] = useState<QueryFilters>({
    provider: '',
    enabled: 'all',
    search: '',
  });
  const [queryPagination, setQueryPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [queriesLoading, setQueriesLoading] = useState(false);

  const [schedules, setSchedules] = useState<ExportScheduleRecord[]>([]);
  const [scheduleFilters, setScheduleFilters] = useState<ScheduleFilters>({
    queryId: 'all',
    enabled: 'all',
    search: '',
  });
  const [schedulePagination, setSchedulePagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  const [executions, setExecutions] = useState<ExportExecutionRecord[]>([]);
  const [executionFilters, setExecutionFilters] = useState<ExecutionFilters>({
    status: 'all',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [executionPagination, setExecutionPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [executionsLoading, setExecutionsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<ExportQueryRecord | null>(null);
  const [queryForm, setQueryForm] = useState({
    name: '',
    description: '',
    provider: 'PostgreSQL' as ExportProvider,
    sqlQuery: '',
    exportConfig: {
      outputDirectory: './exports',
      fileName: 'export',
      format: 'xlsx' as 'xlsx' | 'pdf' | 'csv',
      sheetName: 'Data',
      applyFormatting: true,
      timestampSuffix: true,
    },
    enabled: true,
  });
  const [sqlValidation, setSqlValidation] = useState<SqlValidationResult | null>(null);
  const [validatingSql, setValidatingSql] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExportScheduleRecord | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    description: '',
    queryId: 0,
    cronExpression: '0 8 * * *',
    enabled: true,
  });
  const [cronValidation, setCronValidation] = useState<{ nextExecution?: string; error?: string } | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    loadQueries({ page: 1, limit: queryPagination.limit });
    loadSchedules({ page: 1, limit: schedulePagination.limit });
    loadExecutions({ page: 1, limit: executionPagination.limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadQueries({ page: 1, limit: queryPagination.limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters]);

  useEffect(() => {
    loadSchedules({ page: 1, limit: schedulePagination.limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleFilters]);

  useEffect(() => {
    loadExecutions({ page: 1, limit: executionPagination.limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionFilters]);

  const loadQueries = useCallback(
    async (options: { page?: number; limit?: number } = {}) => {
      try {
        setQueriesLoading(true);
        const response = await cronSqlApi.getQueries({
          provider: queryFilters.provider || undefined,
          enabled: queryFilters.enabled !== 'all' ? queryFilters.enabled : undefined,
          search: queryFilters.search || undefined,
          page: options.page ?? queryPagination.page,
          limit: options.limit ?? queryPagination.limit,
        });
        setQueries(response.data);
        setQueryPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar queries');
      } finally {
        setQueriesLoading(false);
      }
    },
    [queryFilters, queryPagination.limit, queryPagination.page]
  );

  const loadSchedules = useCallback(
    async (options: { page?: number; limit?: number } = {}) => {
      try {
        setSchedulesLoading(true);
        const response = await cronSqlApi.getSchedules({
          queryId: scheduleFilters.queryId !== 'all' ? Number(scheduleFilters.queryId) : undefined,
          enabled: scheduleFilters.enabled !== 'all' ? scheduleFilters.enabled : undefined,
          search: scheduleFilters.search || undefined,
          page: options.page ?? schedulePagination.page,
          limit: options.limit ?? schedulePagination.limit,
        });
        setSchedules(response.data);
        setSchedulePagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar agendamentos');
      } finally {
        setSchedulesLoading(false);
      }
    },
    [scheduleFilters, schedulePagination.limit, schedulePagination.page]
  );

  const loadExecutions = useCallback(
    async (options: { page?: number; limit?: number } = {}) => {
      try {
        setExecutionsLoading(true);
        const response = await cronSqlApi.getExecutions({
          status: executionFilters.status !== 'all' ? executionFilters.status : undefined,
          search: executionFilters.search || undefined,
          startDate: executionFilters.startDate || undefined,
          endDate: executionFilters.endDate || undefined,
          page: options.page ?? executionPagination.page,
          limit: options.limit ?? executionPagination.limit,
        });
        setExecutions(response.data);
        setExecutionPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar execuções');
      } finally {
        setExecutionsLoading(false);
      }
    },
    [executionFilters, executionPagination.limit, executionPagination.page]
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const resetQueryForm = () => {
    setQueryForm({
      name: '',
      description: '',
      provider: 'PostgreSQL',
      sqlQuery: '',
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
    setSqlValidation(null);
  };

  const handleOpenQueryDialog = (query?: ExportQueryRecord) => {
    if (query) {
      setEditingQuery(query);
      const exportConfig = query.export_config || {
        outputDirectory: './exports',
        fileName: 'export',
        format: 'xlsx' as 'xlsx' | 'pdf' | 'csv',
      };
      setQueryForm({
        name: query.name,
        description: query.description || '',
        provider: query.provider,
        sqlQuery: query.sql_query,
        exportConfig: {
          outputDirectory: exportConfig.outputDirectory || './exports',
          fileName: exportConfig.fileName || 'export',
          format: exportConfig.format || 'xlsx',
          sheetName: exportConfig.sheetName ?? 'Data',
          applyFormatting: exportConfig.applyFormatting !== false,
          timestampSuffix: exportConfig.timestampSuffix !== false,
        },
        enabled: query.enabled,
      });
    } else {
      setEditingQuery(null);
      resetQueryForm();
    }
    setSqlValidation(null);
    setQueryDialogOpen(true);
  };

  const handleSaveQuery = async () => {
    try {
      setSavingQuery(true);
      setError(null);

      if (editingQuery) {
        await cronSqlApi.updateQuery(editingQuery.query_id, {
          name: queryForm.name,
          description: queryForm.description,
          provider: queryForm.provider,
          sqlQuery: queryForm.sqlQuery,
          exportConfig: queryForm.exportConfig,
          enabled: queryForm.enabled,
        });
        setSnackbar({ open: true, message: 'Query atualizada com sucesso.', severity: 'success' });
      } else {
        await cronSqlApi.createQuery({
          name: queryForm.name,
          description: queryForm.description,
          provider: queryForm.provider,
          sqlQuery: queryForm.sqlQuery,
          exportConfig: queryForm.exportConfig,
          enabled: queryForm.enabled,
        });
        setSnackbar({ open: true, message: 'Query criada com sucesso.', severity: 'success' });
      }

      setQueryDialogOpen(false);
      loadQueries({ page: queryPagination.page, limit: queryPagination.limit });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar query');
    } finally {
      setSavingQuery(false);
    }
  };

  const handleDeleteQuery = async (queryId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta query?')) {
      return;
    }

    try {
      setQueriesLoading(true);
      await cronSqlApi.deleteQuery(queryId);
      setSnackbar({ open: true, message: 'Query excluída com sucesso.', severity: 'success' });
      loadQueries({ page: 1, limit: queryPagination.limit });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir query');
    } finally {
      setQueriesLoading(false);
    }
  };

  const handleValidateSql = async () => {
    if (!queryForm.sqlQuery.trim()) {
      setSnackbar({ open: true, message: 'Informe a SQL para validar.', severity: 'info' });
      return;
    }
    try {
      setValidatingSql(true);
      const result = await cronSqlApi.validateSql({
        sql: queryForm.sqlQuery,
        provider: queryForm.provider,
      });
      setSqlValidation({
        valid: result.valid,
        error: result.error,
        warnings: result.warnings,
        columns: result.columns,
        tables: result.tables,
      });
      setSnackbar({
        open: true,
        message: result.valid ? 'SQL válida.' : 'SQL apresenta avisos.',
        severity: result.valid ? 'success' : 'warning',
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Erro ao validar SQL',
        severity: 'error',
      });
    } finally {
      setValidatingSql(false);
    }
  };

  const handleTestConnection = async () => {
    if (!editingQuery) {
      setSnackbar({
        open: true,
        message: 'Salve a query antes de testar a conexão.',
        severity: 'info',
      });
      return;
    }

    try {
      setTestingConnection(true);
      const result = await cronSqlApi.testConnection(editingQuery.query_id, editingQuery.provider);
      setSnackbar({
        open: true,
        message: result.message || 'Teste de conexão executado.',
        severity: result.success ? 'success' : 'warning',
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Erro ao testar conexão',
        severity: 'error',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleOpenScheduleDialog = (schedule?: ExportScheduleRecord) => {
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
    setCronValidation(null);
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true);
      setError(null);

      if (editingSchedule) {
        await cronSqlApi.updateSchedule(editingSchedule.schedule_id, {
          name: scheduleForm.name,
          description: scheduleForm.description,
          queryId: scheduleForm.queryId,
          cronExpression: scheduleForm.cronExpression,
          enabled: scheduleForm.enabled,
        });
        setSnackbar({ open: true, message: 'Agendamento atualizado com sucesso.', severity: 'success' });
      } else {
        await cronSqlApi.createSchedule({
          name: scheduleForm.name,
          description: scheduleForm.description,
          queryId: scheduleForm.queryId,
          cronExpression: scheduleForm.cronExpression,
          enabled: scheduleForm.enabled,
        });
        setSnackbar({ open: true, message: 'Agendamento criado com sucesso.', severity: 'success' });
      }

      setScheduleDialogOpen(false);
      loadSchedules({ page: schedulePagination.page, limit: schedulePagination.limit });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar agendamento');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      return;
    }

    try {
      setSchedulesLoading(true);
      await cronSqlApi.deleteSchedule(scheduleId);
      setSnackbar({ open: true, message: 'Agendamento excluído com sucesso.', severity: 'success' });
      loadSchedules({ page: 1, limit: schedulePagination.limit });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir agendamento');
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleExecuteSchedule = async (scheduleId: number) => {
    try {
      await cronSqlApi.executeScheduleNow(scheduleId);
      setSnackbar({ open: true, message: 'Execução manual iniciada.', severity: 'success' });
      loadSchedules({ page: schedulePagination.page, limit: schedulePagination.limit });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao executar agendamento');
    }
  };

  const handleValidateCron = async () => {
    try {
      const result = await cronSqlApi.validateCron(scheduleForm.cronExpression);
      setCronValidation({
        nextExecution: result.nextExecution,
      });
      setSnackbar({
        open: true,
        message: result.valid
          ? `Próxima execução: ${formatDateTime(result.nextExecution)}`
          : 'Expressão cron inválida.',
        severity: result.valid ? 'success' : 'warning',
      });
    } catch (err: any) {
      setCronValidation({
        error: err.response?.data?.message || 'Erro ao validar cron',
      });
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Erro ao validar cron',
        severity: 'error',
      });
    }
  };

  const handleDownloadExecution = async (execution: ExportExecutionRecord) => {
    if (!execution.file_path || execution.status !== 'completed') {
      return;
    }
    try {
      const blob = await cronSqlApi.downloadExecution(execution.execution_id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const extension = execution.file_path.split('.').pop() || 'dat';
      const fileName = `${execution.query_name || 'export'}_${execution.execution_id}.${extension}`;
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Erro ao baixar arquivo',
        severity: 'error',
      });
    }
  };

  const handleRefreshAll = () => {
    loadQueries({ page: queryPagination.page, limit: queryPagination.limit });
    loadSchedules({ page: schedulePagination.page, limit: schedulePagination.limit });
    loadExecutions({ page: executionPagination.page, limit: executionPagination.limit });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            CronSQL - Exportação Agendada
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure queries, agende execuções e acompanhe os resultados em tempo real.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefreshAll}>
          Atualizar
        </Button>
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
          <Tab label="Execuções" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6">Queries de Exportação</Typography>
              <Typography variant="body2" color="text.secondary">
                Mantenha suas consultas organizadas e prontas para exportação.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenQueryDialog()}>
              Nova Query
            </Button>
          </Box>

          <Box sx={{ px: 2, pb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4} lg={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Provider</InputLabel>
                  <Select
                    value={queryFilters.provider}
                    label="Provider"
                    onChange={(e) => setQueryFilters((prev) => ({ ...prev, provider: e.target.value as QueryFilters['provider'] }))}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {providerOptions.map((provider) => (
                      <MenuItem key={provider} value={provider}>
                        {provider}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4} lg={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={queryFilters.enabled}
                    label="Status"
                    onChange={(e) => setQueryFilters((prev) => ({ ...prev, enabled: e.target.value as QueryEnabledFilter }))}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="true">Ativos</MenuItem>
                    <MenuItem value="false">Inativos</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4} lg={6}>
                <TextField
                  label="Buscar por nome ou descrição"
                  value={queryFilters.search}
                  onChange={(e) => setQueryFilters((prev) => ({ ...prev, search: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Formato</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Atualizado em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queriesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : queries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Nenhuma query encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  queries.map((query) => (
                    <TableRow key={query.query_id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{query.name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {query.description || 'Sem descrição'}
                        </Typography>
                      </TableCell>
                      <TableCell>{query.provider}</TableCell>
                      <TableCell>{(query.export_config?.format || 'xlsx').toUpperCase()}</TableCell>
                      <TableCell>
                        <Chip size="small" label={query.enabled ? 'Ativo' : 'Inativo'} color={query.enabled ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>{formatDateTime(query.updated_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Validar/Editar query">
                            <IconButton size="small" onClick={() => handleOpenQueryDialog(query)}>
                              <ValidateIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => handleOpenQueryDialog(query)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton size="small" color="error" onClick={() => handleDeleteQuery(query.query_id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={queryPagination.total}
            page={queryPagination.page - 1}
            rowsPerPage={queryPagination.limit}
            onPageChange={(_, newPage) => {
              const page = newPage + 1;
              setQueryPagination((prev) => ({ ...prev, page }));
              loadQueries({ page, limit: queryPagination.limit });
            }}
            onRowsPerPageChange={(event) => {
              const limit = parseInt(event.target.value, 10);
              setQueryPagination((prev) => ({ ...prev, limit, page: 1 }));
              loadQueries({ page: 1, limit });
            }}
            rowsPerPageOptions={rowsPerPageOptions}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6">Agendamentos</Typography>
              <Typography variant="body2" color="text.secondary">
                Defina as frequências de execução e acompanhe os resultados rapidamente.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenScheduleDialog()}
              disabled={queries.length === 0}
            >
              Novo Agendamento
            </Button>
          </Box>

          <Box sx={{ px: 2, pb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4} lg={3}>
                <FormControl fullWidth size="small" disabled={queries.length === 0}>
                  <InputLabel>Query</InputLabel>
                  <Select
                    value={scheduleFilters.queryId}
                    label="Query"
                    onChange={(e) => setScheduleFilters((prev) => ({ ...prev, queryId: e.target.value as number | 'all' }))}
                  >
                    <MenuItem value="all">Todas</MenuItem>
                    {queries.map((query) => (
                      <MenuItem key={query.query_id} value={query.query_id}>
                        {query.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4} lg={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={scheduleFilters.enabled}
                    label="Status"
                    onChange={(e) => setScheduleFilters((prev) => ({ ...prev, enabled: e.target.value as ScheduleEnabledFilter }))}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="true">Ativos</MenuItem>
                    <MenuItem value="false">Inativos</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4} lg={6}>
                <TextField
                  label="Buscar por nome ou descrição"
                  value={scheduleFilters.search}
                  onChange={(e) => setScheduleFilters((prev) => ({ ...prev, search: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
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
                  <TableCell>Execuções</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedulesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Nenhum agendamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => {
                    const query = queries.find((q) => q.query_id === schedule.query_id);
                    return (
                      <TableRow key={schedule.schedule_id} hover>
                        <TableCell>{schedule.name}</TableCell>
                        <TableCell>{query?.name || `Query #${schedule.query_id}`}</TableCell>
                        <TableCell>
                          <code>{schedule.cron_expression}</code>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={schedule.enabled ? 'Ativo' : 'Inativo'}
                            color={schedule.enabled ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(schedule.next_execution)}</TableCell>
                        <TableCell>{formatDateTime(schedule.last_execution)}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {schedule.success_count}/{schedule.execution_count}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Falhas: {schedule.failure_count}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Executar agora">
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleExecuteSchedule(schedule.schedule_id)}
                                >
                                  <PlayIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleOpenScheduleDialog(schedule)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Excluir">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteSchedule(schedule.schedule_id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={schedulePagination.total}
            page={schedulePagination.page - 1}
            rowsPerPage={schedulePagination.limit}
            onPageChange={(_, newPage) => {
              const page = newPage + 1;
              setSchedulePagination((prev) => ({ ...prev, page }));
              loadSchedules({ page, limit: schedulePagination.limit });
            }}
            onRowsPerPageChange={(event) => {
              const limit = parseInt(event.target.value, 10);
              setSchedulePagination((prev) => ({ ...prev, limit, page: 1 }));
              loadSchedules({ page: 1, limit });
            }}
            rowsPerPageOptions={rowsPerPageOptions}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6">Execuções</Typography>
              <Typography variant="body2" color="text.secondary">
                Visualize o histórico, status e faça download dos arquivos gerados.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ px: 2, pb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={executionFilters.status}
                    label="Status"
                    onChange={(e) => setExecutionFilters((prev) => ({ ...prev, status: e.target.value as ExecutionStatusFilter }))}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="pending">Pendente</MenuItem>
                    <MenuItem value="running">Executando</MenuItem>
                    <MenuItem value="completed">Concluído</MenuItem>
                    <MenuItem value="failed">Falhou</MenuItem>
                    <MenuItem value="cancelled">Cancelado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Buscar (query, agendamento ou log)"
                  value={executionFilters.search}
                  onChange={(e) => setExecutionFilters((prev) => ({ ...prev, search: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Início"
                  type="date"
                  value={executionFilters.startDate}
                  onChange={(e) => setExecutionFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Fim"
                  type="date"
                  value={executionFilters.endDate}
                  onChange={(e) => setExecutionFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Query</TableCell>
                  <TableCell>Agendamento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Início</TableCell>
                  <TableCell>Fim</TableCell>
                  <TableCell>Registros</TableCell>
                  <TableCell>Tamanho</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : executions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Nenhuma execução encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  executions.map((execution) => (
                    <TableRow key={execution.execution_id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{execution.query_name || `Query #${execution.query_id}`}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          #{execution.execution_id}
                        </Typography>
                      </TableCell>
                      <TableCell>{execution.schedule_name || 'Execução manual'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={execution.status} color={statusColorMap[execution.status]} />
                      </TableCell>
                      <TableCell>{formatDateTime(execution.started_at)}</TableCell>
                      <TableCell>{formatDateTime(execution.completed_at)}</TableCell>
                      <TableCell>{execution.records_exported}</TableCell>
                      <TableCell>{formatFileSize(execution.file_size)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={execution.file_path ? 'Baixar arquivo' : 'Arquivo não disponível'}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadExecution(execution)}
                              disabled={!execution.file_path || execution.status !== 'completed'}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={executionPagination.total}
            page={executionPagination.page - 1}
            rowsPerPage={executionPagination.limit}
            onPageChange={(_, newPage) => {
              const page = newPage + 1;
              setExecutionPagination((prev) => ({ ...prev, page }));
              loadExecutions({ page, limit: executionPagination.limit });
            }}
            onRowsPerPageChange={(event) => {
              const limit = parseInt(event.target.value, 10);
              setExecutionPagination((prev) => ({ ...prev, limit, page: 1 }));
              loadExecutions({ page: 1, limit });
            }}
            rowsPerPageOptions={rowsPerPageOptions}
          />
        </Paper>
      </TabPanel>

      <Dialog open={queryDialogOpen} onClose={() => setQueryDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingQuery ? 'Editar Query' : 'Nova Query'}</DialogTitle>
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
                label="Provider"
                onChange={(e) => setQueryForm({ ...queryForm, provider: e.target.value as ExportProvider })}
              >
                {providerOptions.map((provider) => (
                  <MenuItem key={provider} value={provider}>
                    {provider}
                  </MenuItem>
                ))}
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

            <Alert severity="info">
              A configuração de conexão usa automaticamente os parâmetros do sistema. Ajuste apenas os detalhes da exportação.
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<ValidateIcon />}
                onClick={handleValidateSql}
                disabled={validatingSql || !queryForm.sqlQuery.trim()}
              >
                {validatingSql ? 'Validando...' : 'Validar SQL'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ConnectionIcon />}
                onClick={handleTestConnection}
                disabled={!editingQuery || testingConnection}
              >
                {testingConnection ? 'Testando...' : 'Testar Conexão'}
              </Button>
            </Stack>

            {sqlValidation && (
              <Alert severity={sqlValidation.valid ? 'success' : 'warning'}>
                <Typography variant="subtitle2">
                  {sqlValidation.valid ? 'SQL válida.' : sqlValidation.error || 'SQL com avisos.'}
                </Typography>
                {sqlValidation.warnings && sqlValidation.warnings.length > 0 && (
                  <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                    {sqlValidation.warnings.map((warning, index) => (
                      <li key={index}>
                        <Typography variant="body2">{warning}</Typography>
                      </li>
                    ))}
                  </Box>
                )}
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Configuração de Exportação
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Formato de Exportação</InputLabel>
              <Select
                value={queryForm.exportConfig.format}
                label="Formato de Exportação"
                onChange={(e) =>
                  setQueryForm({
                    ...queryForm,
                    exportConfig: { ...queryForm.exportConfig, format: e.target.value as 'xlsx' | 'pdf' | 'csv' },
                  })
                }
              >
                <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Diretório de Saída"
              value={queryForm.exportConfig.outputDirectory}
              onChange={(e) =>
                setQueryForm({
                  ...queryForm,
                  exportConfig: { ...queryForm.exportConfig, outputDirectory: e.target.value },
                })
              }
              fullWidth
            />
            <TextField
              label="Nome do Arquivo"
              value={queryForm.exportConfig.fileName}
              onChange={(e) =>
                setQueryForm({
                  ...queryForm,
                  exportConfig: { ...queryForm.exportConfig, fileName: e.target.value },
                })
              }
              fullWidth
            />
            {queryForm.exportConfig.format === 'xlsx' && (
              <TextField
                label="Nome da Planilha"
                value={queryForm.exportConfig.sheetName}
                onChange={(e) =>
                  setQueryForm({
                    ...queryForm,
                    exportConfig: { ...queryForm.exportConfig, sheetName: e.target.value },
                  })
                }
                fullWidth
              />
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.exportConfig.applyFormatting !== false}
                  onChange={(e) =>
                    setQueryForm({
                      ...queryForm,
                      exportConfig: { ...queryForm.exportConfig, applyFormatting: e.target.checked },
                    })
                  }
                />
              }
              label="Aplicar formatação"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={queryForm.exportConfig.timestampSuffix !== false}
                  onChange={(e) =>
                    setQueryForm({
                      ...queryForm,
                      exportConfig: { ...queryForm.exportConfig, timestampSuffix: e.target.checked },
                    })
                  }
                />
              }
              label="Adicionar timestamp ao nome do arquivo"
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
            disabled={savingQuery || !queryForm.name || !queryForm.sqlQuery}
          >
            {savingQuery ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
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
                label="Query"
                onChange={(e) => setScheduleForm({ ...scheduleForm, queryId: Number(e.target.value) })}
              >
                {queries.map((query) => (
                  <MenuItem key={query.query_id} value={query.query_id}>
                    {query.name}
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
              helperText="Exemplos: 0 8 * * * (diário às 8h) | 0 */6 * * * (a cada 6 horas)"
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
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="outlined" onClick={handleValidateCron}>
                Validar Cron
              </Button>
              {cronValidation?.nextExecution && (
                <Typography variant="body2" color="text.secondary">
                  Próxima execução: {formatDateTime(cronValidation.nextExecution)}
                </Typography>
              )}
              {cronValidation?.error && (
                <Typography variant="body2" color="error">
                  {cronValidation.error}
                </Typography>
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveSchedule}
            disabled={savingSchedule || !scheduleForm.name || !scheduleForm.cronExpression || scheduleForm.queryId === 0}
          >
            {savingSchedule ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default CronSQL;


/**
 * Dispatcher Debug - Debug Online
 * 
 * Diagnóstico técnico em tempo real do Dispatcher:
 * - Status do Redis (por que não está operando)
 * - Queries SQL executadas (comando, parâmetros, duração, linhas)
 * - Mensagens recebidas/respondidas (request/response completo)
 * - Estatísticas e métricas de performance
 * 
 * DIFERENÇA DOS OUTROS:
 * - Gerenciar: Planejamento (o que será exibido)
 * - Monitor: Histórico (o que foi exibido)
 * - Debug Online: Diagnóstico técnico (por que não funciona)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Tooltip,
  useTheme,
  LinearProgress,
  Tabs,
  Tab,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Refresh,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  PlayArrow,
  Stop,
  Delete,
  Code,
  Message,
  Storage,
  QueryBuilder,
  Timeline,
} from '@mui/icons-material';
import { dispatcherDebugApi, RedisStatus, QueryLog, DispatcherMessage, DebugStats } from '../../services/api';
import { format } from 'date-fns';

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

function extractDispatchEmptyExplanation(response: unknown): {
  summary: string;
  checks: Array<{ id: string; label: string; ok: boolean; hint?: string }>;
  diagnosticsPath?: string;
} | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const plan = (r.plan ?? (r.data as Record<string, unknown> | undefined)?.plan) as
    | { metadata?: { emptyExplanation?: unknown } }
    | undefined;
  const ex = plan?.metadata?.emptyExplanation as
    | { summary?: string; checks?: unknown; diagnosticsPath?: string }
    | undefined;
  if (!ex || !Array.isArray(ex.checks)) return null;
  return {
    summary: String(ex.summary || ''),
    checks: ex.checks as Array<{ id: string; label: string; ok: boolean; hint?: string }>,
    diagnosticsPath: ex.diagnosticsPath ? String(ex.diagnosticsPath) : undefined,
  };
}

const DispatcherDebug: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10); // segundos (aumentado para evitar rate limiting)

  // Estado
  const [redisStatus, setRedisStatus] = useState<RedisStatus | null>(null);
  const [queries, setQueries] = useState<QueryLog[]>([]);
  const [messages, setMessages] = useState<DispatcherMessage[]>([]);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<QueryLog | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<DispatcherMessage | null>(null);

  // Refs para scroll automático
  const queriesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadAll();
      }, refreshInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  // Scroll automático quando novos logs chegam
  useEffect(() => {
    if (autoRefresh && queriesEndRef.current) {
      queriesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [queries, autoRefresh]);

  useEffect(() => {
    if (autoRefresh && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoRefresh]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [redisRes, queriesRes, messagesRes, statsRes] = await Promise.all([
        dispatcherDebugApi.getRedisStatus(),
        dispatcherDebugApi.getQueries({ limit: 100 }),
        dispatcherDebugApi.getMessages({ limit: 100 }),
        dispatcherDebugApi.getStats(),
      ]);

      setRedisStatus(redisRes.data);
      setQueries(queriesRes.data || []);
      setMessages(messagesRes.data || []);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados de debug');
      console.error('Erro ao carregar debug:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Deseja limpar todos os logs de debug?')) return;

    try {
      await dispatcherDebugApi.clearLogs();
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao limpar logs');
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatQuery = (query: string, maxLength: number = 100) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Debug Online - Dispatcher
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
            }
            label="Auto-refresh"
          />
          {autoRefresh && (
            <TextField
              size="small"
              type="number"
              label="Intervalo (s)"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Math.max(1, parseInt(e.target.value) || 5))}
              sx={{ width: 120 }}
            />
          )}
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadAll}
            disabled={loading}
          >
            Atualizar
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={handleClearLogs}
          >
            Limpar Logs
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Status Redis */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Status Redis
          </Typography>
          {redisStatus ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={redisStatus.enabled ? 'Habilitado' : 'Desabilitado'}
                    color={redisStatus.enabled ? 'primary' : 'default'}
                    size="small"
                  />
                  <Chip
                    label={redisStatus.connected ? 'Conectado' : 'Desconectado'}
                    color={redisStatus.connected ? 'success' : 'error'}
                    size="small"
                    icon={redisStatus.connected ? <CheckCircle /> : <Error />}
                  />
                  <Chip
                    label={redisStatus.cacheServiceAvailable ? 'Cache OK' : 'Cache Indisponível'}
                    color={redisStatus.cacheServiceAvailable ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
                {redisStatus.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <strong>Erro:</strong> {redisStatus.error}
                  </Alert>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Host:</strong> {redisStatus.config.host}:{redisStatus.config.port} (DB: {redisStatus.config.db})
                </Typography>
                {redisStatus.config.url && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>URL:</strong> {redisStatus.config.url.replace(/:[^:@]+@/, ':****@')}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  <strong>Última verificação:</strong> {format(new Date(redisStatus.lastCheck), 'dd/MM/yyyy HH:mm:ss')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                {stats && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Estatísticas
                    </Typography>
                    <Typography variant="body2">
                      Queries: {stats.totalQueries} ({stats.queriesWithError} com erro)
                    </Typography>
                    <Typography variant="body2">
                      Mensagens: {stats.totalMessages} ({stats.messagesWithError} com erro)
                    </Typography>
                    <Typography variant="body2">
                      Duração média query: {formatDuration(stats.avgQueryDuration)}
                    </Typography>
                    <Typography variant="body2">
                      Duração média mensagem: {formatDuration(stats.avgMessageDuration)}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          ) : (
            <Typography color="text.secondary">Carregando status do Redis...</Typography>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Queries SQL" icon={<QueryBuilder />} iconPosition="start" />
            <Tab label="Mensagens" icon={<Message />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Query</TableCell>
                  <TableCell>Parâmetros</TableCell>
                  <TableCell>Duração</TableCell>
                  <TableCell>Linhas</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queries.map((query) => (
                  <TableRow key={query.id} hover>
                    <TableCell>
                      {format(new Date(query.timestamp), 'HH:mm:ss.SSS')}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: '0.85em' }}>
                        {formatQuery(query.query, 80)}
                      </code>
                    </TableCell>
                    <TableCell>
                      {query.params && query.params.length > 0 ? (
                        <Chip label={`${query.params.length} params`} size="small" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(query.duration)}</TableCell>
                    <TableCell>{query.rowCount ?? '-'}</TableCell>
                    <TableCell>
                      {query.error ? (
                        <Chip label="Erro" color="error" size="small" icon={<Error />} />
                      ) : (
                        <Chip label="OK" color="success" size="small" icon={<CheckCircle />} />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => setSelectedQuery(query)}
                      >
                        <Code />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {queries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Nenhuma query registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div ref={queriesEndRef} />
          </TableContainer>

          {/* Dialog de detalhes da query */}
          {selectedQuery && (
            <Accordion expanded={true} sx={{ mt: 2 }}>
              <AccordionSummary>
                <Typography variant="subtitle2">Detalhes da Query</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>SQL:</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
                    <code style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
                      {selectedQuery.query}
                    </code>
                  </Paper>
                  {selectedQuery.params && selectedQuery.params.length > 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>Parâmetros:</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
                        <pre style={{ margin: 0, fontSize: '0.9em' }}>
                          {JSON.stringify(selectedQuery.params, null, 2)}
                        </pre>
                      </Paper>
                    </>
                  )}
                  {selectedQuery.error && (
                    <>
                      <Typography variant="subtitle2" gutterBottom color="error">
                        Erro:
                      </Typography>
                      <Alert severity="error">{selectedQuery.error}</Alert>
                    </>
                  )}
                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Typography variant="body2">
                      <strong>Duração:</strong> {formatDuration(selectedQuery.duration)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Linhas:</strong> {selectedQuery.rowCount ?? '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Source:</strong> {selectedQuery.source || '-'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => setSelectedQuery(null)}
                    sx={{ mt: 2 }}
                  >
                    Fechar
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Direção</TableCell>
                  <TableCell>Totem/UIN</TableCell>
                  <TableCell>Endpoint</TableCell>
                  <TableCell>Duração</TableCell>
                  <TableCell>Cache</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.id} hover>
                    <TableCell>
                      {format(new Date(msg.timestamp), 'HH:mm:ss.SSS')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={msg.direction === 'incoming' ? 'Entrada' : 'Saída'}
                        color={msg.direction === 'incoming' ? 'primary' : 'secondary'}
                        size="small"
                        icon={msg.direction === 'incoming' ? <PlayArrow /> : <Stop />}
                      />
                    </TableCell>
                    <TableCell>
                      {msg.totemId ? `Totem ${msg.totemId}` : '-'}
                      {msg.uin && <div style={{ fontSize: '0.75em', color: 'text.secondary' }}>{msg.uin}</div>}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: '0.85em' }}>
                        {msg.method} {msg.endpoint}
                      </code>
                    </TableCell>
                    <TableCell>{formatDuration(msg.duration)}</TableCell>
                    <TableCell>
                      {msg.fromCache !== undefined && (
                        <Chip
                          label={msg.fromCache ? 'Cache' : 'DB'}
                          color={msg.fromCache ? 'success' : 'default'}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {msg.error ? (
                        <Chip label="Erro" color="error" size="small" icon={<Error />} />
                      ) : (
                        <Chip label="OK" color="success" size="small" icon={<CheckCircle />} />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => setSelectedMessage(msg)}
                      >
                        <Code />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {messages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Nenhuma mensagem registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div ref={messagesEndRef} />
          </TableContainer>

          {/* Dialog de detalhes da mensagem */}
          {selectedMessage && (
            <Accordion expanded={true} sx={{ mt: 2 }}>
              <AccordionSummary>
                <Typography variant="subtitle2">Detalhes da Mensagem</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Request:</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2, maxHeight: 300, overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '0.9em' }}>
                          {JSON.stringify(selectedMessage.request, null, 2)}
                        </pre>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Response:</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2, maxHeight: 300, overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '0.9em' }}>
                          {JSON.stringify(selectedMessage.response, null, 2)}
                        </pre>
                      </Paper>
                    </Grid>
                  </Grid>
                  {(() => {
                    const ex = extractDispatchEmptyExplanation(selectedMessage.response);
                    if (!ex || !ex.checks.length) return null;
                    return (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Plano sem itens — o que falhou?
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {ex.summary}
                        </Typography>
                        <List dense disablePadding>
                          {ex.checks.map((c) => (
                            <ListItem key={c.id} disableGutters sx={{ alignItems: 'flex-start', py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                                {c.ok ? (
                                  <CheckCircle color="success" fontSize="small" />
                                ) : (
                                  <Error color="error" fontSize="small" />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={c.label}
                                secondary={
                                  c.hint ||
                                  (c.ok
                                    ? 'Conforme nesta verificação.'
                                    : 'Corrija este ponto e volte a testar o dispatch.')
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                        {ex.diagnosticsPath ? (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Diagnóstico API (autenticado): <code>{ex.diagnosticsPath}</code>
                          </Typography>
                        ) : null}
                      </Alert>
                    );
                  })()}
                  {selectedMessage.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <strong>Erro:</strong> {selectedMessage.error}
                    </Alert>
                  )}
                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Typography variant="body2">
                      <strong>Duração:</strong> {formatDuration(selectedMessage.duration)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>From Cache:</strong> {selectedMessage.fromCache ? 'Sim' : 'Não'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => setSelectedMessage(null)}
                    sx={{ mt: 2 }}
                  >
                    Fechar
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
};

export default DispatcherDebug;

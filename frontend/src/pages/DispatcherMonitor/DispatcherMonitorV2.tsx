import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore, Pause, PlayArrow, Refresh } from '@mui/icons-material';
import {
  DispatcherMessage,
  DispatcherMessageFilters,
  dispatcherDebugApi,
  getWebSocketUrl,
} from '../../services/api';
import {
  dispatcherHttpStatus,
  dispatcherMessageIsError,
  groupDispatcherMessages,
} from '../../utils/dispatcherTelemetry';

interface MonitorFilters {
  endpoint: string;
  eventType: string;
  uin: string;
  status: string;
  direction: '' | 'incoming' | 'outgoing';
  errorsOnly: boolean;
}

const EMPTY_FILTERS: MonitorFilters = {
  endpoint: '',
  eventType: '',
  uin: '',
  status: '',
  direction: '',
  errorsOnly: false,
};

function normalizeMessage(raw: DispatcherMessage): DispatcherMessage {
  const value = raw as DispatcherMessage & Record<string, unknown>;
  return {
    ...raw,
    traceId: raw.traceId ?? (String(value.trace_id ?? '') || undefined),
    eventType: raw.eventType ?? (String(value.event_type ?? '') || undefined),
    mediaName: raw.mediaName ?? (String(value.media_name ?? '') || undefined),
    httpStatus: raw.httpStatus ?? (Number(value.http_status ?? value.status_code) || undefined),
  };
}

function matchesFilters(message: DispatcherMessage, filters: MonitorFilters): boolean {
  const status = dispatcherHttpStatus(message);
  return (
    (!filters.endpoint || (message.endpoint ?? '').toLowerCase().includes(filters.endpoint.toLowerCase())) &&
    (!filters.eventType || (message.eventType ?? '').toLowerCase().includes(filters.eventType.toLowerCase())) &&
    (!filters.uin || (message.uin ?? '').toLowerCase().includes(filters.uin.toLowerCase())) &&
    (!filters.status || String(status ?? '').includes(filters.status)) &&
    (!filters.direction || message.direction === filters.direction) &&
    (!filters.errorsOnly || dispatcherMessageIsError(message))
  );
}

const DispatcherMonitorV2: React.FC = () => {
  const [messages, setMessages] = useState<DispatcherMessage[]>([]);
  const [draft, setDraft] = useState<MonitorFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<MonitorFilters>(EMPTY_FILTERS);
  const [grouped, setGrouped] = useState(true);
  const [hideResponses, setHideResponses] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const fetchMessages = useCallback(async () => {
    if (paused) return;
    const params: DispatcherMessageFilters = {
      limit: 200,
      endpoint: filters.endpoint || undefined,
      eventType: filters.eventType || undefined,
      uin: filters.uin || undefined,
      statusCode: filters.status ? Number(filters.status) : undefined,
      direction: filters.direction || undefined,
      hasError: filters.errorsOnly || undefined,
    };
    try {
      setLoading(true);
      setError(null);
      const data = await dispatcherDebugApi.getMessageLogs(params);
      setMessages((data ?? []).map(normalizeMessage));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  }, [filters, paused]);

  useEffect(() => {
    void fetchMessages();
    if (paused) return undefined;
    const timer = window.setInterval(() => void fetchMessages(), 5000);
    return () => window.clearInterval(timer);
  }, [fetchMessages, paused]);

  useEffect(() => {
    if (paused) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    let disposed = false;
    let reconnectTimer: number | undefined;
    const connect = () => {
      if (disposed) return;
      const socket = new WebSocket(getWebSocketUrl(token));
      socketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== 'dispatcher-message' || !payload.data) return;
          const message = normalizeMessage(payload.data);
          if (!matchesFilters(message, filters)) return;
          setMessages((previous) => [message, ...previous.filter((item) => item.id !== message.id)].slice(0, 200));
        } catch {
          // /ws é compartilhado; eventos sem relação com o monitor são ignorados.
        }
      };
      socket.onclose = () => {
        if (!disposed) reconnectTimer = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [filters, paused]);

  const groups = useMemo(
    () => groupDispatcherMessages(messages, grouped, hideResponses),
    [grouped, hideResponses, messages],
  );

  const toggleExpanded = (key: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h1">Monitor Dispatcher - Tempo Real</Typography>
            <Box>
              <Tooltip title={paused ? 'Retomar' : 'Pausar'}>
                <IconButton onClick={() => setPaused((value) => !value)} color={paused ? 'default' : 'primary'}>
                  {paused ? <PlayArrow /> : <Pause />}
                </IconButton>
              </Tooltip>
              <IconButton onClick={() => void fetchMessages()} disabled={loading}><Refresh /></IconButton>
            </Box>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField size="small" label="Endpoint" value={draft.endpoint}
                onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} />
              <TextField size="small" label="Event type" value={draft.eventType}
                onChange={(event) => setDraft({ ...draft, eventType: event.target.value })} />
              <TextField size="small" label="UIN" value={draft.uin}
                onChange={(event) => setDraft({ ...draft, uin: event.target.value })} />
              <TextField size="small" label="Status HTTP" value={draft.status} sx={{ width: 130 }}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Direção</InputLabel>
                <Select value={draft.direction} label="Direção"
                  onChange={(event) => setDraft({ ...draft, direction: event.target.value as MonitorFilters['direction'] })}>
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="incoming">Entrada</MenuItem>
                  <MenuItem value="outgoing">Saída</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel control={<Checkbox checked={draft.errorsOnly}
                onChange={(event) => setDraft({ ...draft, errorsOnly: event.target.checked })} />}
                label="Somente erros" />
              <Button variant="contained" onClick={() => setFilters({ ...draft })}>Aplicar filtros</Button>
              <Button onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); }}>Limpar</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <FormControlLabel control={<Checkbox checked={grouped}
                onChange={(event) => setGrouped(event.target.checked)} />} label="Agrupar por traceId" />
              <FormControlLabel control={<Checkbox checked={hideResponses}
                onChange={(event) => setHideResponses(event.target.checked)} />} label="Ocultar respostas" />
            </Box>
          </Paper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!loading && groups.length === 0 && <Alert severity="info">Nenhuma mensagem encontrada.</Alert>}

          {groups.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Direção</TableCell>
                    <TableCell>Endpoint / evento</TableCell>
                    <TableCell>Mídia</TableCell>
                    <TableCell>UIN</TableCell>
                    <TableCell>Status HTTP</TableCell>
                    <TableCell>Duração</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => {
                    const incoming = group.incoming;
                    const outgoing = group.outgoing;
                    const primary = incoming ?? outgoing ?? group.messages[0];
                    const failed = group.messages.some(dispatcherMessageIsError);
                    const status = outgoing ? dispatcherHttpStatus(outgoing) : dispatcherHttpStatus(primary);
                    const isOpen = expanded.has(group.key);
                    return (
                      <React.Fragment key={group.key}>
                        <TableRow hover onClick={() => toggleExpanded(group.key)}
                          sx={{ cursor: 'pointer', borderLeft: 4, borderColor: failed ? 'error.main' : incoming && outgoing ? 'success.main' : 'warning.main' }}>
                          <TableCell padding="checkbox"><IconButton size="small">{isOpen ? <ExpandLess /> : <ExpandMore />}</IconButton></TableCell>
                          <TableCell>{new Date(primary.timestamp).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <Chip size="small" label={incoming && outgoing ? 'entrada ↔ saída' : primary.direction}
                              color={failed ? 'error' : incoming && outgoing ? 'success' : 'warning'} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{primary.endpoint || 'N/A'}</Typography>
                            <Typography variant="caption" color="text.secondary">{primary.eventType || '—'}</Typography>
                          </TableCell>
                          <TableCell>{primary.mediaName || outgoing?.mediaName || '—'}</TableCell>
                          <TableCell>{primary.uin || outgoing?.uin || '—'}</TableCell>
                          <TableCell>{status ?? (failed ? 'Erro' : '—')}</TableCell>
                          <TableCell>{outgoing?.duration ?? primary.duration ?? '—'}{(outgoing?.duration ?? primary.duration) !== undefined ? 'ms' : ''}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="subtitle2">
                                  Trace: {group.traceId || 'ausente (mensagem legada)'}
                                </Typography>
                                {group.messages.map((message) => (
                                  <Box key={message.id} sx={{ mt: 1 }}>
                                    <Typography variant="caption" fontWeight={700}>
                                      {message.direction} · {message.method || '—'} · {message.eventType || '—'}
                                    </Typography>
                                    <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                      {JSON.stringify(message.direction === 'incoming' ? message.request : message.response, null, 2)}
                                    </pre>
                                    {message.error && <Alert severity="error">{message.error}</Alert>}
                                  </Box>
                                ))}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DispatcherMonitorV2;

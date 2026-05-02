/**
 * Dispatcher Monitor - Monitoramento em Tempo Real
 * 
 * Tela de monitoramento em tempo real do tráfego do Dispatcher:
 * - Amarelo: Requisições de entrada (incoming)
 * - Vermelho: Requisições com erro
 * - Verde: Requisições sendo devolvidas com sucesso (outgoing)
 * - Modal com detalhes completos ao clicar
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  LinearProgress,
  Tooltip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Refresh,
  Close,
  PlayArrow,
  Pause,
  FilterList,
  Clear,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { dispatcherDebugApi, DispatcherMessage, getWebSocketUrl } from '../../services/api';

/** Resposta do dispatch pode vir como `{ plan }` ou `{ data: { plan } }` conforme versão/log. */
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

interface MessageDetailsModalProps {
  open: boolean;
  message: DispatcherMessage | null;
  onClose: () => void;
}

const MessageDetailsModal: React.FC<MessageDetailsModalProps> = ({ open, message, onClose }) => {
  const theme = useTheme();

  if (!message) return null;

  const getDirectionColor = (direction: string) => {
    if (direction === 'incoming') return theme.palette.warning.main;
    if (direction === 'outgoing' && message.error) return theme.palette.error.main;
    if (direction === 'outgoing') return theme.palette.success.main;
    return theme.palette.grey[500];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Detalhes da Mensagem</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">ID</Typography>
              <Typography variant="body2">{message.id}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
              <Typography variant="body2">
                {new Date(message.timestamp as any).toLocaleString('pt-BR')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Direção</Typography>
              <Chip
                label={message.direction}
                size="small"
                sx={{
                  bgcolor: getDirectionColor(message.direction),
                  color: 'white',
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Endpoint</Typography>
              <Typography variant="body2">{message.endpoint || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Método</Typography>
              <Typography variant="body2">{message.method || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">UIN</Typography>
              <Typography variant="body2">{message.uin || 'N/A'}</Typography>
            </Grid>
            {message.totemId && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Totem ID</Typography>
                <Typography variant="body2">{message.totemId}</Typography>
              </Grid>
            )}
            {message.duration !== undefined && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Duração</Typography>
                <Typography variant="body2">{message.duration}ms</Typography>
              </Grid>
            )}
            {message.fromCache && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Cache</Typography>
                <Chip label="Sim" size="small" color="info" />
              </Grid>
            )}
            {message.error && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Erro</Typography>
                <Alert severity="error" sx={{ mt: 1 }}>
                  {message.error}
                </Alert>
              </Grid>
            )}
            {message.request && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Request</Typography>
                <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                    {JSON.stringify(message.request, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
            {message.response && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Response</Typography>
                <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                    {JSON.stringify(message.response, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
            {(() => {
              const ex = extractDispatchEmptyExplanation(message.response);
              if (!ex || !ex.checks.length) return null;
              return (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ mt: 1 }}>
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
                              <ErrorIcon color="error" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={c.label}
                            secondary={
                              c.hint ||
                              (c.ok ? 'Conforme nesta verificação.' : 'Corrija este ponto e volte a testar o dispatch.')
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
                </Grid>
              );
            })()}
            {message.ipAddress && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">IP Address</Typography>
                <Typography variant="body2">{message.ipAddress}</Typography>
              </Grid>
            )}
            {message.userAgent && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">User Agent</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {message.userAgent}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

const DispatcherMonitor: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<DispatcherMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<DispatcherMessage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [paused, setPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsReconnectAttempts = useRef(0);

  const fetchMessages = async () => {
    if (paused) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await dispatcherDebugApi.getMessageLogs(100);
      setMessages(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('Token não encontrado, WebSocket não conectado');
        return;
      }

      const wsUrl = getWebSocketUrl(token);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsReconnectAttempts.current = 0;
        console.log('WebSocket conectado para monitoramento em tempo real');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dispatcher-message' && data.data) {
            // Adicionar nova mensagem ao início da lista
            setMessages((prev) => [data.data, ...prev].slice(0, 100));
          }
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Erro WebSocket:', err);
      };

      ws.onclose = () => {
        const delay = Math.min(3000 + wsReconnectAttempts.current * 2000, 30000);
        wsReconnectAttempts.current += 1;
        if (wsReconnectAttempts.current <= 3) {
          console.warn(`WebSocket desconectado. Reconectando em ${delay / 1000}s (tentativa ${wsReconnectAttempts.current})...`);
        }
        setTimeout(() => {
          if (autoRefresh && !paused && wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, delay);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Erro ao conectar WebSocket:', err);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (autoRefresh && !paused) {
      refreshIntervalRef.current = setInterval(() => {
        fetchMessages();
      }, 5000); // Atualizar a cada 5 segundos

      connectWebSocket();
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoRefresh, paused]);

  const handleMessageClick = (message: DispatcherMessage) => {
    setSelectedMessage(message);
    setModalOpen(true);
  };

  const getMessageColor = (message: DispatcherMessage): string => {
    if (message.direction === 'incoming') {
      return theme.palette.warning.light;
    }
    if (message.direction === 'outgoing' && message.error) {
      return theme.palette.error.light;
    }
    if (message.direction === 'outgoing') {
      return theme.palette.success.light;
    }
    return theme.palette.grey[100];
  };

  const getMessageBorderColor = (message: DispatcherMessage): string => {
    if (message.direction === 'incoming') {
      return theme.palette.warning.main;
    }
    if (message.direction === 'outgoing' && message.error) {
      return theme.palette.error.main;
    }
    if (message.direction === 'outgoing') {
      return theme.palette.success.main;
    }
    return theme.palette.grey[400];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" component="h1">
              Monitor Dispatcher - Tempo Real
            </Typography>
            <Box display="flex" gap={1}>
              <Tooltip title={paused ? 'Retomar' : 'Pausar'}>
                <IconButton
                  onClick={() => setPaused(!paused)}
                  color={paused ? 'default' : 'primary'}
                >
                  {paused ? <PlayArrow /> : <Pause />}
                </IconButton>
              </Tooltip>
              <IconButton onClick={fetchMessages} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading && messages.length === 0 && (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          )}

          {!loading && messages.length === 0 && (
            <Alert severity="info">
              Nenhuma mensagem encontrada. Aguarde requisições dos players.
            </Alert>
          )}

          {messages.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Direção</TableCell>
                    <TableCell>Endpoint</TableCell>
                    <TableCell>UIN</TableCell>
                    <TableCell>Método</TableCell>
                    <TableCell>Duração</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow
                      key={message.id}
                      onClick={() => handleMessageClick(message)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: getMessageColor(message),
                        borderLeft: `4px solid ${getMessageBorderColor(message)}`,
                        '&:hover': {
                          bgcolor: getMessageColor(message),
                          opacity: 0.8,
                        },
                      }}
                    >
                      <TableCell>
                        {new Date(message.timestamp as any).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={message.direction}
                          size="small"
                          sx={{
                            bgcolor:
                              message.direction === 'incoming'
                                ? theme.palette.warning.main
                                : message.error
                                ? theme.palette.error.main
                                : theme.palette.success.main,
                            color: 'white',
                          }}
                        />
                      </TableCell>
                      <TableCell>{message.endpoint || 'N/A'}</TableCell>
                      <TableCell>{message.uin || 'N/A'}</TableCell>
                      <TableCell>{message.method || 'N/A'}</TableCell>
                      <TableCell>
                        {message.duration !== undefined ? `${message.duration}ms` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {message.error ? (
                          <Chip label="Erro" size="small" color="error" />
                        ) : message.fromCache ? (
                          <Chip label="Cache" size="small" color="info" />
                        ) : (
                          <Chip label="OK" size="small" color="success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {messages.length > 0 && (
            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Total: {messages.length} mensagens | Clique em uma linha para ver detalhes
              </Typography>
              <Box display="flex" gap={1} alignItems="center">
                <Chip
                  label="Amarelo: Entrada"
                  size="small"
                  sx={{ bgcolor: theme.palette.warning.main, color: 'white' }}
                />
                <Chip
                  label="Verde: Sucesso"
                  size="small"
                  sx={{ bgcolor: theme.palette.success.main, color: 'white' }}
                />
                <Chip
                  label="Vermelho: Erro"
                  size="small"
                  sx={{ bgcolor: theme.palette.error.main, color: 'white' }}
                />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <MessageDetailsModal
        open={modalOpen}
        message={selectedMessage}
        onClose={() => {
          setModalOpen(false);
          setSelectedMessage(null);
        }}
      />
    </Box>
  );
};

export default DispatcherMonitor;

/**
 * Totem Logs Viewer - Smart Signage v2.1
 * Componente para visualizar logs de totens em tempo real
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Download,
  Refresh,
  FilterList,
  Clear,
  Info,
  Warning,
  Error as ErrorIcon,
  BugReport,
} from '@mui/icons-material';
import { totemApi, getWebSocketUrl } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

interface TotemLogsViewerProps {
  totemId: number;
  totemName?: string;
  onClose?: () => void;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: any;
}

const TotemLogsViewer: React.FC<TotemLogsViewerProps> = ({
  totemId,
  totemName,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [filters, setFilters] = useState({
    level: '' as '' | 'info' | 'warn' | 'error' | 'debug',
    startDate: '',
    endDate: '',
    search: '',
    limit: 1000,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsReconnectAttempts = useRef(0);
  const wsLoggedFailure = useRef(false);

  useEffect(() => {
    loadLogs();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [totemId]);

  useEffect(() => {
    // Auto-scroll para último log
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await totemApi.getLogs(totemId, {
        level: filters.level || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        search: filters.search || undefined,
        limit: filters.limit,
      });
      setLogs(response.data || []);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao carregar logs'));
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showError('Token de autenticação não encontrado');
        return;
      }

      const wsUrl = getWebSocketUrl(token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        wsReconnectAttempts.current = 0;
        wsLoggedFailure.current = false;
        ws.send(JSON.stringify({
          type: 'subscribe_logs',
          data: { totemId }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'connected') {
            // Conexão estabelecida
          } else if (message.type === 'log') {
            setLogs(prev => [message.data, ...prev].slice(0, filters.limit));
          } else if (message.type === 'log_batch') {
            setLogs(message.data || []);
          } else if (message.type === 'error') {
            showError('Erro no WebSocket', message.error);
          }
        } catch {
          /* payload JSON inválido */
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        if (!wsLoggedFailure.current) {
          wsLoggedFailure.current = true;
          /* tempo real indisponível; logs históricos continuam via HTTP */
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        const delay = Math.min(5000 + wsReconnectAttempts.current * 2000, 30000);
        wsReconnectAttempts.current += 1;
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, delay);
      };
    } catch (error: any) {
      showError('Erro ao conectar WebSocket', error.message);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await totemApi.downloadLogs(totemId, {
        level: filters.level || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        search: filters.search || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `totem_${totemId}_logs_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccess('Logs baixados com sucesso');
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao baixar logs'));
    }
  };

  const handleClearFilters = () => {
    setFilters({
      level: '',
      startDate: '',
      endDate: '',
      search: '',
      limit: 1000,
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'default';
      default:
        return 'default';
    }
  };

  const getLevelIcon = (level: string): React.ReactElement | undefined => {
    switch (level) {
      case 'error':
        return <ErrorIcon fontSize="small" />;
      case 'warn':
        return <Warning fontSize="small" />;
      case 'info':
        return <Info fontSize="small" />;
      case 'debug':
        return <BugReport fontSize="small" />;
      default:
        return undefined;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('pt-BR');
    } catch {
      return timestamp;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Logs em Tempo Real {totemName && `- ${totemName}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={wsConnected ? 'Conectado' : 'Desconectado'}
              color={wsConnected ? 'success' : 'error'}
              size="small"
            />
            {onClose && (
              <Button size="small" onClick={onClose}>
                Fechar
              </Button>
            )}
          </Box>
        </Box>

        {/* Filtros */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Nível</InputLabel>
              <Select
                value={filters.level}
                label="Nível"
                onChange={(e) => setFilters({ ...filters, level: e.target.value as any })}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Data Início"
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              label="Data Fim"
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              label="Buscar"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              sx={{ flex: 1, minWidth: 200 }}
            />

            <TextField
              size="small"
              label="Limite"
              type="number"
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) || 1000 })}
              sx={{ width: 100 }}
            />

            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={loadLogs}
              disabled={loading}
            >
              Filtrar
            </Button>

            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={handleClearFilters}
            >
              Limpar
            </Button>

            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleDownload}
            >
              Download
            </Button>
          </Box>
        </Paper>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Lista de Logs */}
        <Paper sx={{ maxHeight: 600, overflow: 'auto' }}>
          <List dense>
            {logs.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="Nenhum log encontrado"
                  secondary="Os logs aparecerão aqui quando disponíveis"
                />
              </ListItem>
            ) : (
              logs.map((log, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            icon={getLevelIcon(log.level)}
                            label={log.level.toUpperCase()}
                            color={getLevelColor(log.level) as any}
                            size="small"
                          />
                          <Typography variant="body2" color="text.secondary">
                            {formatTimestamp(log.timestamp)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            {log.message}
                          </Typography>
                          {log.metadata && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              {JSON.stringify(log.metadata, null, 2)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < logs.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))
            )}
            <div ref={logsEndRef} />
          </List>
        </Paper>

        {!wsConnected && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            WebSocket desconectado. Tentando reconectar...
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default TotemLogsViewer;


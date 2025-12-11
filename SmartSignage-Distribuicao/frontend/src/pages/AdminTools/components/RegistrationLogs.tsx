import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Refresh,
  ExpandMore,
  ExpandLess,
  Visibility,
  Search,
} from '@mui/icons-material';
import { debugApi, PlayerRegistrationLog } from '../../../services/api';

const RegistrationLogs: React.FC = () => {
  const [logs, setLogs] = useState<PlayerRegistrationLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50);
  const [showSystemLogs, setShowSystemLogs] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [limit]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await debugApi.getPlayerRegistrationLogs({ limit });
      setLogs(response.totems || []);
      setSystemLogs(response.systemLogs || []);
    } catch (e: any) {
      setError('Erro ao carregar logs: ' + (e.message || 'Erro desconhecido'));
      console.error('Erro ao carregar logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'warning';
      case 'online':
        return 'success';
      case 'offline':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredLogs = logs.filter(log =>
    log.uin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Buscar"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Limite</InputLabel>
          <Select
            value={limit}
            label="Limite"
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={200}>200</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadLogs}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Totens Registrados ({filteredLogs.length})
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50}></TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Identifier</TableCell>
                  <TableCell>UIN</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Data de Registro</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        Nenhum log encontrado
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => toggleRow(log.id)}
                          >
                            {expandedRows.has(log.id) ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{log.id}</TableCell>
                        <TableCell>{log.identifier || 'N/A'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {log.uin}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.status?.toUpperCase() || 'N/A'}
                            color={getStatusColor(log.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{log.ipAddress || 'N/A'}</TableCell>
                        <TableCell>
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary">
                            <Visibility />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0 }}>
                          <Collapse in={expandedRows.has(log.id)} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Informações de Hardware
                              </Typography>
                              <Grid container spacing={2}>
                                {log.hardware && (
                                  <>
                                    {log.hardware.mac && (
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          MAC Address:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                          {log.hardware.mac}
                                        </Typography>
                                      </Grid>
                                    )}
                                    {log.hardware.hostname && (
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          Hostname:
                                        </Typography>
                                        <Typography variant="body2">
                                          {log.hardware.hostname}
                                        </Typography>
                                      </Grid>
                                    )}
                                    {log.hardware.platform && (
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          Plataforma:
                                        </Typography>
                                        <Typography variant="body2">
                                          {log.hardware.platform}
                                        </Typography>
                                      </Grid>
                                    )}
                                    {log.hardware.arch && (
                                      <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          Arquitetura:
                                        </Typography>
                                        <Typography variant="body2">
                                          {log.hardware.arch}
                                        </Typography>
                                      </Grid>
                                    )}
                                  </>
                                )}
                              </Grid>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {systemLogs.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Logs do Sistema ({systemLogs.length})
              </Typography>
              <Button
                size="small"
                onClick={() => setShowSystemLogs(!showSystemLogs)}
              >
                {showSystemLogs ? 'Ocultar' : 'Mostrar'}
              </Button>
            </Box>
            <Collapse in={showSystemLogs}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {systemLogs.map((log, index) => (
                  <Box key={index} sx={{ mb: 0.5 }}>
                    {log}
                  </Box>
                ))}
              </Paper>
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RegistrationLogs;


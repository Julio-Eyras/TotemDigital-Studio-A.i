import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  CircularProgress,
  Grid,
  Divider,
  Chip,
} from '@mui/material';
import {
  Search,
  Refresh,
} from '@mui/icons-material';
import { debugApi } from '../../../services/api';

const TotemDetails: React.FC = () => {
  const [totemId, setTotemId] = useState('');
  const [totemInfo, setTotemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTotem = async () => {
    if (!totemId.trim()) {
      setError('Por favor, insira um ID ou UIN do totem');
      return;
    }

    setLoading(true);
    setError(null);
    setTotemInfo(null);

    try {
      const response = await debugApi.getTotemInfo(totemId);
      if (response.success && response.totem) {
        setTotemInfo(response.totem);
      } else {
        setError('Totem não encontrado');
      }
    } catch (e: any) {
      setError('Erro ao buscar totem: ' + (e.message || 'Erro desconhecido'));
      console.error('Erro ao buscar totem:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchTotem();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Buscar Detalhes de Totem
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Digite o ID numérico ou UIN do totem para ver informações detalhadas.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="ID ou UIN do Totem"
              variant="outlined"
              value={totemId}
              onChange={(e) => setTotemId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="1 ou SSP-1234567890"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
            <Button
              variant="contained"
              onClick={searchTotem}
              disabled={loading || !totemId.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <Search />}
            >
              Buscar
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {totemInfo && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Informações do Totem
              </Typography>
              <Chip
                label={totemInfo.status?.toUpperCase() || 'N/A'}
                color={
                  totemInfo.status === 'online' ? 'success' :
                  totemInfo.status === 'pending_approval' ? 'warning' :
                  totemInfo.status === 'offline' ? 'default' : 'error'
                }
              />
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="text.secondary">
                    Informações Básicas
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <InfoRow label="ID" value={totemInfo.totem_id} />
                    <InfoRow label="Identifier" value={totemInfo.identifier} />
                    <InfoRow label="UIN" value={totemInfo.uin} />
                    <InfoRow label="Device ID" value={totemInfo.device_id} />
                    <InfoRow label="Status" value={totemInfo.status} />
                    <InfoRow label="IP Address" value={totemInfo.ip_address} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="text.secondary">
                    Datas e Status
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <InfoRow label="Criado em" value={totemInfo.created_at ? formatDate(totemInfo.created_at) : 'N/A'} />
                    <InfoRow label="Atualizado em" value={totemInfo.updated_at ? formatDate(totemInfo.updated_at) : 'N/A'} />
                    <InfoRow label="Último visto" value={totemInfo.last_seen ? formatDate(totemInfo.last_seen) : 'N/A'} />
                    <InfoRow label="Último heartbeat" value={totemInfo.last_heartbeat ? formatDate(totemInfo.last_heartbeat) : 'N/A'} />
                    <InfoRow label="Ativo" value={totemInfo.active ? 'Sim' : 'Não'} />
                    <InfoRow label="Bloqueado" value={totemInfo.blocked ? 'Sim' : 'Não'} />
                  </Box>
                </Paper>
              </Grid>

              {totemInfo.config && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Configuração
                    </Typography>
                    <Box sx={{ mt: 2 }}>
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
                        <pre>{JSON.stringify(totemInfo.config, null, 2)}</pre>
                      </Paper>
                    </Box>
                  </Paper>
                </Grid>
              )}

              {totemInfo.config?.hardware && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Informações de Hardware
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      {totemInfo.config.hardware.mac && (
                        <InfoRow label="MAC Address" value={totemInfo.config.hardware.mac} />
                      )}
                      {totemInfo.config.hardware.hostname && (
                        <InfoRow label="Hostname" value={totemInfo.config.hardware.hostname} />
                      )}
                      {totemInfo.config.hardware.platform && (
                        <InfoRow label="Plataforma" value={totemInfo.config.hardware.platform} />
                      )}
                      {totemInfo.config.hardware.arch && (
                        <InfoRow label="Arquitetura" value={totemInfo.config.hardware.arch} />
                      )}
                      {totemInfo.config.hardware.hardwareHash && (
                        <InfoRow 
                          label="Hardware Hash" 
                          value={
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {totemInfo.config.hardware.hardwareHash.substring(0, 50)}...
                            </Typography>
                          } 
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={searchTotem}
              >
                Buscar Novamente
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {!totemInfo && !loading && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Digite um ID ou UIN acima para iniciar a busca
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

interface InfoRowProps {
  label: string;
  value: any;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="caption" color="text.secondary">
      {label}:
    </Typography>
    <Typography variant="body2" sx={{ mt: 0.5 }}>
      {value || 'N/A'}
    </Typography>
  </Box>
);

export default TotemDetails;


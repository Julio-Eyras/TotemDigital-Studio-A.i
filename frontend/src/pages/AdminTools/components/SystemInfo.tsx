import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import {
  Refresh,
  Computer,
  Memory,
  Storage,
  NetworkCheck,
} from '@mui/icons-material';
import { debugApi, SystemInfo as SystemInfoType } from '../../../services/api';
import { adminApi } from '../../../services/api';
import { pickApiErrorMessage } from '../../../utils/apiErrorMessage';

const SystemInfo: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfoType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await debugApi.getSystemInfo();
      setSystemInfo(response);
    } catch (e: any) {
      setError('Erro ao carregar informações do sistema: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setLoading(true);
      // chamar endpoint de reconcile
      const result = await (await import('../../../services/api')).subscriberAccessApi.reconcilePlanPublisher();
      setSystemInfo((prev) => prev); // trigger render
      // mostrar alerta simples (usando console e alert temporariamente)
      if (result && result.success) {
        // eslint-disable-next-line no-alert
        alert('Reconciliação iniciada: ' + (result.results ? result.results.length + ' jobs processados' : 'verificar logs'));
      } else {
        // eslint-disable-next-line no-alert
        alert('Reconciliação solicitada, verifique logs no servidor');
      }
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert('Erro ao solicitar reconciliação: ' + (e?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (!systemInfo) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            Nenhuma informação disponível
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Informações do Sistema
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadSystemInfo}
          disabled={loading}
        >
          Atualizar
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Refresh />}
          onClick={async () => {
            try {
              setReconciling(true);
              await adminApi.reconcilePlanPublisherAccess();
              await loadSystemInfo();
              setReconciling(false);
            } catch (err: any) {
              setReconciling(false);
              setError(`Erro ao executar reconciliação: ${pickApiErrorMessage(err, 'Erro desconhecido')}`);
            }
          }}
          disabled={reconciling}
          sx={{ ml: 2 }}
        >
          {reconciling ? 'Reconciliação...' : 'Reconciliação planos↔acessos'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Informações do Sistema */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Computer />
                <Typography variant="h6">
                  Sistema
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <InfoRow label="Versão do Node" value={systemInfo.system.nodeVersion} />
              <InfoRow label="Plataforma" value={systemInfo.system.platform} />
              <InfoRow label="Ambiente" value={systemInfo.system.env} />
              <InfoRow 
                label="Uptime" 
                value={formatUptime(systemInfo.system.uptime)} 
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Memória */}
        {systemInfo.system.memory && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Memory />
                  <Typography variant="h6">
                    Memória
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <InfoRow 
                  label="RSS (Resident Set Size)" 
                  value={formatBytes(systemInfo.system.memory.rss)} 
                />
                <InfoRow 
                  label="Heap Total" 
                  value={formatBytes(systemInfo.system.memory.heapTotal)} 
                />
                <InfoRow 
                  label="Heap Used" 
                  value={formatBytes(systemInfo.system.memory.heapUsed)} 
                />
                <InfoRow 
                  label="External" 
                  value={formatBytes(systemInfo.system.memory.external)} 
                />
                <InfoRow 
                  label="Array Buffers" 
                  value={formatBytes(systemInfo.system.memory.arrayBuffers || 0)} 
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Estatísticas de Totens */}
        {systemInfo.totems && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <NetworkCheck />
                  <Typography variant="h6">
                    Estatísticas de Totens
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {systemInfo.totems.stats && (
                    <>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                          <Typography variant="h4">
                            {systemInfo.totems.stats.total || 0}
                          </Typography>
                          <Typography variant="body2">
                            Total de Totens
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                          <Typography variant="h4">
                            {systemInfo.totems.stats.pending || 0}
                          </Typography>
                          <Typography variant="body2">
                            Pendentes
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                          <Typography variant="h4">
                            {systemInfo.totems.stats.online || 0}
                          </Typography>
                          <Typography variant="body2">
                            Online
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.300', color: 'grey.800' }}>
                          <Typography variant="h4">
                            {systemInfo.totems.stats.offline || 0}
                          </Typography>
                          <Typography variant="body2">
                            Offline
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                          <Typography variant="h4">
                            {systemInfo.totems.stats.registered_last_24h || 0}
                          </Typography>
                          <Typography variant="body2">
                            Registrados nas últimas 24h
                          </Typography>
                        </Paper>
                      </Grid>
                    </>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Registros Recentes */}
        {systemInfo.totems?.recentRegistrations && systemInfo.totems.recentRegistrations.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Registros Recentes
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {systemInfo.totems.recentRegistrations.map((totem: any, index: number) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {totem.identifier || `Totem ${totem.totem_id}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            UIN: {totem.uin}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            IP: {totem.ip_address || 'N/A'} | {new Date(totem.created_at).toLocaleString('pt-BR')}
                          </Typography>
                        </Box>
                        <Chip
                          label={totem.status?.toUpperCase() || 'N/A'}
                          color={
                            totem.status === 'online' ? 'success' :
                            totem.status === 'pending_approval' ? 'warning' :
                            totem.status === 'offline' ? 'default' : 'error'
                          }
                          size="small"
                        />
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
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

export default SystemInfo;


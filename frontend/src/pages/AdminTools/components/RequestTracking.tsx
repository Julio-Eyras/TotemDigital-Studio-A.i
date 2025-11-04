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
  Chip,
  Divider,
} from '@mui/material';
import {
  Search,
  Refresh,
} from '@mui/icons-material';
import { debugApi } from '../../../services/api';

const RequestTracking: React.FC = () => {
  const [requestId, setRequestId] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRequest = async () => {
    if (!requestId.trim()) {
      setError('Por favor, insira um Request ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Buscar logs do backend via API
      const response = await debugApi.getPlayerRegistrationLogs({ limit: 200 });

      // Filtrar logs pelo Request ID
      const filteredLogs = (response.systemLogs || []).filter((log: string) =>
        log && log.includes(requestId)
      );

      // Também buscar nos totens registrados
      const matchingTotems = (response.totems || []).filter((totem: any) =>
        totem.uin?.includes(requestId) || 
        totem.identifier?.includes(requestId) ||
        JSON.stringify(totem).includes(requestId)
      );

      if (filteredLogs.length === 0 && matchingTotems.length === 0) {
        setError(`Nenhum log encontrado para o Request ID: ${requestId}. Nota: Os logs completos do sistema podem estar disponíveis apenas no servidor. Use o script de diagnóstico para buscar logs completos.`);
      } else {
        setResults({
          requestId,
          logs: filteredLogs,
          totems: matchingTotems,
          count: filteredLogs.length + matchingTotems.length
        });
      }
    } catch (e: any) {
      setError('Erro ao buscar logs: ' + (e.message || 'Erro desconhecido'));
      console.error('Erro ao buscar logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchRequest();
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Rastrear Requisição por Request ID
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Digite o Request ID (formato: REG-1234567890-abc123 ou PLAYER-1234567890-abc123)
            para rastrear uma requisição específica nos logs do sistema.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Request ID"
              variant="outlined"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="REG-1234567890-abc123"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
            <Button
              variant="contained"
              onClick={searchRequest}
              disabled={loading || !requestId.trim()}
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

      {results && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Resultados para: {results.requestId}
              </Typography>
              <Chip label={`${results.count} logs encontrados`} color="primary" />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {results.logs && results.logs.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Logs do Sistema ({results.logs.length})
                </Typography>
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
                  {results.logs.map((log: string, index: number) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: log.includes('❌') ? 'error.dark' : 
                                 log.includes('✅') ? 'success.dark' : 
                                 log.includes('⚠️') ? 'warning.dark' : 'grey.800',
                      }}
                    >
                      {log}
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}

            {results.totems && results.totems.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Totens Relacionados ({results.totems.length})
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  {results.totems.map((totem: any, index: number) => (
                    <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'white', borderRadius: 1 }}>
                      <Typography variant="body1" fontWeight="bold">
                        {totem.identifier || `Totem ${totem.id}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        UIN: {totem.uin}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Status: {totem.status} | IP: {totem.ipAddress} | Criado: {new Date(totem.createdAt).toLocaleString('pt-BR')}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={searchRequest}
              >
                Buscar Novamente
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  const text = [
                    ...(results.logs || []),
                    ...(results.totems || []).map((t: any) => JSON.stringify(t, null, 2))
                  ].join('\n');
                  navigator.clipboard.writeText(text);
                }}
              >
                Copiar Logs
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {!results && !loading && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Digite um Request ID acima para iniciar a busca
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RequestTracking;


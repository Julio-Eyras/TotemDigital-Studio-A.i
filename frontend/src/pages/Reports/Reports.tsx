import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Assessment,
  GetApp,
  CalendarToday,
  Refresh,
} from '@mui/icons-material';
import { reportApi, ReportType, ReportRequest } from '../../services/api';

const Reports: React.FC = () => {
  const theme = useTheme();
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [format, setFormat] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportRequest, setReportRequest] = useState<ReportRequest>({
    type: '',
    format: 'pdf',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadReportTypes();
  }, []);

  const loadReportTypes = async () => {
    try {
      setLoading(true);
      const types = await reportApi.getTypes();
      setReportTypes(types);
    } catch (error) {
      setError('Erro ao carregar tipos de relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const result = await reportApi.generate(reportRequest);
      
      // Simular download do relatório
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
      
      setGenerateDialogOpen(false);
      setReportRequest({
        type: '',
        format: 'pdf',
        startDate: '',
        endDate: '',
      });
    } catch (error) {
      setError('Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectType = (type: ReportType) => {
    setSelectedType(type.id);
    setReportRequest({
      ...reportRequest,
      type: type.id,
    });
    setGenerateDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando tipos de relatório...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Relatórios
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gere relatórios detalhados do sistema
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadReportTypes}
        >
          Atualizar
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Report Types Grid */}
      <Grid container spacing={3}>
        {reportTypes.map((type) => (
          <Grid item xs={12} sm={6} md={4} key={type.id}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
              onClick={() => handleSelectType(type)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assessment sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {type.name}
                    </Typography>
                    <Chip label={type.icon} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                  {type.description}
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Campos: {type.fields.join(', ')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Gerar Relatório</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Formato</InputLabel>
            <Select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as 'pdf' | 'xlsx' | 'csv');
                setReportRequest({ ...reportRequest, format: e.target.value as 'pdf' | 'xlsx' | 'csv' });
              }}
              label="Formato"
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Data de Início"
            type="date"
            value={reportRequest.startDate}
            onChange={(e) => setReportRequest({ ...reportRequest, startDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: <CalendarToday sx={{ mr: 1, color: theme.palette.text.secondary }} />,
            }}
          />
          <TextField
            fullWidth
            label="Data de Término"
            type="date"
            value={reportRequest.endDate}
            onChange={(e) => setReportRequest({ ...reportRequest, endDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: <CalendarToday sx={{ mr: 1, color: theme.palette.text.secondary }} />,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateReport}
            disabled={generating || !reportRequest.type}
            startIcon={generating ? <Refresh /> : <GetApp />}
          >
            {generating ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;

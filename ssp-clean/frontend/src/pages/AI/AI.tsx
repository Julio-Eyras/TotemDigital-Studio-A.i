import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Button, TextField, MenuItem, Select, FormControl, InputLabel, LinearProgress, Alert } from '@mui/material';
import { SmartToy, Refresh, PlayArrow } from '@mui/icons-material';
import { aiApi, AIModel, AIGenerateRequest } from '../../services/api';

const AI: React.FC = () => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama');
  const [model, setModel] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const resp = await aiApi.getModels();
      setModels(resp);
      // default provider first available
      if (resp.length > 0) {
        const first = resp[0];
        const providerValue = first.provider;
        if (providerValue === 'ollama' || providerValue === 'openai' || providerValue === 'anthropic') {
          setProvider(providerValue);
        } else {
          setProvider('ollama'); // padrão
        }
        if (first.models?.length) setModel(first.models[0]);
      }
    } catch (e) {
      setError('Erro ao carregar modelos de IA');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const req: AIGenerateRequest = { prompt, provider, model };
      const out = await aiApi.generate(req);
      setResult(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } catch (e) {
      setError('Falha ao gerar resposta');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando modelos de IA...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Inteligência Artificial
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Configuração
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Provider</InputLabel>
                <Select
                  label="Provider"
                  value={provider}
                  onChange={(e) => {
                    const p = e.target.value as 'ollama' | 'openai' | 'anthropic';
                    setProvider(p);
                    const found = models.find(m => m.provider === p);
                    setModel(found?.models?.[0] || '');
                  }}
                >
                  {models.map((m) => (
                    <MenuItem key={m.provider} value={m.provider}>{m.provider}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Modelo</InputLabel>
                <Select
                  label="Modelo"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {(models.find(m => m.provider === provider)?.models || []).map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button startIcon={<Refresh />} variant="outlined" onClick={loadModels} fullWidth sx={{ mt: 1 }}>
                Recarregar Modelos
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Playground
              </Typography>
              <TextField
                fullWidth
                label="Prompt"
                multiline
                minRows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button variant="contained" startIcon={<SmartToy />} onClick={handleGenerate} disabled={generating || !prompt}>
                  {generating ? 'Gerando...' : 'Gerar'}
                </Button>
                <Button variant="outlined" startIcon={<PlayArrow />} onClick={() => setPrompt('Explique o que é Smart Signage em 2 frases.')}>
                  Exemplo
                </Button>
              </Box>

              {!!result && (
                <Paper sx={{ p: 2, mt: 2, backgroundColor: '#fafafa', whiteSpace: 'pre-wrap' }}>
                  {result}
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AI;

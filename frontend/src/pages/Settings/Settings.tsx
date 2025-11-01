import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, TextField, Button, Alert } from '@mui/material';
import { Settings as SettingsIcon, Save, Refresh } from '@mui/icons-material';
import { settingsApi, SystemSetting } from '../../services/api';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const resp = await settingsApi.getAll();
      setSettings(resp);
    } catch (e) {
      setError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  };

  const handleSave = async () => {
    try {
      setError(null);
      await settingsApi.updateMultiple(settings.map(s => ({ key: s.key, value: s.value })));
    } catch (e) {
      setError('Erro ao salvar configurações');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Configurações do Sistema
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>Recarregar</Button>
        <Button startIcon={<Save />} variant="contained" onClick={handleSave}>Salvar Alterações</Button>
      </Box>

      <Grid container spacing={3}>
        {settings.map((s) => (
          <Grid item xs={12} md={6} key={s.key}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{s.key}</Typography>
                <TextField fullWidth label={s.description || s.key} value={String(s.value ?? '')} onChange={(e) => handleChange(s.key, e.target.value)} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Settings;

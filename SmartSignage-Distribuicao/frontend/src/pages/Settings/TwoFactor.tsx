/**
 * Two Factor Authentication Settings - Smart Signage v2.1
 * Página de configuração de autenticação de dois fatores
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Security,
  QrCode,
  CheckCircle,
  Cancel,
  Refresh,
  ContentCopy,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { twoFactorApi, TwoFactorSetup, TwoFactorStatus } from '../../services/api/twoFactorApi';
import { useNotification } from '../../hooks/useNotification';

const TwoFactor: React.FC = () => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const statusData = await twoFactorApi.getStatus();
      setStatus(statusData);
    } catch (error: any) {
      showError('Erro ao carregar status de 2FA');
      console.error('Erro ao carregar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setSetupLoading(true);
      const setupData = await twoFactorApi.setup();
      setSetup(setupData);
      setBackupCodesDialogOpen(true);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Erro ao iniciar setup de 2FA');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showError('Código deve ter 6 dígitos');
      return;
    }

    try {
      setSetupLoading(true);
      await twoFactorApi.enable(verificationCode);
      showSuccess('Autenticação de dois fatores habilitada com sucesso!');
      setSetup(null);
      setVerificationCode('');
      await loadStatus();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Código inválido');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Tem certeza que deseja desabilitar a autenticação de dois fatores? Isso reduzirá a segurança da sua conta.')) {
      return;
    }

    try {
      setSetupLoading(true);
      await twoFactorApi.disable();
      showSuccess('Autenticação de dois fatores desabilitada');
      await loadStatus();
    } catch (error: any) {
      showError('Erro ao desabilitar 2FA');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!window.confirm('Tem certeza? Os códigos de backup antigos não funcionarão mais.')) {
      return;
    }

    try {
      setRegeneratingCodes(true);
      const result = await twoFactorApi.regenerateBackupCodes();
      setSetup({ ...setup!, backupCodes: result.backupCodes });
      showSuccess('Códigos de backup regenerados com sucesso');
    } catch (error: any) {
      showError('Erro ao regenerar códigos de backup');
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copiado para a área de transferência');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Autenticação de Dois Fatores (2FA)
      </Typography>

      <Grid container spacing={3}>
        {/* Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 2, fontSize: 40 }} color={status?.enabled ? 'success' : 'disabled'} />
                <Box>
                  <Typography variant="h6">Status</Typography>
                  <Chip
                    label={status?.enabled ? 'Habilitado' : 'Desabilitado'}
                    color={status?.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>

              {status?.enabled && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Códigos de backup restantes: {status.backupCodesRemaining}
                  </Typography>
                  {status.lastUsedAt && (
                    <Typography variant="body2" color="text.secondary">
                      Último uso: {new Date(status.lastUsedAt).toLocaleString('pt-BR')}
                    </Typography>
                  )}
                </Box>
              )}

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                {!status?.enabled ? (
                  <Button
                    variant="contained"
                    startIcon={<QrCode />}
                    onClick={handleSetup}
                    disabled={setupLoading}
                  >
                    Configurar 2FA
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={handleDisable}
                    disabled={setupLoading}
                  >
                    Desabilitar 2FA
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Setup Card */}
        {setup && !status?.enabled && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Configurar 2FA
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  Escaneie o QR code com um aplicativo autenticador (Google Authenticator, Authy, etc.)
                </Alert>

                {/* QR Code */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <img
                    src={setup.qrCodeUrl}
                    alt="QR Code 2FA"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>

                {/* Código de verificação */}
                <TextField
                  fullWidth
                  label="Código de verificação (6 dígitos)"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  inputProps={{ maxLength: 6 }}
                  sx={{ mb: 2 }}
                  helperText="Digite o código de 6 dígitos do seu aplicativo autenticador"
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<CheckCircle />}
                  onClick={handleEnable}
                  disabled={setupLoading || verificationCode.length !== 6}
                >
                  Habilitar 2FA
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Backup Codes */}
        {status?.enabled && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Códigos de Backup</Typography>
                  <Button
                    size="small"
                    startIcon={<Refresh />}
                    onClick={handleRegenerateBackupCodes}
                    disabled={regeneratingCodes}
                  >
                    Regenerar
                  </Button>
                </Box>

                <Alert severity="warning" sx={{ mb: 2 }}>
                  Guarde estes códigos em local seguro. Eles podem ser usados para acessar sua conta se você perder acesso ao aplicativo autenticador.
                </Alert>

                {setup?.backupCodes && (
                  <List>
                    {setup.backupCodes.map((code, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>
                                {code}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => copyToClipboard(code)}
                            size="small"
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Dialog: Backup Codes */}
      <Dialog
        open={backupCodesDialogOpen}
        onClose={() => setBackupCodesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Códigos de Backup</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>IMPORTANTE:</strong> Guarde estes códigos em local seguro. Eles podem ser usados para acessar sua conta se você perder acesso ao aplicativo autenticador.
          </Alert>

          {setup?.backupCodes && (
            <List>
              {setup.backupCodes.map((code, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>
                        {code}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => copyToClipboard(code)}
                      size="small"
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupCodesDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TwoFactor;


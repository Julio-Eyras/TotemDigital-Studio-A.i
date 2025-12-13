import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  useTheme,
  alpha,
  LinearProgress,
  InputAdornment,
  IconButton,
  Divider,
  Link,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login,
  Business,
  Lock,
  Email,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { twoFactorApi } from '../../services/api/twoFactorApi';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const theme = useTheme();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await authApi.login({
        username: formData.username,
        password: formData.password,
      });

      // Verificar se 2FA é necessário
      if (response.data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setPendingUser(response.data.user);
        setError(null);
        return;
      }

      // Store token in localStorage
      localStorage.setItem('token', response.data.token || response.token);
      localStorage.setItem('user', JSON.stringify(response.data.user || response.user));
      
      onLoginSuccess(response.data.token || response.token, response.data.user || response.user);
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      // Tratar erros de validação do backend
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        
        // Se houver detalhes de validação, usar a primeira mensagem
        if (errorData?.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          setError(errorData.details[0].msg || errorData.details[0].message);
        } 
        // Se houver mensagem de erro direta
        else if (errorData?.message) {
          setError(errorData.message);
        }
        // Se houver erro genérico
        else if (errorData?.error) {
          setError(errorData.error);
        }
        // Fallback
        else {
          setError('Erro ao fazer login. Verifique suas credenciais.');
        }
      } 
      // Erro de autenticação (401)
      else if (error.response?.status === 401) {
        setError('Credenciais inválidas. Verifique seu usuário e senha.');
      }
      // Outros erros
      else {
        setError(error.response?.data?.error || error.response?.data?.message || 'Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Código deve ter 6 dígitos');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await twoFactorApi.verify(pendingUser.id, twoFactorCode);

      // Store token in localStorage
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      
      onLoginSuccess(result.token, result.user);
    } catch (error: any) {
      console.error('Erro ao verificar 2FA:', error);
      setError(error.response?.data?.error || 'Código inválido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        padding: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          boxShadow: theme.shadows[10],
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            textAlign: 'center',
            py: 4,
            px: 3,
          }}
        >
          <Business sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Smart Signage Pro
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Sistema de Sinalização Digital
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', mb: 3, textAlign: 'center' }}>
            Entrar no Sistema
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 2FA Form */}
          {requiresTwoFactor ? (
            <Box component="form" onSubmit={handleTwoFactorSubmit}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Autenticação de dois fatores necessária. Digite o código de 6 dígitos do seu aplicativo autenticador.
              </Alert>

              <TextField
                fullWidth
                label="Código 2FA"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                margin="normal"
                required
                disabled={loading}
                inputProps={{ maxLength: 6 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
                helperText="Digite o código de 6 dígitos do seu aplicativo autenticador"
              />

              {loading && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress />
                </Box>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || twoFactorCode.length !== 6}
                startIcon={<Login />}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                  },
                }}
              >
                Verificar Código
              </Button>

              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setTwoFactorCode('');
                  setPendingUser(null);
                }}
                sx={{ mt: 2 }}
              >
                Voltar
              </Button>
            </Box>
          ) : (
            <>
              {/* Login Form */}
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  name="username"
                  label="Nome de Usuário"
                  value={formData.username}
                  onChange={handleInputChange}
                  margin="normal"
                  required
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  name="password"
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  margin="normal"
                  required
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          disabled={loading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 3 }}
                />

                {/* Loading Indicator */}
                {loading && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
                      Fazendo login...
                    </Typography>
                  </Box>
                )}

                {/* Login Button */}
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={<Login />}
                  sx={{
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                    },
                  }}
                >
                  Entrar
                </Button>
              </Box>

              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Credenciais Padrão
                </Typography>
              </Divider>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Usuário:</strong> admin
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Senha:</strong> admin123
                </Typography>
              </Box>

              {/* Forgot Password Link */}
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => window.location.href = '/forgot-password'}
                  sx={{
                    cursor: 'pointer',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Esqueci minha senha
                </Link>
              </Box>
            </>
          )}

          {/* Footer */}
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Smart Signage Pro v2.0
            </Typography>
            <Typography variant="caption" color="text.secondary">
              © 2024 - Sistema de Sinalização Digital
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;

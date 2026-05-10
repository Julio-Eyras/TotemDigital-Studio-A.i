import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  useTheme,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Lock,
  ArrowBack,
  Visibility,
  VisibilityOff,
  CheckCircle,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Pegar token da URL se existir
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Token é obrigatório');
      return;
    }

    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await authApi.resetPassword({ token, password });

      if (response.success) {
        setSuccess(true);
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(response.message || 'Erro ao redefinir senha');
      }
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao redefinir senha. Token inválido ou expirado.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
            maxWidth: 450,
            width: '100%',
            boxShadow: theme.shadows[10],
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
              Senha Redefinida com Sucesso!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              Sua senha foi redefinida com sucesso. Você será redirecionado para a página de login em instantes.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
          maxWidth: 450,
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
            py: 3,
            px: 3,
          }}
        >
          <Lock sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Redefinir Senha
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
            Informe o token de recuperação e sua nova senha.
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Token de Recuperação"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              helperText="Token recebido por email ou fornecido pelo administrador"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Nova Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <Lock sx={{ mr: 1, color: 'action.active' }} />
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="Mínimo de 6 caracteres"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Confirmar Nova Senha"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <Lock sx={{ mr: 1, color: 'action.active' }} />
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            {/* Loading Indicator */}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                mb: 2,
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              Redefinir Senha
            </Button>
          </Box>

          {/* Back to Login */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/login')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <ArrowBack fontSize="small" />
              Voltar para o Login
            </Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ResetPassword;


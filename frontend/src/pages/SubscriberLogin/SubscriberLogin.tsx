import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Link,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon, Business } from '@mui/icons-material';
import { AppDispatch } from '../../store/store';
import { authApi } from '../../services/api/authApi';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const SubscriberLogin: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }

    // Clear API error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const validateForm = () => {
    const errors: typeof validationErrors = {};

    if (!formData.email) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    if (!formData.password) {
      errors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      errors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.subscriberLogin({
        email: formData.email,
        password: formData.password,
      });

      if (response.data.token && response.data.user) {
        // Salvar token e dados do usuário
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Redirecionar para dashboard de subscriber
        navigate('/subscriber/dashboard');
      } else {
        setError('Resposta inválida do servidor');
      }
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao fazer login. Verifique suas credenciais.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          padding: 4,
          width: '100%',
          maxWidth: 400,
          borderRadius: 3,
        }}
      >
        <Box sx={{ textAlign: 'center', marginBottom: 4 }}>
          <Box
            component="img"
            src="/logo-smart-signage.png"
            alt="Totem Digital"
            sx={{
              width: 72,
              height: 72,
              objectFit: 'contain',
              mb: 2,
              borderRadius: 1,
            }}
          />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Área do Anunciante
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
          >
            Faça login para acessar sua área
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ marginBottom: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email do Anunciante"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            error={!!validationErrors.email}
            helperText={validationErrors.email}
            margin="normal"
            autoComplete="email"
            autoFocus
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Business />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Senha"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleInputChange}
            error={!!validationErrors.password}
            helperText={validationErrors.password}
            margin="normal"
            autoComplete="current-password"
            disabled={isLoading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                    disabled={isLoading}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading}
            startIcon={
              isLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <LoginIcon />
              )
            }
            sx={{
              marginTop: 3,
              marginBottom: 2,
              paddingY: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              },
            }}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', marginTop: 3 }}>
          <Link
            href="/login"
            variant="body2"
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Acesso administrativo
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};

export default SubscriberLogin;


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
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Email,
  ArrowBack,
  Send,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { useNavigate } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Por favor, informe seu email');
      return;
    }

    if (!email.includes('@')) {
      setError('Por favor, informe um email válido');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setDevToken(null);
      
      const response = await authApi.forgotPassword(email);

      if (response.success) {
        setSuccess(true);
        // Em desenvolvimento, pode retornar o token
        if ((response as any).token) {
          setDevToken((response as any).token);
        }
      } else {
        setError(response.message || 'Erro ao solicitar recuperação de senha');
      }
    } catch (error: any) {
      console.error('Erro ao solicitar recuperação:', error);
      setError(pickApiErrorMessage(error, 'Erro ao solicitar recuperação de senha'));
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
          <Email sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Recuperar Senha
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          {!success ? (
            <>
              <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
                Informe seu email cadastrado. Enviaremos um link para redefinir sua senha.
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
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  margin="normal"
                  required
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <Email sx={{ mr: 1, color: 'action.active' }} />
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
                  startIcon={<Send />}
                  sx={{
                    py: 1.5,
                    mb: 2,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  Enviar Link de Recuperação
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                {process.env.NODE_ENV === 'development' && devToken
                  ? `Link de recuperação gerado! Em produção, você receberia um email. Token (dev): ${devToken}`
                  : 'Se o email estiver cadastrado, você receberá um link de recuperação em breve.'}
              </Alert>

              {process.env.NODE_ENV === 'development' && devToken && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    🔧 Modo Desenvolvimento:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Token gerado: <code style={{ fontSize: '0.8rem' }}>{devToken}</code>
                  </Typography>
                  <Typography variant="body2">
                    Use este token na página de redefinição de senha.
                  </Typography>
                </Box>
              )}

              <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </Typography>
            </>
          )}

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

export default ForgotPassword;


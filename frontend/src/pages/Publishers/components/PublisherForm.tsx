/**
 * PublisherForm Component
 * Formulário reutilizável para criar/editar publishers
 */

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Grid,
} from '@mui/material';
import {
  CreatePublisherRequest,
  UpdatePublisherRequest,
  Publisher,
} from '../../../services/api';

export interface PublisherFormProps {
  mode: 'create' | 'edit';
  publisher?: Publisher;
  data: CreatePublisherRequest | UpdatePublisherRequest;
  onChange: (data: CreatePublisherRequest | UpdatePublisherRequest) => void;
  errors?: { [key: string]: string };
}

// Funções de validação
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

const PublisherForm: React.FC<PublisherFormProps> = ({
  mode,
  publisher,
  data,
  onChange,
  errors = {},
}) => {
  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const getFieldValue = (field: string): any => {
    return (data as any)[field] || '';
  };

  const hasError = (field: string): boolean => {
    return !!errors[field];
  };

  const getHelperText = (field: string, defaultText?: string): string => {
    if (errors[field]) return errors[field];
    return defaultText || '';
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Dados do Publicador
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Nome da Empresa / Razão Social"
            value={getFieldValue('name')}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            margin="normal"
            required
            error={hasError('name')}
            helperText={getHelperText('name', 'Nome completo da empresa ou razão social')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Nome do Contato"
            value={getFieldValue('contact_name')}
            onChange={(e) => handleFieldChange('contact_name', e.target.value)}
            margin="normal"
            error={hasError('contact_name')}
            helperText={getHelperText('contact_name', 'Nome da pessoa responsável pelo contato')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Categoria/Segmento"
            value={getFieldValue('category_segment')}
            onChange={(e) => handleFieldChange('category_segment', e.target.value)}
            margin="normal"
            error={hasError('category_segment')}
            helperText={getHelperText('category_segment', 'Ex.: Farmácia, Cinema, Shopping, OOH...')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={getFieldValue('email')}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            margin="normal"
            error={
              hasError('email') ||
              (getFieldValue('email') && !validateEmail(getFieldValue('email')))
            }
            helperText={
              hasError('email')
                ? errors.email
                : getFieldValue('email') && !validateEmail(getFieldValue('email'))
                ? 'Email inválido. Use o formato: nome@empresa.com'
                : 'Email de contato (opcional)'
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Telefone"
            value={getFieldValue('phone')}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            margin="normal"
            error={
              hasError('phone') ||
              (getFieldValue('phone') && !validatePhone(getFieldValue('phone')))
            }
            helperText={
              hasError('phone')
                ? errors.phone
                : getFieldValue('phone') && !validatePhone(getFieldValue('phone'))
                ? 'Telefone inválido. Use apenas números, espaços, +, -, e parênteses'
                : 'Telefone comercial (formato: +55 11 1234-5678) - opcional'
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="WhatsApp"
            value={getFieldValue('whatsapp')}
            onChange={(e) => handleFieldChange('whatsapp', e.target.value)}
            margin="normal"
            error={
              hasError('whatsapp') ||
              (getFieldValue('whatsapp') && !validatePhone(getFieldValue('whatsapp')))
            }
            helperText={
              hasError('whatsapp')
                ? errors.whatsapp
                : getFieldValue('whatsapp') && !validatePhone(getFieldValue('whatsapp'))
                ? 'WhatsApp inválido. Use apenas números, espaços, +, -, e parênteses'
                : 'Número do WhatsApp (formato: +55 11 98765-4321) - opcional'
            }
          />
        </Grid>

        {mode === 'edit' && publisher && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={publisher.active ? 'active' : 'inactive'}
                label="Status"
                onChange={(e) =>
                  onChange({
                    ...data,
                    active: e.target.value === 'active',
                  } as UpdatePublisherRequest)
                }
                error={hasError('active')}
              >
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Descrição"
            value={getFieldValue('description')}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            margin="normal"
            multiline
            rows={3}
            error={hasError('description')}
            helperText={getHelperText('description')}
          />
        </Grid>
      </Grid>

      {mode === 'create' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Tipo: Publicador - Este publicador pode criar locais, totens e receber revenue share por
          exibir campanhas.
        </Alert>
      )}
    </Box>
  );
};

export default PublisherForm;

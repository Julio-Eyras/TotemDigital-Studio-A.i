/**
 * SubscriberForm Component
 * Formulário reutilizável para criar/editar subscribers
 */

import React, { useState, useEffect } from 'react';
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
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
  Subscriber,
  Contract,
  contractApi,
} from '../../../services/api';

export interface SubscriberFormProps {
  mode: 'create' | 'edit';
  subscriber?: Subscriber;
  data: CreateSubscriberRequest | UpdateSubscriberRequest;
  onChange: (data: CreateSubscriberRequest | UpdateSubscriberRequest) => void;
  errors?: { [key: string]: string };
  // parent active tab index from modal (so the form can reload contracts when parent switches tabs)
  activeParentTab?: number;
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

const SubscriberForm: React.FC<SubscriberFormProps> = ({
  mode,
  subscriber,
  data,
  onChange,
  errors = {},
}) => {
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  useEffect(() => {
    if (mode === 'create') {
      loadAvailableContracts();
    }
  }, [mode]);

  // When parent modal switches tabs, reload contracts if parent switched to Contracts tab (index 1)
  useEffect(() => {
    if (mode === 'create' && typeof (props as any).activeParentTab !== 'undefined') {
      if ((props as any).activeParentTab === 1) {
        loadAvailableContracts();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(props as any).activeParentTab]);

  const loadAvailableContracts = async () => {
    try {
      setLoadingContracts(true);
      // Solicitar contratos em rascunho (draft). NÃO combinar activeOnly=true com status='draft'
      const response = await contractApi.getAll({
        status: 'draft',
        limit: 1000,
      });
      const contractsWithoutSubscriber = response.data.filter(
        (c: Contract) => !c.subscriber_id || c.created_before_subscriber
      );
      setAvailableContracts(contractsWithoutSubscriber);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

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
        Dados do Assinante
      </Typography>

      {/* Campo de seleção de contrato - OPCIONAL (apenas no modo create) */}
      {mode === 'create' && (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel>Contrato (opcional)</InputLabel>
            <Select
              value={getFieldValue('contract_id') || ''}
              label="Contrato (opcional)"
              onChange={(e) =>
                handleFieldChange(
                  'contract_id',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              disabled={loadingContracts}
              error={hasError('contract_id')}
            >
              {loadingContracts ? (
                <MenuItem disabled>Carregando contratos...</MenuItem>
              ) : (
                <>
                  <MenuItem value="">Nenhum</MenuItem>
                  {availableContracts.map((contract) => (
                    <MenuItem key={contract.contract_id} value={contract.contract_id}>
                      {contract.contract_number} - {contract.title}{' '}
                      {contract.created_before_subscriber ? '(Pré-criado)' : ''}
                    </MenuItem>
                  ))}
                </>
              )}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              {getFieldValue('contract_id')
                ? `Contrato selecionado: ${availableContracts.find((c) => c.contract_id === getFieldValue('contract_id'))?.title || 'N/A'}`
                : 'Nenhum contrato selecionado. Você pode criar contratos na aba "Contratos" abaixo.'}
            </Typography>
          </FormControl>

          {availableContracts.length === 0 && !loadingContracts && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Nenhum contrato disponível no momento. Você pode criar contratos na aba "Contratos" abaixo.
            </Alert>
          )}
        </>
      )}

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
            helperText={getHelperText('category_segment', 'Ex.: Farmácia, Cinema, Shopping...')}
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

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Endereço"
            value={getFieldValue('address')}
            onChange={(e) => handleFieldChange('address', e.target.value)}
            margin="normal"
            error={hasError('address')}
            helperText={getHelperText('address')}
          />
        </Grid>

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

        {mode === 'edit' && subscriber && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={subscriber.is_active ? 'active' : 'inactive'}
                label="Status"
                onChange={(e) =>
                  onChange({
                    ...data,
                    isActive: e.target.value === 'active',
                  } as UpdateSubscriberRequest)
                }
                error={hasError('is_active')}
              >
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      {mode === 'create' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Tipo: Assinante - Este assinante pode criar mídias, playlists e campanhas vinculadas a
          contratos.
        </Alert>
      )}
    </Box>
  );
};

export default SubscriberForm;

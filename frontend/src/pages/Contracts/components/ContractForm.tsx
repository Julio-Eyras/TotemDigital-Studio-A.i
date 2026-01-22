/**
 * ContractForm Component
 * Formulário reutilizável para criar/editar contratos de assinantes
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
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { Business } from '@mui/icons-material';
import {
  CreateContractRequest,
  UpdateContractRequest,
  Contract,
  Subscriber,
  Plan,
  Publisher,
} from '../../../services/api';

export interface ContractFormProps {
  mode: 'create' | 'edit';
  contract?: Contract;
  data: CreateContractRequest | UpdateContractRequest;
  onChange: (data: CreateContractRequest | UpdateContractRequest) => void;
  errors?: { [key: string]: string };
  subscribers?: Subscriber[];
  plans?: Plan[];
  publishers?: Publisher[];
  selectedPublisherIds?: number[];
  onTogglePublisher?: (publisherId: number) => void;
  canViewSensitiveValues?: boolean;
  effectiveSubscriberId?: number;
  activeTab?: number;
  onTabChange?: (tab: number) => void;
}

// Função helper para converter data ISO para formato yyyy-MM-dd
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const ContractForm: React.FC<ContractFormProps> = ({
  mode,
  contract,
  data,
  onChange,
  errors = {},
  subscribers = [],
  plans = [],
  publishers = [],
  selectedPublisherIds = [],
  onTogglePublisher,
  canViewSensitiveValues = false,
  effectiveSubscriberId,
  activeTab = 0,
  onTabChange,
}) => {
  const theme = useTheme();

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

  const isCreateMode = mode === 'create';
  const createdBeforeSubscriber = (data as CreateContractRequest).created_before_subscriber || false;
  const hasSubscriber = !!(data as CreateContractRequest).subscriber_id;

  return (
    <Box>
      {isCreateMode && onTabChange && (
        <Tabs value={activeTab} onChange={(_, newValue) => onTabChange(newValue)} sx={{ mb: 3 }}>
          <Tab label="Informações" />
          <Tab
            label="Publicadores"
            disabled={!hasSubscriber}
            icon={selectedPublisherIds.length > 0 ? <Chip label={selectedPublisherIds.length} size="small" color="primary" /> : undefined}
            iconPosition="end"
          />
        </Tabs>
      )}

      {/* Aba Informações */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Dados do Contrato</Typography>

          {isCreateMode && (
            <>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox
                    checked={createdBeforeSubscriber}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      handleFieldChange('created_before_subscriber', checked);
                      if (checked) {
                        handleFieldChange('subscriber_id', undefined);
                        if (onTogglePublisher) {
                          // Limpar seleção de publishers
                          selectedPublisherIds.forEach((id) => onTogglePublisher(id));
                        }
                      }
                    }}
                  />
                }
                label="Criar contrato antes do anunciante (pré-contrato)"
              />

              {createdBeforeSubscriber && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Este contrato será criado sem Assinante. Você poderá vinculá-lo depois (quando o Anunciante existir).
                  Enquanto isso, a seleção de Publicadores ficará desabilitada.
                </Alert>
              )}
            </>
          )}

          {mode === 'edit' && contract && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Assinante: {contract.subscriber_name || 'N/A'}
            </Alert>
          )}

          <FormControl 
            fullWidth 
            margin="normal" 
            required={!createdBeforeSubscriber}
            disabled={!!createdBeforeSubscriber || !!effectiveSubscriberId}
          >
            <InputLabel>{createdBeforeSubscriber ? 'Assinante (opcional)' : 'Assinante *'}</InputLabel>
            <Select
              value={getFieldValue('subscriber_id') || ''}
              label={createdBeforeSubscriber ? 'Assinante (opcional)' : 'Assinante *'}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                handleFieldChange('subscriber_id', nextId);
                handleFieldChange('created_before_subscriber', !nextId);
                if (!nextId && onTogglePublisher) {
                  // Limpar seleção de publishers
                  selectedPublisherIds.forEach((id) => onTogglePublisher(id));
                }
              }}
            >
              <MenuItem value="">{createdBeforeSubscriber ? 'Nenhum (pré-contrato)' : 'Selecione...'}</MenuItem>
              {subscribers.map((subscriber) => {
                const subscriberId = subscriber.subscriber_id || (subscriber as any).subscriberId;
                return (
                  <MenuItem key={subscriberId} value={subscriberId}>
                    {subscriber.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Número do Contrato *"
            value={getFieldValue('contract_number')}
            onChange={(e) => handleFieldChange('contract_number', e.target.value)}
            margin="normal"
            required
            error={hasError('contract_number')}
            helperText={getHelperText('contract_number', 'Número único identificador do contrato')}
          />

          <TextField
            fullWidth
            label="Título *"
            value={getFieldValue('title')}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            margin="normal"
            required
            error={hasError('title')}
            helperText={getHelperText('title')}
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Tipo de Contrato *</InputLabel>
            <Select
              value={getFieldValue('contract_type')}
              label="Tipo de Contrato *"
              onChange={(e) => handleFieldChange('contract_type', e.target.value)}
            >
              <MenuItem value="advertising">Publicidade</MenuItem>
              <MenuItem value="subscription">Assinatura</MenuItem>
              <MenuItem value="partnership">Parceria</MenuItem>
              <MenuItem value="revenue_share">Revenue Share</MenuItem>
              <MenuItem value="hybrid">Híbrido</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Descrição"
            value={getFieldValue('description') || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            margin="normal"
            multiline
            rows={3}
            error={hasError('description')}
            helperText={getHelperText('description')}
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Plano</InputLabel>
                <Select
                  value={getFieldValue('plan_id') || ''}
                  label="Plano"
                  onChange={(e) => handleFieldChange('plan_id', e.target.value ? Number(e.target.value) : undefined)}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {plans.map((plan) => {
                    const planId = plan.planId || plan.plan_id || 0;
                    return (
                      <MenuItem key={planId} value={planId}>
                        {plan.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Início *"
                type="date"
                value={getFieldValue('start_date')}
                onChange={(e) => handleFieldChange('start_date', e.target.value)}
                margin="normal"
                required
                InputLabelProps={{ shrink: true }}
                error={hasError('start_date')}
                helperText={getHelperText('start_date')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Término"
                type="date"
                value={getFieldValue('end_date') || ''}
                onChange={(e) => handleFieldChange('end_date', e.target.value || undefined)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
                error={hasError('end_date')}
                helperText={getHelperText('end_date')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              {canViewSensitiveValues && (
                <TextField
                  fullWidth
                  label="Valor Total"
                  type="number"
                  value={getFieldValue('total_amount') || ''}
                  onChange={(e) => handleFieldChange('total_amount', e.target.value ? Number(e.target.value) : undefined)}
                  margin="normal"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>{getFieldValue('currency') || 'BRL'}</Typography>,
                  }}
                  error={hasError('total_amount')}
                  helperText={getHelperText('total_amount')}
                />
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={getFieldValue('status') || 'draft'}
                  label="Status"
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                >
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="expired">Expirado</MenuItem>
                  <MenuItem value="terminated">Terminado</MenuItem>
                  <MenuItem value="cancelled">Cancelado</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Moeda</InputLabel>
                <Select
                  value={getFieldValue('currency') || 'BRL'}
                  label="Moeda"
                  onChange={(e) => handleFieldChange('currency', e.target.value)}
                >
                  <MenuItem value="BRL">BRL (Real)</MenuItem>
                  <MenuItem value="USD">USD (Dólar)</MenuItem>
                  <MenuItem value="EUR">EUR (Euro)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              {canViewSensitiveValues && (
                <TextField
                  fullWidth
                  label="Condições de Pagamento"
                  value={getFieldValue('payment_terms') || ''}
                  onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
                  margin="normal"
                  multiline
                  rows={2}
                  error={hasError('payment_terms')}
                  helperText={getHelperText('payment_terms')}
                />
              )}
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Aba Publicadores */}
      {activeTab === 1 && onTogglePublisher && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Publicadores Associados {selectedPublisherIds.length > 0 && `(${selectedPublisherIds.length})`}
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Selecione os publicadores que este contrato dará acesso ao assinante. Os publicadores selecionados serão associados ao contrato através de acessos.
          </Alert>

          {publishers.length === 0 ? (
            <Alert severity="warning">
              Nenhum publicador encontrado. Cadastre publicadores primeiro.
            </Alert>
          ) : (
            <List>
              {publishers.map((publisher) => (
                <ListItem
                  key={publisher.publisher_id}
                  sx={{
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: selectedPublisherIds.includes(publisher.publisher_id)
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                  }}
                >
                  <Checkbox
                    checked={selectedPublisherIds.includes(publisher.publisher_id)}
                    onChange={() => onTogglePublisher(publisher.publisher_id)}
                  />
                  <ListItemIcon>
                    <Business />
                  </ListItemIcon>
                  <ListItemText
                    primary={publisher.name}
                    secondary={
                      <>
                        {publisher.email && (
                          <Box component="span" sx={{ display: 'block' }}>
                            {publisher.email}
                          </Box>
                        )}
                        <Chip
                          label={publisher.active ? 'Ativo' : 'Inativo'}
                          size="small"
                          color={publisher.active ? 'success' : 'default'}
                          sx={{ mt: 0.5 }}
                        />
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ContractForm;

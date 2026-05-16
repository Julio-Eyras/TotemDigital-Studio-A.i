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
  InputAdornment,
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
import {
  BILLING_INTERVAL_OPTIONS,
  billingIntervalLabel,
  getPlanDefaultBillingInterval,
  getPlanPriceForInterval,
  normalizeBillingInterval,
} from '../../../utils/billingIntervals';

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
  showCreateBeforeSubscriberCheckbox?: boolean;
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

const getDefaultContractEndDate = (): string => `${new Date().getFullYear()}-12-31`;

const parseCurrencyInputValue = (raw: string): number | undefined => {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(0, parsed);
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
  showCreateBeforeSubscriberCheckbox = true,
}) => {
  const theme = useTheme();

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const getFieldValue = (field: string): any => {
    if (field === 'status') {
      const formValue = (data as any).status;
      if (formValue !== undefined && formValue !== null && formValue !== '') {
        return String(formValue);
      }
      if (mode === 'edit' && contract) {
        const contractStatus = (contract as any).status;
        if (contractStatus !== undefined && contractStatus !== null && contractStatus !== '') {
          return String(contractStatus);
        }
      }
      return 'draft';
    }
    const formValue = (data as any)[field];
    // Em modo edit, se o campo não estiver no form mas estiver no contract, usar o contract
    if (mode === 'edit' && contract && (formValue === undefined || formValue === null || formValue === '')) {
      const contractValue = (contract as any)[field];
      if (contractValue !== undefined && contractValue !== null) {
        return contractValue;
      }
    }
    return formValue || '';
  };

  const hasError = (field: string): boolean => {
    return !!errors[field];
  };

  const getHelperText = (field: string, defaultText?: string): string => {
    if (errors[field]) return errors[field];
    return defaultText || '';
  };

  const isCreateMode = mode === 'create';
  const hasSubscriber = !!(data as CreateContractRequest).subscriber_id;

  const selectedPlan = plans.find((p) => (p.planId || p.plan_id) === getFieldValue('plan_id'));

  const applyPlanSelection = (planId?: number) => {
    const plan = plans.find((p) => (p.planId || p.plan_id) === planId);
    if (!planId || !plan) {
      onChange({ ...data, plan_id: planId });
      return;
    }
    const interval = normalizeBillingInterval(
      (data as any).billing_interval || getPlanDefaultBillingInterval(plan)
    );
    const ref = getPlanPriceForInterval(plan, interval);
    onChange({
      ...data,
      plan_id: planId,
      billing_interval: interval,
      payment_terms: billingIntervalLabel(interval),
      currency: plan.currency || (data as any).currency || 'BRL',
      ...(ref != null ? { total_amount: ref } : {}),
    });
  };

  const applyIntervalSelection = (interval: string) => {
    const code = normalizeBillingInterval(interval);
    const ref = selectedPlan ? getPlanPriceForInterval(selectedPlan, code) : undefined;
    onChange({
      ...data,
      billing_interval: code,
      payment_terms: billingIntervalLabel(code),
      ...(ref != null ? { total_amount: ref } : {}),
    });
  };

  return (
    <Box>
      {isCreateMode && onTabChange && (
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => onTabChange(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 3 }}
        >
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

          {/* Pré-contrato removido da UI */}

          {mode === 'edit' && contract && (
            <Alert 
              severity={contract.subscriber_id ? "info" : "warning"} 
              sx={{ mb: 2 }}
            >
              {contract.subscriber_id ? (
                <>
                  <strong>Assinante:</strong> {contract.subscriber_name || `ID ${contract.subscriber_id}`}
                  {contract.subscriber_id && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, display: 'inline-block' }}>
                      (Código: {contract.subscriber_id})
                    </Typography>
                  )}
                </>
              ) : (
                <>
                  <strong>⚠️ Contrato sem assinante vinculado</strong>
                  {(contract as any).publisher_id && (
                    <Typography component="div" variant="body2" sx={{ mt: 1 }}>
                      <strong>Publicador vinculado:</strong> {(contract as any).publisher_name || `ID ${(contract as any).publisher_id}`}
                      {(contract as any).publisher_id && (
                        <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                          (Código: {(contract as any).publisher_id})
                        </Typography>
                      )}
                    </Typography>
                  )}
                </>
              )}
            </Alert>
          )}

          <FormControl 
            fullWidth 
            margin="normal" 
            required={!effectiveSubscriberId}
            disabled={mode === 'edit' || !!effectiveSubscriberId}
          >
            <InputLabel>{effectiveSubscriberId ? 'Assinante (fixo)' : 'Assinante *'}</InputLabel>
              <Select
              value={getFieldValue('subscriber_id') || ''}
              label={effectiveSubscriberId ? 'Assinante (fixo)' : 'Assinante *'}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                handleFieldChange('subscriber_id', nextId);
                if (!nextId && onTogglePublisher) {
                  // Limpar seleção de publishers
                  selectedPublisherIds.forEach((id) => onTogglePublisher(id));
                }
              }}
            >
              <MenuItem value="">{effectiveSubscriberId ? 'Nenhum' : 'Selecione...'}</MenuItem>
              {subscribers.map((subscriber) => {
                const subscriberId = subscriber.subscriber_id || (subscriber as any).subscriberId;
                const currentSubscriberId = getFieldValue('subscriber_id');
                const isSelected = currentSubscriberId === subscriberId;
                return (
                  <MenuItem key={subscriberId} value={subscriberId}>
                    {subscriber.name}
                    {isSelected && ' ✓'}
                  </MenuItem>
                );
              })}
            </Select>
            {mode === 'edit' && contract?.subscriber_id && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75, display: 'block' }}>
                Assinante vinculado: {contract.subscriber_name || `ID ${contract.subscriber_id}`}
              </Typography>
            )}
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
              <MenuItem value="revenue_share">Participação na receita</MenuItem>
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
                  onChange={(e) =>
                    applyPlanSelection(e.target.value ? Number(e.target.value) : undefined)
                  }
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
                value={formatDateForInput(getFieldValue('start_date')) || ''}
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
                value={formatDateForInput(getFieldValue('end_date')) || getDefaultContractEndDate()}
                onChange={(e) => handleFieldChange('end_date', e.target.value || getDefaultContractEndDate())}
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
                  onChange={(e) => handleFieldChange('total_amount', parseCurrencyInputValue(e.target.value))}
                  margin="normal"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{getFieldValue('currency') || 'BRL'}</InputAdornment>
                    ),
                  }}
                  inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                  error={hasError('total_amount')}
                  helperText={getHelperText('total_amount')}
                />
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status (opcional)</InputLabel>
                <Select
                  value={getFieldValue('status')}
                  label="Status (opcional)"
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

            <Grid item xs={12} md={6}>
              {canViewSensitiveValues && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Intervalo de cobrança</InputLabel>
                  <Select
                    value={normalizeBillingInterval(
                      getFieldValue('billing_interval') || getFieldValue('payment_terms') || 'month'
                    )}
                    label="Intervalo de cobrança"
                    onChange={(e) => applyIntervalSelection(e.target.value)}
                  >
                    {BILLING_INTERVAL_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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

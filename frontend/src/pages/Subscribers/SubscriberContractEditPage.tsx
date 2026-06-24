import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import {
  contractApi,
  CreateContractRequest,
  planApi,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  billingIntervalLabel,
  contractEndDateHelperText,
  getMinContractEndDate,
  normalizeBillingInterval,
} from '../../utils/billingIntervals';
import { PlanTopologyTabPanel } from './PlanTopologyTabPanel';
import { countTopologyInRows, loadPlanTopologyPreviewRows, PlanTopologyPreviewRow } from './planTopologyPreview';
import {
  applyContractBillingInterval,
  applyContractEndDate,
  applyContractStartDate,
  applyPlanToContractForm,
  buildContractEndDateForStart,
  emptySubscriberContractForm,
  formatDateForAPI,
  formatDateForInput,
  generateSubscriberContractNumber,
  getContractIntervalOptions,
  getDefaultContractStartDate,
  getPlanIdFromOption,
  getPlanOptionLabel,
  getSelectedPlanValueHelper,
  validateSubscriberContractForm,
} from './subscriberContractUtils';

const SubscriberContractEditPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { subscriberId: subscriberIdParam, contractId: contractIdParam } = useParams<{
    subscriberId: string;
    contractId?: string;
  }>();

  const subscriberId = Number(subscriberIdParam);
  const contractId = contractIdParam ? Number(contractIdParam) : undefined;
  const isEditMode = contractId != null && Number.isFinite(contractId) && contractId > 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [form, setForm] = useState<CreateContractRequest>(emptySubscriberContractForm());
  const [topologySubTab, setTopologySubTab] = useState(0);
  const [planPreview, setPlanPreview] = useState<{
    loading: boolean;
    error: string | null;
    rows: PlanTopologyPreviewRow[];
  }>({ loading: false, error: null, rows: [] });

  const sxSelectChosenGreen = (hasSelection: boolean) =>
    hasSelection
      ? ({
          '& .MuiSelect-select': {
            color: theme.palette.success.main,
            fontWeight: 500,
          },
        } as const)
      : undefined;

  const pageTitle = useMemo(() => {
    if (isEditMode) return 'Editar Contrato do Anunciante';
    return 'Adicionar Contrato do Anunciante';
  }, [isEditMode]);

  const returnToSubscriberContracts = useCallback(
    (highlightContractId?: number) => {
      const params = new URLSearchParams({
        openEdit: String(subscriberId),
        tab: 'contracts',
      });
      if (highlightContractId != null && Number.isFinite(highlightContractId)) {
        params.set('contract', String(highlightContractId));
      }
      navigate(`/subscribers?${params.toString()}`, { replace: true });
    },
    [navigate, subscriberId]
  );

  /** Volta à aba Contratos do anunciante, mantendo o contrato em edição selecionado. */
  const goBackToContracts = useCallback(() => {
    returnToSubscriberContracts(isEditMode && contractId ? contractId : undefined);
  }, [returnToSubscriberContracts, isEditMode, contractId]);

  useEffect(() => {
    if (!Number.isFinite(subscriberId) || subscriberId <= 0) {
      setError('Anunciante inválido.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sub, plans, contractsResponse] = await Promise.all([
          subscriberApi.getById(subscriberId),
          planApi.getAll(false),
          subscriberApi.getContracts(subscriberId, { activeOnly: false }).catch(() => []),
        ]);

        if (cancelled) return;

        setSubscriber(sub);
        setAvailablePlans(plans ?? []);

        const contracts = Array.isArray(contractsResponse) ? contractsResponse : [];

        if (isEditMode && contractId) {
          const contract =
            contracts.find((c: any) => Number(c.contract_id) === contractId) ??
            (await contractApi.getById(contractId).catch(() => null));

          if (!contract) {
            setError('Contrato não encontrado.');
            return;
          }

          const contractPlan = (plans ?? []).find(
            (p: any) => getPlanIdFromOption(p) === Number(contract.plan_id)
          );

          const startYmd = formatDateForInput(contract.start_date) || getDefaultContractStartDate();
          const billingInterval = normalizeBillingInterval(
            contract.billing_interval || contract.payment_terms
          );

          let nextForm: CreateContractRequest = {
            contract_number: contract.contract_number,
            contract_type: contract.contract_type as CreateContractRequest['contract_type'],
            title: contract.title,
            description: contract.description || '',
            start_date: startYmd,
            end_date:
              formatDateForInput(contract.end_date) ||
              buildContractEndDateForStart(startYmd, billingInterval),
            currency: contract.currency || 'BRL',
            total_amount: contract.total_amount ?? undefined,
            billing_interval: billingInterval,
            payment_terms: contract.payment_terms || billingIntervalLabel(billingInterval),
            status: contract.status as CreateContractRequest['status'],
            plan_id: contract.plan_id || undefined,
          };

          if (contract.total_amount == null && contractPlan) {
            nextForm = applyPlanToContractForm(
              nextForm,
              getPlanIdFromOption(contractPlan),
              plans ?? [],
              billingInterval
            );
          }

          setForm(nextForm);
        } else {
          setForm({
            ...emptySubscriberContractForm(),
            contract_number: generateSubscriberContractNumber(subscriberId, contracts),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(pickApiErrorMessage(e, 'Erro ao carregar dados do contrato'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [subscriberId, contractId, isEditMode]);

  const previewSourceItem = useMemo(
    () => ({
      plan_id: form.plan_id,
      title: form.title || (isEditMode ? 'Contrato em edição' : 'Novo contrato'),
      contract_number: form.contract_number,
      contract_id: isEditMode ? contractId : undefined,
      tempId: isEditMode ? undefined : 'draft-new',
    }),
    [form.plan_id, form.contract_number, form.title, isEditMode, contractId]
  );

  const topologyReloadKey = useMemo(() => `plan:${form.plan_id ?? ''}`, [form.plan_id]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPlanPreview((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await loadPlanTopologyPreviewRows([previewSourceItem]);
        if (!cancelled) setPlanPreview({ loading: false, error: null, rows });
      } catch (e) {
        if (!cancelled) {
          setPlanPreview({
            loading: false,
            error: pickApiErrorMessage(e, 'Erro ao carregar rede do plano'),
            rows: [],
          });
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [topologyReloadKey, previewSourceItem]);

  const topologyCounts = useMemo(() => countTopologyInRows(planPreview.rows), [planPreview.rows]);

  const previewCaption = isEditMode
    ? 'Rede conforme o plano deste contrato (atualiza ao alterar o campo Plano no formulário).'
    : 'Rede conforme o plano selecionado no formulário do novo contrato.';

  const handleSave = async () => {
    if (!form.contract_number || !form.title) {
      setError('Número do contrato e título são obrigatórios');
      return;
    }

    const validationError = validateSubscriberContractForm(form, availablePlans);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditMode && contractId) {
        await contractApi.update(contractId, {
          ...form,
          start_date: formatDateForAPI(form.start_date),
          end_date: formatDateForAPI(
            form.end_date ||
              buildContractEndDateForStart(
                formatDateForInput(form.start_date) || getDefaultContractStartDate(),
                form.billing_interval
              )
          ),
        });
        returnToSubscriberContracts(contractId);
        return;
      }

      const created = await contractApi.create({
        ...form,
        start_date: formatDateForAPI(form.start_date) || '',
        end_date: formatDateForAPI(
          form.end_date ||
            buildContractEndDateForStart(
              formatDateForInput(form.start_date) || getDefaultContractStartDate(),
              form.billing_interval
            )
        ),
        subscriber_id: subscriberId,
        created_before_subscriber: false,
      });
      returnToSubscriberContracts(created?.contract_id);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar contrato'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, textAlign: 'center' }}>
        <CircularProgress sx={{ mt: 4 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {pageTitle}
          </Typography>
          {subscriber?.name && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Anunciante: {subscriber.name}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={goBackToContracts} size="small">
          Voltar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          p: 2,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Plano</InputLabel>
              <Select
                sx={sxSelectChosenGreen(!!form.plan_id)}
                value={form.plan_id || ''}
                label="Plano"
                onChange={(e) => {
                  const planId = e.target.value ? Number(e.target.value) : undefined;
                  setForm(applyPlanToContractForm(form, planId, availablePlans));
                }}
              >
                <MenuItem value="">Nenhum (contrato sem plano)</MenuItem>
                {availablePlans.map((p: any) => (
                  <MenuItem key={getPlanIdFromOption(p)} value={getPlanIdFromOption(p)}>
                    {getPlanOptionLabel(p)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Número do Contrato *"
              value={form.contract_number || ''}
              size="small"
              required
              InputProps={{ readOnly: true, disabled: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Tipo de Contrato *</InputLabel>
              <Select
                sx={sxSelectChosenGreen(true)}
                value={form.contract_type || 'advertising'}
                label="Tipo de Contrato *"
                onChange={(e) =>
                  setForm({ ...form, contract_type: e.target.value as CreateContractRequest['contract_type'] })
                }
              >
                <MenuItem value="advertising">Advertising</MenuItem>
                <MenuItem value="subscription">Subscription</MenuItem>
                <MenuItem value="partnership">Partnership</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Título *"
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              size="small"
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Descrição"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              size="small"
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Data de Início *"
              type="date"
              value={formatDateForInput(form.start_date) || ''}
              onChange={(e) => setForm(applyContractStartDate(form, e.target.value))}
              size="small"
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Data de Término"
              type="date"
              value={
                formatDateForInput(form.end_date) ||
                buildContractEndDateForStart(
                  formatDateForInput(form.start_date) || getDefaultContractStartDate(),
                  form.billing_interval
                )
              }
              onChange={(e) => setForm(applyContractEndDate(form, e.target.value))}
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: getMinContractEndDate(
                  formatDateForInput(form.start_date) || getDefaultContractStartDate(),
                  form.billing_interval || 'month'
                ),
              }}
              helperText={contractEndDateHelperText(
                formatDateForInput(form.start_date) || getDefaultContractStartDate(),
                form.billing_interval || 'month'
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Moeda"
              value={form.currency || 'BRL'}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Intervalo de cobrança</InputLabel>
              <Select
                sx={sxSelectChosenGreen(!!form.billing_interval)}
                value={normalizeBillingInterval(form.billing_interval || 'month')}
                label="Intervalo de cobrança"
                disabled={!form.plan_id}
                onChange={(e) =>
                  setForm(applyContractBillingInterval(form, availablePlans, e.target.value))
                }
              >
                {getContractIntervalOptions(form.plan_id, availablePlans).map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Valor acordado"
              type="number"
              value={form.total_amount ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  total_amount: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">{form.currency || 'BRL'}</InputAdornment>
                ),
              }}
              inputProps={{ min: 0, step: '0.01' }}
              helperText={getSelectedPlanValueHelper(
                form.plan_id,
                availablePlans,
                form.billing_interval
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                sx={sxSelectChosenGreen(true)}
                value={form.status || 'draft'}
                label="Status"
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as CreateContractRequest['status'] })
                }
              >
                <MenuItem value="draft">Rascunho</MenuItem>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="expired">Expirado</MenuItem>
                <MenuItem value="terminated">Terminado</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving || !form.contract_number || !form.title}
            >
              {isEditMode ? 'Atualizar Contrato' : 'Adicionar Contrato'}
            </Button>
            <Button variant="outlined" onClick={goBackToContracts} sx={{ ml: 1 }} disabled={saving}>
              Cancelar
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Box
        sx={{
          mt: 3,
          p: 2,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Rede permitida pelo plano (somente leitura)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} component="div">
          {previewCaption}
        </Typography>
        <Tabs
          value={topologySubTab}
          onChange={(_, v) => setTopologySubTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label="Locais"
            icon={topologyCounts.lc > 0 ? <Chip label={topologyCounts.lc} size="small" color="primary" /> : undefined}
            iconPosition="end"
          />
          <Tab
            label="Totens"
            icon={topologyCounts.tt > 0 ? <Chip label={topologyCounts.tt} size="small" color="primary" /> : undefined}
            iconPosition="end"
          />
          <Tab
            label="Smart TVs"
            icon={topologyCounts.st > 0 ? <Chip label={topologyCounts.st} size="small" color="primary" /> : undefined}
            iconPosition="end"
          />
        </Tabs>
        {topologySubTab === 0 && (
          <PlanTopologyTabPanel
            mode="locals"
            preview={planPreview}
            variant={isEditMode ? 'edit' : 'create'}
            contractCount={previewSourceItem?.plan_id ? 1 : 0}
            dense
          />
        )}
        {topologySubTab === 1 && (
          <PlanTopologyTabPanel
            mode="totens"
            preview={planPreview}
            variant={isEditMode ? 'edit' : 'create'}
            contractCount={previewSourceItem?.plan_id ? 1 : 0}
            dense
          />
        )}
        {topologySubTab === 2 && (
          <PlanTopologyTabPanel
            mode="smartTvs"
            preview={planPreview}
            variant={isEditMode ? 'edit' : 'create'}
            contractCount={previewSourceItem?.plan_id ? 1 : 0}
            dense
          />
        )}
      </Box>
    </Box>
  );
};

export default SubscriberContractEditPage;

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import {
  contractApi,
  Contract,
  publisherApi,
  Publisher,
  publisherContractApi,
  PublisherContract,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { billingIntervalLabel } from '../../utils/billingIntervals';
import {
  buildIssueInvoicesPayload,
  IssueInvoicesFormState,
  IssueInvoicesScope,
} from '../../utils/billingIssuePayload';
import { isStudioMode } from '../../config/studioMode';
import { getProductTerminology } from '../../config/productTerminology';

const EMPTY_FORM: IssueInvoicesFormState = {
  scope: 'all',
  subscriberId: '',
  contractId: '',
  publisherId: '',
  publisherContractId: '',
  dueInDays: '',
  includeRevenueSharePayouts: false,
};

export interface IssueInvoicesDialogProps {
  open: boolean;
  issuing: boolean;
  initialScope?: IssueInvoicesScope;
  defaultPublisherId?: string;
  lockPublisherId?: boolean;
  hidePublisherPicker?: boolean;
  onClose: () => void;
  onConfirm: (payload: ReturnType<typeof buildIssueInvoicesPayload>) => void | Promise<void>;
}

export function eligiblePublisherContracts(contracts: PublisherContract[]): PublisherContract[] {
  return contracts.filter((c) => {
    const type = c.contract_type;
    const amount = Number(c.subscription_amount ?? 0);
    return (type === 'subscription' || type === 'hybrid') && amount > 0;
  });
}

const IssueInvoicesDialog: React.FC<IssueInvoicesDialogProps> = ({
  open,
  issuing,
  initialScope = 'all',
  defaultPublisherId = '',
  lockPublisherId = false,
  hidePublisherPicker = false,
  onClose,
  onConfirm,
}) => {
  const [form, setForm] = useState<IssueInvoicesFormState>({ ...EMPTY_FORM, scope: initialScope });
  const [loading, setLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [subscriberContracts, setSubscriberContracts] = useState<Contract[]>([]);
  const [publisherContracts, setPublisherContracts] = useState<PublisherContract[]>([]);

  const showSubscriberFields = form.scope === 'all' || form.scope === 'subscriber';
  const showPublisherFields = form.scope === 'all' || form.scope === 'publisher';

  const loadBaseOptions = useCallback(async () => {
    setLoading(true);
    try {
      const subsRes = await subscriberApi.getAll({ limit: 500, active_only: true });
      setSubscribers(subsRes.data || []);
      if (!hidePublisherPicker) {
        const pubsRes = await publisherApi.getAll({ limit: 200, active_only: true });
        setPublishers(pubsRes.data || []);
      } else {
        setPublishers([]);
      }
    } catch {
      setSubscribers([]);
      setPublishers([]);
    } finally {
      setLoading(false);
    }
  }, [hidePublisherPicker]);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      scope: initialScope,
      publisherId: defaultPublisherId,
    });
    setSubscriberContracts([]);
    setPublisherContracts([]);
    void loadBaseOptions();
  }, [open, initialScope, defaultPublisherId, loadBaseOptions]);

  useEffect(() => {
    if (!open || !showSubscriberFields) return;
    const sid = parseInt(form.subscriberId, 10);
    if (!Number.isFinite(sid) || sid <= 0) {
      setSubscriberContracts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await contractApi.getAll({
          subscriberId: sid,
          activeOnly: true,
          status: 'active',
          limit: 200,
        });
        if (!cancelled) setSubscriberContracts(res.data || []);
      } catch {
        if (!cancelled) setSubscriberContracts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showSubscriberFields, form.subscriberId]);

  useEffect(() => {
    if (!open || !showPublisherFields) return;
    const pid = parseInt(form.publisherId, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      setPublisherContracts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await publisherContractApi.getAll({
          publisherId: pid,
          activeOnly: true,
          status: 'active',
          limit: 200,
        });
        if (!cancelled) {
          setPublisherContracts(eligiblePublisherContracts(res.data || []));
        }
      } catch {
        if (!cancelled) setPublisherContracts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showPublisherFields, form.publisherId]);

  const handleConfirm = () => {
    void onConfirm(buildIssueInvoicesPayload(form));
  };

  return (
    <Dialog open={open} onClose={() => !issuing && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Emitir faturas do período</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          Contratos ativos elegíveis: anunciantes com plano; organizações com assinatura (subscription/híbrido e valor
          &gt; 0). Deixe em &quot;Todos&quot; para emitir em lote no escopo.
        </Alert>
        <FormControl fullWidth margin="normal" disabled={issuing}>
          <InputLabel>Escopo</InputLabel>
          <Select
            label="Escopo"
            value={form.scope}
            onChange={(e) =>
              setForm({
                ...form,
                scope: e.target.value as IssueInvoicesScope,
                contractId: '',
                publisherContractId: '',
              })
            }
          >
            <MenuItem value="all">Todos (anunciantes + organizações)</MenuItem>
            <MenuItem value="subscriber">Só anunciantes</MenuItem>
            <MenuItem value="publisher">Só organizações</MenuItem>
          </Select>
        </FormControl>

        {showSubscriberFields && (
          <>
            <Autocomplete
              options={subscribers}
              getOptionLabel={(s) => `#${s.subscriber_id} — ${s.name || 'Sem nome'}`}
              value={subscribers.find((s) => String(s.subscriber_id) === form.subscriberId) ?? null}
              onChange={(_e, value) =>
                setForm({
                  ...form,
                  subscriberId: value ? String(value.subscriber_id) : '',
                  contractId: '',
                })
              }
              disabled={issuing || loading}
              renderInput={(params) => (
                <TextField {...params} label="Anunciante (opcional)" margin="normal" placeholder="Todos" />
              )}
              isOptionEqualToValue={(a, b) => a.subscriber_id === b.subscriber_id}
            />
            <FormControl
              fullWidth
              margin="normal"
              disabled={issuing || loading || !form.subscriberId}
            >
              <InputLabel>Contrato anunciante</InputLabel>
              <Select
                label="Contrato anunciante"
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
              >
                <MenuItem value="">
                  {form.subscriberId ? 'Todos os contratos deste anunciante' : 'Selecione um anunciante'}
                </MenuItem>
                {subscriberContracts.map((c) => (
                  <MenuItem key={c.contract_id} value={String(c.contract_id)}>
                    #{c.contract_id} — {c.contract_number} — {c.title}
                    {c.billing_interval
                      ? ` (${billingIntervalLabel(c.billing_interval)})`
                      : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}

        {showPublisherFields && (
          <>
            {hidePublisherPicker && defaultPublisherId ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                {getProductTerminology().billingPublisherLabel}: #{defaultPublisherId}
                {isStudioMode() ? ' (Smart Signage Studio)' : ''}
              </Alert>
            ) : (
              <Autocomplete
                options={publishers}
                getOptionLabel={(p) => `#${p.publisher_id} — ${p.name || 'Sem nome'}`}
                value={publishers.find((p) => String(p.publisher_id) === form.publisherId) ?? null}
                onChange={(_e, value) =>
                  setForm({
                    ...form,
                    publisherId: value ? String(value.publisher_id) : '',
                    publisherContractId: '',
                  })
                }
                disabled={issuing || loading || lockPublisherId}
                renderInput={(params) => (
                  <TextField {...params} label={`${getProductTerminology().billingPublisherLabel} (opcional)`} margin="normal" placeholder="Todos" />
                )}
                isOptionEqualToValue={(a, b) => a.publisher_id === b.publisher_id}
              />
            )}
            <FormControl
              fullWidth
              margin="normal"
              disabled={issuing || loading || !form.publisherId}
            >
              <InputLabel>Contrato da organização (assinatura)</InputLabel>
              <Select
                label="Contrato da organização (assinatura)"
                value={form.publisherContractId}
                onChange={(e) => setForm({ ...form, publisherContractId: e.target.value })}
              >
                <MenuItem value="">
                  {form.publisherId
                    ? 'Todos os contratos de assinatura desta organização'
                    : 'Selecione uma organização'}
                </MenuItem>
                {publisherContracts.map((c) => (
                  <MenuItem key={c.contract_id} value={String(c.contract_id)}>
                    #{c.contract_id} — {c.contract_number} — {c.title}
                    {c.subscription_amount != null
                      ? ` — ${Number(c.subscription_amount).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: c.currency || 'BRL',
                        })}`
                      : ''}
                  </MenuItem>
                ))}
              </Select>
              {form.publisherId && publisherContracts.length === 0 && !loading && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Nenhum contrato ativo de assinatura com valor para esta organização.
                </Alert>
              )}
            </FormControl>
          </>
        )}

        <TextField
          fullWidth
          margin="normal"
          label="Dias até vencimento (opcional)"
          value={form.dueInDays}
          onChange={(e) => setForm({ ...form, dueInDays: e.target.value })}
          disabled={issuing}
          inputProps={{ inputMode: 'numeric', min: 1, max: 90 }}
          helperText="Padrão do sistema se vazio (ex.: 30 dias)"
        />

        {(showPublisherFields || form.scope === 'all') && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={form.includeRevenueSharePayouts}
                onChange={(e) =>
                  setForm({ ...form, includeRevenueSharePayouts: e.target.checked })
                }
                disabled={issuing}
              />
            }
            label="Gerar repasses revenue share (campanhas pagas pelo anunciante)"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={issuing}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={issuing || loading} onClick={handleConfirm}>
          {issuing ? 'A emitir…' : 'Emitir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IssueInvoicesDialog;

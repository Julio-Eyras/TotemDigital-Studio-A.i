import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { QrCode2, Payment } from '@mui/icons-material';
import { financialAdminApi } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { formatRevenueSharePayoutMessage } from '../../utils/formatIssueInvoicesResult';

export interface FinancialPaymentSuccessInfo {
  message: string;
}

export type FinancialDialogMode = 'pay' | 'qr';
export type FinancialBillingScope = 'subscriber' | 'publisher';

interface Props {
  open: boolean;
  mode: FinancialDialogMode;
  billingScope?: FinancialBillingScope;
  billingId: number | null;
  amount?: number;
  onClose: () => void;
  onSuccess?: (info: FinancialPaymentSuccessInfo) => void;
}

const FinancialInvoiceDialog: React.FC<Props> = ({
  open,
  mode,
  billingScope = 'subscriber',
  billingId,
  amount,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<{
    copyPaste: string;
    qrDataUrl: string;
    pixConfigured: boolean;
    amount: number;
    currency: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== 'qr' || !billingId) {
      setQr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data =
          billingScope === 'publisher'
            ? await financialAdminApi.getPublisherPaymentQr(billingId)
            : await financialAdminApi.getPaymentQr(billingId);
        if (!cancelled) setQr(data);
      } catch (e: unknown) {
        if (!cancelled) setError(pickApiErrorMessage(e, 'Erro ao gerar QR PIX'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, billingId, billingScope]);

  const handleRecordPayment = async () => {
    if (!billingId) return;
    setLoading(true);
    setError(null);
    try {
      if (billingScope === 'publisher') {
        await financialAdminApi.recordPublisherPayment(billingId, {
          paymentMethod,
          paymentReference: paymentReference || undefined,
        });
        onSuccess?.({ message: 'Pagamento registado' });
      } else {
        const res = await financialAdminApi.recordPayment(billingId, {
          amount,
          paymentMethod,
          paymentReference: paymentReference || undefined,
          notes: notes || undefined,
        });
        const repasseMsg = formatRevenueSharePayoutMessage(res.revenueSharePayout);
        onSuccess?.({
          message: repasseMsg ? `Pagamento registado. ${repasseMsg}` : 'Pagamento registado',
        });
      }
      onClose();
    } catch (e: unknown) {
      setError(pickApiErrorMessage(e, 'Erro ao registar pagamento'));
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (qr?.copyPaste) navigator.clipboard.writeText(qr.copyPaste);
  };

  const scopeLabel = billingScope === 'publisher' ? 'exibidor' : 'anunciante';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === 'qr' ? `Pagamento PIX (${scopeLabel})` : `Registar pagamento (${scopeLabel})`}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {mode === 'pay' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Confirme o recebimento da fatura #{billingId}
              {amount != null
                ? ` — valor ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : ''}
              .
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Método</InputLabel>
              <Select label="Método" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <MenuItem value="pix">PIX</MenuItem>
                <MenuItem value="bank_transfer">Transferência</MenuItem>
                <MenuItem value="credit_card">Cartão</MenuItem>
                <MenuItem value="cash">Dinheiro</MenuItem>
                <MenuItem value="other">Outro</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Referência / comprovante"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              fullWidth
            />
            {billingScope === 'subscriber' && (
              <TextField
                label="Observações"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            )}
          </Box>
        )}

        {mode === 'qr' && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            {loading && <CircularProgress />}
            {!loading && qr && !qr.pixConfigured && (
              <Alert severity="warning">
                Chave PIX não configurada no servidor. Defina FINANCIAL_PIX_KEY no ambiente do backend.
              </Alert>
            )}
            {!loading && qr?.pixConfigured && (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Valor:{' '}
                  {qr.amount.toLocaleString('pt-BR', { style: 'currency', currency: qr.currency || 'BRL' })}
                </Typography>
                {qr.qrDataUrl && (
                  <Box
                    component="img"
                    src={qr.qrDataUrl}
                    alt="QR Code PIX"
                    sx={{ width: 260, height: 260, mx: 'auto', display: 'block', mb: 2 }}
                  />
                )}
                <Button startIcon={<QrCode2 />} variant="outlined" onClick={copyPix} fullWidth>
                  Copiar código PIX
                </Button>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        {mode === 'pay' && (
          <Button
            variant="contained"
            startIcon={<Payment />}
            onClick={handleRecordPayment}
            disabled={loading || !billingId}
          >
            Confirmar pagamento
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default FinancialInvoiceDialog;

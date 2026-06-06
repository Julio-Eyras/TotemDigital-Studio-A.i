import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
} from '@mui/material';
import { Warning, Error as ErrorIcon, CheckCircle, Schedule, AccountBalance } from '@mui/icons-material';
import { BillingControlDashboard } from '../../services/api';
import {
  contractEndAlertLevel,
  invoiceRowSx,
  DueAlertLevel,
} from '../../utils/billingDueStatus';
import { Link as RouterLink } from 'react-router-dom';
import type { BillingPanelScope } from '../../utils/billingPanelScope';

const levelColor = (level: DueAlertLevel): 'error' | 'warning' | 'success' | 'default' => {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warning';
  if (level === 'success') return 'success';
  return 'default';
};

interface Props {
  dashboard: BillingControlDashboard | null;
  loading: boolean;
  scope?: BillingPanelScope;
  publisherLabel?: string;
  onFilterInvoices?: (filter: 'overdue' | 'due_soon' | '') => void;
  onFilterPendingInvoices?: () => void;
  onFilterRevenueSharePayout?: () => void;
  onGenerateRevenueSharePayouts?: () => void;
  generatingRevenueShare?: boolean;
  showRevenueShareKpis?: boolean;
  contractsPath?: string;
  publisherContractsPath?: string;
  formatCurrency: (n: number) => string;
}

const KpiCard: React.FC<{
  title: string;
  count: number;
  amount?: number;
  color?: 'error' | 'warning' | 'success' | 'primary';
  icon: React.ReactNode;
  onClick?: () => void;
  formatCurrency?: (n: number) => string;
}> = ({ title, count, amount, color = 'primary', icon, onClick, formatCurrency }) => (
  <Card
    sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
    variant="outlined"
  >
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ color: `${color}.main` }}>{icon}</Box>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        {count}
      </Typography>
      {amount != null && formatCurrency && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {formatCurrency(amount)}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const BillingControlPanel: React.FC<Props> = ({
  dashboard,
  loading,
  scope = 'overview',
  publisherLabel = 'Organização',
  onFilterInvoices,
  onFilterPendingInvoices,
  onFilterRevenueSharePayout,
  onGenerateRevenueSharePayouts,
  generatingRevenueShare = false,
  showRevenueShareKpis = false,
  contractsPath = '/subscriber-contracts',
  publisherContractsPath = '/publisher-contracts',
  formatCurrency,
}) => {
  if (loading && !dashboard) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A carregar painel de controlo…
      </Typography>
    );
  }
  if (!dashboard) return null;

  const sub = dashboard.subscriberBilling;
  const pub = dashboard.publisherBilling;
  const dueDays = dashboard.dueSoonDays;

  const showSubscriberInvoices = scope === 'overview' || scope === 'subscriber-invoices';
  const showSubscriberContracts = scope === 'overview';
  const showPublisherInvoices = scope === 'overview' || scope === 'publisher-invoices';
  const showPublisherContracts = scope === 'overview' || scope === 'publisher-invoices';
  const showRevenueShare =
    (scope === 'overview' || scope === 'publisher-invoices') && showRevenueShareKpis;

  const panelTitle =
    scope === 'subscriber-invoices'
      ? 'Faturas de anunciantes'
      : scope === 'publisher-invoices'
        ? `Faturas da ${publisherLabel.toLowerCase()}`
        : 'Controlo de faturamento';

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {panelTitle}
      </Typography>

      {showSubscriberInvoices && (
        <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Faturas — anunciantes
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={3}>
          <KpiCard
            title="Pendentes"
            count={sub.pending}
            amount={sub.pendingAmount}
            icon={<Schedule />}
            onClick={onFilterPendingInvoices}
            formatCurrency={formatCurrency}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiCard
            title="Vencidas"
            count={sub.overdue}
            amount={sub.overdueAmount}
            color="error"
            icon={<ErrorIcon />}
            onClick={onFilterInvoices ? () => onFilterInvoices('overdue') : undefined}
            formatCurrency={formatCurrency}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiCard
            title={`A vencer (${dueDays}d)`}
            count={sub.dueSoon}
            amount={sub.dueSoonAmount}
            color="warning"
            icon={<Warning />}
            onClick={onFilterInvoices ? () => onFilterInvoices('due_soon') : undefined}
            formatCurrency={formatCurrency}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiCard
            title="Pagas"
            count={sub.paid}
            amount={sub.paidAmount}
            color="success"
            icon={<CheckCircle />}
            formatCurrency={formatCurrency}
          />
        </Grid>
      </Grid>
        </>
      )}

      {showRevenueShare && dashboard.revenueShare && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Repasse à organização (revenue share)
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard
                title="Repasse pendente"
                count={dashboard.revenueShare.pendingPayoutCount}
                amount={dashboard.revenueShare.pendingPayoutAmount}
                color="warning"
                icon={<AccountBalance />}
                onClick={onFilterRevenueSharePayout}
                formatCurrency={formatCurrency}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard
                title="Campanhas pagas sem repasse"
                count={dashboard.revenueShare.campaignsAwaitingPayout}
                color={dashboard.revenueShare.campaignsAwaitingPayout > 0 ? 'error' : 'primary'}
                icon={<Warning />}
                onClick={onFilterRevenueSharePayout}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard
                title="Total repasses (hist.)"
                count={dashboard.revenueShare.revenueShareTotalCount}
                icon={<AccountBalance />}
              />
            </Grid>
            {dashboard.revenueShare.campaignsAwaitingPayout > 0 && onGenerateRevenueSharePayouts && (
              <Grid item xs={12} sm={8} md={6}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={generatingRevenueShare}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateRevenueSharePayouts();
                  }}
                  sx={{ height: '100%', minHeight: 88 }}
                >
                  {generatingRevenueShare
                    ? 'A gerar repasses…'
                    : `Gerar repasses (${dashboard.revenueShare.campaignsAwaitingPayout} campanha(s))`}
                </Button>
              </Grid>
            )}
          </Grid>
        </>
      )}

      {showPublisherContracts && dashboard.publisherContracts && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Contratos da organização
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4}>
              <KpiCard title="Ativos" count={dashboard.publisherContracts.active} color="success" icon={<CheckCircle />} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <KpiCard
                title="Assinatura ativa"
                count={dashboard.publisherContracts.subscriptionActive}
                icon={<Schedule />}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <KpiCard
                title="A vencer"
                count={dashboard.publisherContracts.expiringSoon}
                color="warning"
                icon={<Warning />}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <Button
                component={RouterLink}
                to={publisherContractsPath}
                variant="outlined"
                size="small"
                fullWidth
                sx={{ height: '100%', minHeight: 88 }}
              >
                Contratos da organização
              </Button>
            </Grid>
          </Grid>
        </>
      )}

      {showPublisherInvoices && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Faturas — {publisherLabel}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard title="Pendentes" count={pub.pending} icon={<Schedule />} />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard title="Vencidas" count={pub.overdue} color="error" icon={<ErrorIcon />} />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard
                title={`A vencer (${dueDays}d)`}
                count={pub.dueSoon}
                color="warning"
                icon={<Warning />}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <KpiCard title="Pagas" count={pub.paid} color="success" icon={<CheckCircle />} />
            </Grid>
          </Grid>
        </>
      )}

      {showSubscriberContracts && (
        <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Contratos de anunciantes
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard title="Ativos" count={dashboard.contracts.active} color="success" icon={<CheckCircle />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            title="A vencer"
            count={dashboard.contracts.expiringSoon}
            color="warning"
            icon={<Warning />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard title="Vencidos" count={dashboard.contracts.expired} color="error" icon={<ErrorIcon />} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Button
            component={RouterLink}
            to={contractsPath}
            variant="outlined"
            size="small"
            fullWidth
            sx={{ height: '100%', minHeight: 88 }}
          >
            Ver todos os contratos
          </Button>
        </Grid>
      </Grid>
        </>
      )}

      {showSubscriberInvoices && sub.byType && sub.byType.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
            Consumo por tipo (anunciantes)
          </Typography>
          <Table size="small" sx={{ mb: 2, maxWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Qtd.</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sub.byType.slice(0, 8).map((row) => (
                <TableRow key={row.type}>
                  <TableCell>{row.type}</TableCell>
                  <TableCell align="right">{row.count}</TableCell>
                  <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {showSubscriberContracts &&
        (dashboard.contractsExpiringSoon.length > 0 || dashboard.contractsExpired.length > 0) && (
        <Grid container spacing={2}>
          {dashboard.contractsExpiringSoon.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Contratos a vencer
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Contrato</TableCell>
                    <TableCell>Anunciante</TableCell>
                    <TableCell>Fim</TableCell>
                    <TableCell align="right">Dias</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboard.contractsExpiringSoon.map((c) => {
                    const level = contractEndAlertLevel(c.end_date, 'active', dueDays);
                    return (
                      <TableRow key={c.contract_id} sx={invoiceRowSx(level)}>
                        <TableCell>{c.contract_number}</TableCell>
                        <TableCell>{c.subscriber_name || '—'}</TableCell>
                        <TableCell>{new Date(c.end_date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" color={levelColor(level)} label={c.days_until_end} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Grid>
          )}
          {dashboard.contractsExpired.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Contratos vencidos
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Contrato</TableCell>
                    <TableCell>Anunciante</TableCell>
                    <TableCell>Fim</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboard.contractsExpired.map((c) => (
                    <TableRow key={c.contract_id} sx={invoiceRowSx('error')}>
                      <TableCell>{c.contract_number}</TableCell>
                      <TableCell>{c.subscriber_name || '—'}</TableCell>
                      <TableCell>
                        {c.end_date ? new Date(c.end_date).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default BillingControlPanel;

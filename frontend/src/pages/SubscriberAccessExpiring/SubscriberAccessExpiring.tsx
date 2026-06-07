import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  Warning,
  Error,
  CheckCircle,
  Schedule,
  Refresh,
  Business,
} from '@mui/icons-material';
import { subscriberAccessApi } from '../../services/api';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { getProductTerminology, isSingleOrganizationProfile } from '../../config/productTerminology';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`subscriber-access-expiring-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

const SubscriberAccessExpiringPage: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [tabValue, setTabValue] = useState(0);
  const [expiringAccess, setExpiringAccess] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    expiringIn7Days: 0,
    expiringIn15Days: 0,
    expiringIn30Days: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysFilter, setDaysFilter] = useState<number>(30);

  useEffect(() => {
    loadExpiringAccess();
  }, [daysFilter]);

  const loadExpiringAccess = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriberAccessApi.getExpiringAccess(daysFilter);
      setExpiringAccess(response.data || []);
      setSummary(response.summary || summary);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar acessos expirando'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil;
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getExpirySeverity = (expiresAt?: string) => {
    if (!expiresAt) return 'default';
    const daysUntil = getDaysUntilExpiry(expiresAt);
    if (daysUntil === null) return 'default';
    if (daysUntil <= 0) return 'error';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 15) return 'warning';
    if (daysUntil <= 30) return 'info';
    return 'default';
  };

  const expiringIn7Days = expiringAccess.filter(a => {
    const days = getDaysUntilExpiry(a.expires_at);
    return days !== null && days <= 7 && days > 0;
  });

  const expiringIn15Days = expiringAccess.filter(a => {
    const days = getDaysUntilExpiry(a.expires_at);
    return days !== null && days <= 15 && days > 7;
  });

  const expiringIn30Days = expiringAccess.filter(a => {
    const days = getDaysUntilExpiry(a.expires_at);
    return days !== null && days <= 30 && days > 15;
  });

  const expired = expiringAccess.filter(a => isExpired(a.expires_at));
  const accessSections = [
    { icon: Error, label: `Expirando em 7 dias (${expiringIn7Days.length})` },
    { icon: Warning, label: `Expirando em 15 dias (${expiringIn15Days.length})` },
    { icon: Schedule, label: `Expirando em 30 dias (${expiringIn30Days.length})` },
    { icon: Error, label: `Expirados (${expired.length})` },
    { icon: Business, label: `Todos (${expiringAccess.length})` },
  ] as const;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Acessos Expirando
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Visualize e gerencie acessos subscriber → publisher próximos de expirar
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value as number)}
              label="Período"
            >
              <MenuItem value={7}>7 dias</MenuItem>
              <MenuItem value={15}>15 dias</MenuItem>
              <MenuItem value={30}>30 dias</MenuItem>
              <MenuItem value={60}>60 dias</MenuItem>
              <MenuItem value={90}>90 dias</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadExpiringAccess}
          >
            Atualizar
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                    {summary.expiringIn7Days}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expirando em 7 dias
                  </Typography>
                </Box>
                <Error sx={{ fontSize: 48, color: theme.palette.error.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                    {summary.expiringIn15Days}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expirando em 15 dias
                  </Typography>
                </Box>
                <Warning sx={{ fontSize: 48, color: theme.palette.warning.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                    {summary.expiringIn30Days}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expirando em 30 dias
                  </Typography>
                </Box>
                <Schedule sx={{ fontSize: 48, color: theme.palette.info.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {summary.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                </Box>
                <Business sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <ResponsiveSectionNav
          sections={accessSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="subscriber-access-expiring"
        />

        <CardContent>
          {loading ? (
            <LinearProgress />
          ) : (
            <>
              <TabPanel value={tabValue} index={0}>
                <AccessTable access={expiringIn7Days} getDaysUntilExpiry={getDaysUntilExpiry} getExpirySeverity={getExpirySeverity} formatDate={formatDate} />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <AccessTable access={expiringIn15Days} getDaysUntilExpiry={getDaysUntilExpiry} getExpirySeverity={getExpirySeverity} formatDate={formatDate} />
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                <AccessTable access={expiringIn30Days} getDaysUntilExpiry={getDaysUntilExpiry} getExpirySeverity={getExpirySeverity} formatDate={formatDate} />
              </TabPanel>
              <TabPanel value={tabValue} index={3}>
                <AccessTable access={expired} getDaysUntilExpiry={getDaysUntilExpiry} getExpirySeverity={getExpirySeverity} formatDate={formatDate} />
              </TabPanel>
              <TabPanel value={tabValue} index={4}>
                <AccessTable access={expiringAccess} getDaysUntilExpiry={getDaysUntilExpiry} getExpirySeverity={getExpirySeverity} formatDate={formatDate} />
              </TabPanel>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

interface AccessTableProps {
  access: any[];
  getDaysUntilExpiry: (expiresAt?: string) => number | null;
  getExpirySeverity: (expiresAt?: string) => 'default' | 'error' | 'warning' | 'info';
  formatDate: (dateString?: string) => string;
}

const AccessTable: React.FC<AccessTableProps> = ({ access, getDaysUntilExpiry, getExpirySeverity, formatDate }) => {
  const theme = useTheme();

  if (access.length === 0) {
    return (
      <Alert severity="info">
        Nenhum acesso encontrado nesta categoria.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><strong>Anunciante</strong></TableCell>
            <TableCell><strong>{isSingleOrganizationProfile() ? 'Escopo' : getProductTerminology().organization}</strong></TableCell>
            <TableCell><strong>Tipo de Acesso</strong></TableCell>
            <TableCell><strong>Contrato</strong></TableCell>
            <TableCell><strong>Plano</strong></TableCell>
            <TableCell><strong>Expira em</strong></TableCell>
            <TableCell><strong>Dias Restantes</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {access.map((item) => {
            const daysUntil = getDaysUntilExpiry(item.expires_at);
            const severity = getExpirySeverity(item.expires_at);
            return (
              <TableRow key={item.accessId || `${item.subscriberId}-${item.publisherId}`}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.subscriberName || `Anunciante ${item.subscriberId}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {item.subscriberId}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {isSingleOrganizationProfile()
                        ? 'Sua organização'
                        : (item.publisherName || `Organização ${item.publisherId}`)}
                    </Typography>
                    {!isSingleOrganizationProfile() && (
                      <Typography variant="caption" color="text.secondary">
                        ID: {item.publisherId}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.accessType || 'plan'}
                    size="small"
                    color={item.accessType === 'override' ? 'warning' : 'default'}
                  />
                </TableCell>
                <TableCell>{item.contractNumber ? `#${item.contractNumber}` : '-'}</TableCell>
                <TableCell>{item.planName || '-'}</TableCell>
                <TableCell>{formatDate(item.expires_at)}</TableCell>
                <TableCell>
                  {daysUntil !== null ? (
                    <Chip
                      label={daysUntil <= 0 ? 'Expirado' : `${daysUntil} dia(s)`}
                      size="small"
                      color={severity}
                      icon={daysUntil <= 0 ? <Error /> : daysUntil <= 7 ? <Warning /> : <Schedule />}
                    />
                  ) : (
                    <Chip label="Sem expiração" size="small" color="success" icon={<CheckCircle />} />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={daysUntil !== null && daysUntil <= 0 ? 'Expirado' : 'Ativo'}
                    size="small"
                    color={daysUntil !== null && daysUntil <= 0 ? 'error' : 'success'}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default SubscriberAccessExpiringPage;


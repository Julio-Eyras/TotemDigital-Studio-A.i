import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Insights as InsightsIcon,
  Dns as DnsIcon,
  Storage as StorageIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import RegistrationLogs from './components/RegistrationLogs';
import RequestTracking from './components/RequestTracking';
import TotemDetails from './components/TotemDetails';
import SystemInfo from './components/SystemInfo';
import CronSQL from './components/CronSQL';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`admin-tools-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

const ADMIN_TOOLS_SECTIONS = [
  { label: 'Logs de Registro', icon: DescriptionIcon },
  { label: 'Rastreamento de Requisições', icon: InsightsIcon },
  { label: 'Detalhes de Totem', icon: DnsIcon },
  { label: 'Informações do Sistema', icon: StorageIcon },
  { label: 'CronSQL', icon: TerminalIcon },
] as const;

const AdminTools: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [tabValue, setTabValue] = useState(0);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: { xs: 2.5, md: 4 }, fontSize: { xs: '1.4rem', md: undefined } }}>
        Admin Tools
      </Typography>

      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <ResponsiveSectionNav
          sections={ADMIN_TOOLS_SECTIONS}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="admin-tools"
        />
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <RegistrationLogs />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <RequestTracking />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <TotemDetails />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <SystemInfo />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <CronSQL />
      </TabPanel>
    </Container>
  );
};

export default AdminTools;


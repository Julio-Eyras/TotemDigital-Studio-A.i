import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Paper,
  Container,
} from '@mui/material';
import RegistrationLogs from './components/RegistrationLogs';
import RequestTracking from './components/RequestTracking';
import TotemDetails from './components/TotemDetails';
import SystemInfo from './components/SystemInfo';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminTools: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Admin Tools
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Logs de Registro" />
          <Tab label="Rastreamento de Requisições" />
          <Tab label="Detalhes de Totem" />
          <Tab label="Informações do Sistema" />
        </Tabs>
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
    </Container>
  );
};

export default AdminTools;


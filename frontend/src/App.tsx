import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { queryClient } from './config/queryClient';
import { store } from './store/store';
import Notification from './components/Notification/Notification';
import CommandPaletteWrapper from './components/Navigation/CommandPalette/CommandPaletteWrapper';
import { useRateLimit } from './hooks/useRateLimit';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useAppSelector } from './store/hooks';

// Pages
import LoginPage from './pages/Auth/LoginPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import SubscriberLogin from './pages/SubscriberLogin/SubscriberLogin';
import Layout from './components/Layout/Layout';
import PublisherLayout from './components/Layout/PublisherLayout';
import SubscriberLayout from './components/Layout/SubscriberLayout';

// Lazy-loaded pages (code splitting)
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Media = React.lazy(() => import('./pages/Media/Media'));
const Playlists = React.lazy(() => import('./pages/Playlists/Playlists'));
const Players = React.lazy(() => import('./pages/Players/Players'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Publishers = React.lazy(() => import('./pages/Publishers/Publishers'));
const Campaigns = React.lazy(() => import('./pages/Campaigns/Campaigns'));
const Reports = React.lazy(() => import('./pages/Reports/Reports'));
const Analytics = React.lazy(() => import('./pages/Analytics/Analytics'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));
const AI = React.lazy(() => import('./pages/AI/AI'));
const SmartPlaylist = React.lazy(() => import('./pages/SmartPlaylist/SmartPlaylist'));
const Totems = React.lazy(() => import('./pages/Totems/Totems'));
const TotemPlayList = React.lazy(() => import('./pages/TotemPlayList/TotemPlayList'));
const Billing = React.lazy(() => import('./pages/Billing/Billing'));
const QRCodes = React.lazy(() => import('./pages/QRCodes/QRCodes'));
const AdminTools = React.lazy(() => import('./pages/AdminTools/AdminTools'));
const DispatcherMonitor = React.lazy(() => import('./pages/DispatcherMonitor/DispatcherMonitor'));
const DispatcherManager = React.lazy(() => import('./pages/DispatcherManager/DispatcherManager'));
const DispatcherDebug = React.lazy(() => import('./pages/DispatcherDebug/DispatcherDebug'));
const PlaylistMix = React.lazy(() => import('./pages/PlaylistMix/PlaylistMix'));
const PlaylistMixRules = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixRules'));
const PlaylistMixGroup = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixGroup'));
const AIContextDashboard = React.lazy(() => import('./pages/AIContext/AIContextDashboard'));
const PlaylistMixAnalytics = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixAnalytics'));
const OTAUpdates = React.lazy(() => import('./components/OTAUpdates/OTAUpdates'));
const TagsManager = React.lazy(() => import('./components/TagsManager/TagsManager'));
const SmartDisplayFx = React.lazy(() => import('./pages/SmartDisplayFx/SmartDisplayFx'));
const SubscriberDashboard = React.lazy(() => import('./pages/SubscriberDashboard/SubscriberDashboard'));
const PlanPublisherAccess = React.lazy(() => import('./pages/PlanPublisherAccess/PlanPublisherAccess'));
const SubscriberPublisherAccess = React.lazy(() => import('./pages/SubscriberPublisherAccess/SubscriberPublisherAccess'));
const SubscriberAccessExpiring = React.lazy(() => import('./pages/SubscriberAccessExpiring/SubscriberAccessExpiring'));
const Locals = React.lazy(() => import('./pages/Locals/Locals'));
const SmartTvs = React.lazy(() => import('./pages/SmartTvs/SmartTvs'));
const Subscribers = React.lazy(() => import('./pages/Subscribers/Subscribers'));
const Contracts = React.lazy(() => import('./pages/Contracts/Contracts'));
const SubscriberContracts = React.lazy(() => import('./pages/SubscriberContracts/SubscriberContracts'));
const PublisherContracts = React.lazy(() => import('./pages/PublisherContracts/PublisherContracts'));

/**
 * Detecta o tipo de subdomínio da requisição
 */
const detectSubdomainType = (): 'publisher' | 'subscriber' | 'main' => {
  if (typeof window === 'undefined') return 'main';
  
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Se houver mais de 2 partes, o primeiro é o subdomínio
  if (parts.length > 2) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === 'publisher') return 'publisher';
    if (subdomain === 'subscriber') return 'subscriber';
  }
  
  return 'main';
};

const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subdomainType, setSubdomainType] = useState<'publisher' | 'subscriber' | 'main'>('main');
  
  // Hook para lidar com rate limiting
  useRateLimit();
  
  // Hook para Command Palette (deve estar dentro do Router)
  const commandPalette = useCommandPalette();

  useEffect(() => {
    // Detectar subdomínio
    const detected = detectSubdomainType();
    setSubdomainType(detected);
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      setIsAuthenticated(true);
    }
    
    setLoading(false);
  }, []);

  const handleLoginSuccess = (token: string, user: any) => {
    setIsAuthenticated(true);
  };

  /**
   * Seleciona o layout apropriado baseado no subdomínio e tipo de usuário
   */
  const getLayout = (children: React.ReactNode) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userType = user.user_type || user.userType;
    
    // Prioridade 1: Subdomínio (se configurado)
    if (subdomainType === 'publisher') {
      return <PublisherLayout>{children}</PublisherLayout>;
    }
    
    if (subdomainType === 'subscriber') {
      return <SubscriberLayout>{children}</SubscriberLayout>;
    }
    
    // Prioridade 2: user_type (quando não há subdomínio)
    if (userType === 'publisher_user') {
      return <PublisherLayout>{children}</PublisherLayout>;
    }
    
    if (userType === 'subscriber_user') {
      return <SubscriberLayout>{children}</SubscriberLayout>;
    }
    
    // Layout padrão para system_user ou quando user_type não está definido
    return <Layout>{children}</Layout>;
  };

  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (loading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          Carregando...
        </Box>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }

    // Validar acesso por subdomínio
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (subdomainType === 'publisher') {
      // Publisher subdomain: apenas publisher_user ou admins
      if (user.user_type !== 'publisher_user' && 
          user.role !== 'owner_system' && 
          user.role !== 'admin_sql' && 
          user.role !== 'admin' &&
          !user.publisherId) {
        return <Navigate to="/login" />;
      }
    }
    
    if (subdomainType === 'subscriber') {
      // Subscriber subdomain: apenas subscriber_user ou admins
      if (user.user_type !== 'subscriber_user' && 
          user.role !== 'owner_system' && 
          user.role !== 'admin_sql' && 
          user.role !== 'admin' &&
          !user.subscriberId) {
        return <Navigate to="/login" />;
      }
    }

    return getLayout(children);
  };

  const SubscriberProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (loading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          Carregando...
        </Box>
      );
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSubscriber = user.subscriberId || user.subscriber_id || user.user_type === 'subscriber_user';
    
    if (!isAuthenticated || !isSubscriber) {
      return <Navigate to="/subscriber-login" />;
    }
    
    // Usar SubscriberLayout se estiver no subdomínio subscriber, senão Layout padrão
    if (subdomainType === 'subscriber') {
      return <SubscriberLayout>{children}</SubscriberLayout>;
    }
    
    return <Layout>{children}</Layout>;
  };

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense
        fallback={
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '100vh',
            }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" />
              ) : (
                <ForgotPassword />
              )
            }
          />
          <Route
            path="/reset-password"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" />
              ) : (
                <ResetPassword />
              )
            }
          />
          <Route
            path="/subscriber-login"
            element={
              isAuthenticated ? (
                <Navigate to="/subscriber/dashboard" />
              ) : (
                <SubscriberLogin />
              )
            }
          />

          {/* Subscriber Routes */}
          <Route
            path="/subscriber/dashboard"
            element={
              <SubscriberProtectedRoute>
                <SubscriberDashboard />
              </SubscriberProtectedRoute>
            }
          />
          <Route
            path="/subscriber/media"
            element={
              <SubscriberProtectedRoute>
                <Media />
              </SubscriberProtectedRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media"
            element={
              <ProtectedRoute>
                <Media />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <Playlists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/players"
            element={
              <ProtectedRoute>
                <Players />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Navigate to="/subscribers" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publishers"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Publishers />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscribers"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Subscribers />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Contracts />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriber-contracts"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <SubscriberContracts />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/publisher-contracts"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <PublisherContracts />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/active"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Contracts />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/expired"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Contracts />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/locals"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <Locals />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/smart-tvs"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <SmartTvs />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Campaigns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan-publisher-access"
            element={
              <ProtectedRoute>
                <PlanPublisherAccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriber-publisher-access"
            element={
              <ProtectedRoute>
                <SubscriberPublisherAccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriber-access-expiring"
            element={
              <ProtectedRoute>
                <SubscriberAccessExpiring />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai"
            element={
              <ProtectedRoute>
                <AI />
              </ProtectedRoute>
            }
          />
          <Route
            path="/smart-playlist"
            element={
              <ProtectedRoute>
                <SmartPlaylist />
              </ProtectedRoute>
            }
          />
          <Route
            path="/totems"
            element={
              <ProtectedRoute>
                <Totems />
              </ProtectedRoute>
            }
          />
          <Route
            path="/totem-playlists"
            element={
              <ProtectedRoute>
                <TotemPlayList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlist-mix"
            element={
              <ProtectedRoute>
                <PlaylistMix />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlist-mix/groups"
            element={
              <ProtectedRoute>
                <PlaylistMixGroup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlist-mix/rules"
            element={
              <ProtectedRoute>
                <PlaylistMixRules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-context"
            element={
              <ProtectedRoute>
                <AIContextDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlist-mix/analytics"
            element={
              <ProtectedRoute>
                <PlaylistMixAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/qr-codes"
            element={
              <ProtectedRoute>
                <QRCodes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-tools"
            element={
              <ProtectedRoute>
                <AdminTools />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher-monitor"
            element={
              <ProtectedRoute>
                <DispatcherMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher-debug"
            element={
              <ProtectedRoute>
                <DispatcherDebug />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher-manager"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <DispatcherManager />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ota-updates"
            element={
              <ProtectedRoute>
                <OTAUpdates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ProtectedRoute>
                <TagsManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/smartdisplayfx"
            element={
              <ProtectedRoute>
                <SmartDisplayFx />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route
            path="/"
            element={<Navigate to="/dashboard" />}
          />
          
          {/* Catch all route */}
          <Route
            path="*"
            element={<Navigate to="/dashboard" />}
          />
        </Routes>
      </Suspense>
      <CommandPaletteWrapper
        open={commandPalette.open}
        onClose={commandPalette.closeDialog}
      />
    </Router>
  );
};

// Importar tema centralizado
import { createAppTheme } from './theme';

const ThemedApp: React.FC = () => {
  const themeMode = useAppSelector((state) => state.ui.theme);

  const theme = useMemo(
    () => createAppTheme(themeMode),
    [themeMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Notification />
      <AppContent />
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemedApp />
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
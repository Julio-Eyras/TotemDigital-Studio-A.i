import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { useAppDispatch, useAppSelector } from './store/hooks';
import { InstallationCapabilitiesProvider, useInstallationCapabilities } from './contexts/InstallationCapabilitiesContext';
import { canAccess } from './utils/rolePermissions';
import { setTheme, setDarkTone } from './store/slices/uiSlice';
import { isStudioMode } from './config/studioMode';
import { getAppHomePath, isDirectTotemMode } from './config/directTotemMode';
import { detectPortalFromHostname, persistPortalHost } from './utils/portalHost';

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
const QuickPublish = React.lazy(() => import('./pages/QuickPublish/QuickPublish'));
const MenuCatalog = React.lazy(() => import('./pages/MenuCatalog/MenuCatalog'));
const PublishBoardRedirect = React.lazy(() => import('./pages/QuickPublish/PublishBoardRedirect'));
const PublishTemplatesAdmin = React.lazy(() => import('./pages/PublishTemplatesAdmin/PublishTemplatesAdmin'));
const Vinhetas = React.lazy(() => import('./pages/Vinhetas/Vinhetas'));
const Playlists = React.lazy(() => import('./pages/Playlists/Playlists'));
const Players = React.lazy(() => import('./pages/Players/Players'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Publishers = React.lazy(() => import('./pages/Publishers/Publishers'));
const Campaigns = React.lazy(() => import('./pages/Campaigns/Campaigns'));
const Reports = React.lazy(() => import('./pages/Reports/Reports'));
const Analytics = React.lazy(() => import('./pages/Analytics/Analytics'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));
const SystemModules = React.lazy(() => import('./pages/Settings/SystemModules'));
const AI = React.lazy(() => import('./pages/AI/AI'));
const SmartPlaylist = React.lazy(() => import('./pages/SmartPlaylist/SmartPlaylist'));
const Totems = React.lazy(() => import('./pages/Totems/Totems'));
const PublishTotem = React.lazy(() => import('./pages/PublishTotem/PublishTotem'));
const TotemMediaPage = React.lazy(() => import('./pages/PublishTotem/TotemMediaPage'));
const TotemPlayList = React.lazy(() => import('./pages/TotemPlayList/TotemPlayList'));
const Billing = React.lazy(() => import('./pages/Billing/Billing'));
const QRCodes = React.lazy(() => import('./pages/QRCodes/QRCodes'));
const AdminTools = React.lazy(() => import('./pages/AdminTools/AdminTools'));
const DispatcherMonitor = React.lazy(() => import('./pages/DispatcherMonitor/DispatcherMonitor'));
const NetworkTopology = React.lazy(() => import('./pages/NetworkTopology/NetworkTopology'));
const DispatcherManager = React.lazy(() => import('./pages/DispatcherManager/DispatcherManager'));
const DispatcherDebug = React.lazy(() => import('./pages/DispatcherDebug/DispatcherDebug'));
const LabSystem = React.lazy(() => import('./pages/LabSystem/LabSystem'));
const PlaylistMix = React.lazy(() => import('./pages/PlaylistMix/PlaylistMix'));
const PlaylistMixRules = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixRules'));
const PlaylistMixGroup = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixGroup'));
const AIContextDashboard = React.lazy(() => import('./pages/AIContext/AIContextDashboard'));
const PlaylistMixAnalytics = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixAnalytics'));
const OTAUpdates = React.lazy(() => import('./components/OTAUpdates/OTAUpdates'));
const SmartDisplayFx = React.lazy(() => import('./pages/SmartDisplayFx/SmartDisplayFx'));
const SubscriberDashboard = React.lazy(() => import('./pages/SubscriberDashboard/SubscriberDashboard'));
const PlanPublisherAccess = React.lazy(() => import('./pages/PlanPublisherAccess/PlanPublisherAccess'));
const SubscriberPublisherAccess = React.lazy(() => import('./pages/SubscriberPublisherAccess/SubscriberPublisherAccess'));
const SubscriberAccessExpiring = React.lazy(() => import('./pages/SubscriberAccessExpiring/SubscriberAccessExpiring'));
const Locals = React.lazy(() => import('./pages/Locals/Locals'));
const SmartTvs = React.lazy(() => import('./pages/SmartTvs/SmartTvs'));
const Subscribers = React.lazy(() => import('./pages/Subscribers/Subscribers'));
const SubscriberContractEditPage = React.lazy(
  () => import('./pages/Subscribers/SubscriberContractEditPage')
);
const Contracts = React.lazy(() => import('./pages/Contracts/Contracts'));
const SubscriberContracts = React.lazy(() => import('./pages/SubscriberContracts/SubscriberContracts'));
const PublisherContracts = React.lazy(() => import('./pages/PublisherContracts/PublisherContracts'));

/**
 * Detecta o tipo de subdomínio da requisição (papel + tenant slug).
 * - publisher.dominio / subscriber.dominio
 * - {slug}.publisher.dominio / {slug}.subscriber.dominio
 * - {slug}.publisher.local / {slug}.subscriber.local
 */
const detectSubdomainType = (): 'publisher' | 'subscriber' | 'main' => {
  if (isStudioMode()) return 'main';
  if (typeof window === 'undefined') return 'main';
  return detectPortalFromHostname().subdomainType;
};

const SmartDisplayFxRoute: React.FC = () => {
  const caps = useInstallationCapabilities();
  if (!caps.smartDisplayFx) {
    return <Navigate to={getAppHomePath()} replace />;
  }
  return <SmartDisplayFx />;
};

const AppContent: React.FC = () => {
  const installationCaps = useInstallationCapabilities();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subdomainType, setSubdomainType] = useState<'publisher' | 'subscriber' | 'main'>('main');
  const [tenantSlug, setTenantSlug] = useState<string | undefined>(undefined);
  
  // Hook para lidar com rate limiting
  useRateLimit();
  
  // Hook para Command Palette (deve estar dentro do Router)
  const commandPalette = useCommandPalette();

  useEffect(() => {
    if (installationCaps.subdomainTenancy) {
      const portal = detectPortalFromHostname();
      setSubdomainType(portal.subdomainType);
      setTenantSlug(portal.tenantSlug);
      persistPortalHost(portal);
    } else {
      setSubdomainType('main');
      setTenantSlug(undefined);
    }
    
    // Token em páginas públicas (ex.: login) não implica sessão válida — evita redirect com JWT expirado
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const path = window.location.pathname;
    const onPublicAuthPage = ['/login', '/subscriber-login', '/forgot-password', '/reset-password'].some(
      (p) => path === p || path.startsWith(`${p}/`)
    );

    if (token && user && !onPublicAuthPage) {
      setIsAuthenticated(true);
    } else if (onPublicAuthPage) {
      setIsAuthenticated(false);
    }
    
    setLoading(false);
  }, [installationCaps.subdomainTenancy]);

  // Expor slug no document para CSS/debug e layouts
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (tenantSlug) {
      document.documentElement.setAttribute('data-portal-slug', tenantSlug);
      document.documentElement.setAttribute('data-portal-role', subdomainType);
    } else {
      document.documentElement.removeAttribute('data-portal-slug');
      document.documentElement.setAttribute('data-portal-role', subdomainType);
    }
  }, [tenantSlug, subdomainType]);

  const handleLoginSuccess = (_token: string, _user: any) => {
    setIsAuthenticated(true);
  };

  /**
   * Seleciona o layout apropriado baseado no subdomínio e tipo de usuário
   */
  const getLayout = (children: React.ReactNode) => {
    if (installationCaps.totemDigitalCompact) return <Layout>{children}</Layout>;

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
    const location = useLocation();

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
    const currentPath = location.pathname || '/';

    if (user?.role && !canAccess(user.role, currentPath, user.flags)) {
      if (currentPath === '/dashboard' || currentPath === '/publish-totem') {
        return <Navigate to="/login" replace />;
      }
      return <Navigate to={getAppHomePath()} replace />;
    }
    
    if (installationCaps.subdomainTenancy && subdomainType === 'publisher') {
      // Publisher subdomain: apenas publisher_user ou admins
      if (user.user_type !== 'publisher_user' && 
          user.role !== 'owner_system' && 
          user.role !== 'admin_sql' && 
          user.role !== 'admin' &&
          !user.publisherId) {
        return <Navigate to="/login" />;
      }
    }
    
    if (installationCaps.subdomainTenancy && subdomainType === 'subscriber') {
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
    if (!installationCaps.subscriberPortal) {
      return <Navigate to={getAppHomePath()} />;
    }

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

  // Um único Router para compact e Pro: evita rotas em falta (ex.: /locals) no modo compacto.
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
                <Navigate to={getAppHomePath()} />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? (
                <Navigate to={getAppHomePath()} />
              ) : (
                <ForgotPassword />
              )
            }
          />
          <Route
            path="/reset-password"
            element={
              isAuthenticated ? (
                <Navigate to={getAppHomePath()} />
              ) : (
                <ResetPassword />
              )
            }
          />
          <Route
            path="/subscriber-login"
            element={
              !installationCaps.subscriberPortal ? (
                <Navigate to="/login" />
              ) : isAuthenticated ? (
                <Navigate to="/subscriber/dashboard" />
              ) : (
                <SubscriberLogin />
              )
            }
          />

          {/* Subscriber Routes */}
          {installationCaps.subscriberPortal && (
            <>
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
            </>
          )}

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {isDirectTotemMode() ? <Navigate to="/publish-totem" replace /> : <Dashboard />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/publish-totem"
            element={
              <ProtectedRoute>
                <PublishTotem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publish-totem/:totemId"
            element={
              <ProtectedRoute>
                <TotemMediaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quick-publish"
            element={
              <ProtectedRoute>
                <QuickPublish />
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu-catalog"
            element={
              <ProtectedRoute>
                <MenuCatalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publish-board"
            element={
              <ProtectedRoute>
                <PublishBoardRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publish-templates-admin"
            element={
              <ProtectedRoute>
                <PublishTemplatesAdmin />
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
            path="/vinhetas"
            element={
              <ProtectedRoute>
                <Vinhetas />
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
            path="/subscribers/:subscriberId/contracts/new"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <SubscriberContractEditPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscribers/:subscriberId/contracts/:contractId/edit"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <SubscriberContractEditPage />
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
            path="/settings/system-modules"
            element={
              <ProtectedRoute>
                <SystemModules />
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
          <Route path="/plans" element={<Navigate to="/plan-publisher-access" replace />} />
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
            path="/network-topology"
            element={
              <ProtectedRoute>
                <Suspense fallback={<CircularProgress />}>
                  <NetworkTopology />
                </Suspense>
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
            path="/lab/system"
            element={
              <ProtectedRoute>
                <LabSystem />
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
            path="/ota-updates/history"
            element={
              <ProtectedRoute>
                <OTAUpdates />
              </ProtectedRoute>
            }
          />
          <Route path="/tags" element={<Navigate to={getAppHomePath()} replace />} />
          <Route
            path="/smartdisplayfx"
            element={
              <ProtectedRoute>
                <SmartDisplayFxRoute />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route
            path="/"
            element={<Navigate to={getAppHomePath()} />}
          />
          
          {/* Catch all route */}
          <Route
            path="*"
            element={<Navigate to={getAppHomePath()} />}
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
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.ui.theme);
  const darkTone = useAppSelector((state) => state.ui.darkTone);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        dispatch(setTheme(savedTheme));
      }
    } catch {
      // ignore
    }
    try {
      const savedTone = localStorage.getItem('darkTone');
      if (savedTone === 'carvao' || savedTone === 'grafite' || savedTone === 'suave') {
        dispatch(setDarkTone(savedTone));
      }
    } catch {
      // ignore
    }
  }, [dispatch]);

  const theme = useMemo(
    () => createAppTheme(themeMode, darkTone),
    [themeMode, darkTone]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Notification />
      <InstallationCapabilitiesProvider>
        <AppContent />
      </InstallationCapabilitiesProvider>
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
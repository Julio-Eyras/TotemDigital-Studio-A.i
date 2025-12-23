import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { queryClient } from './config/queryClient';
import { store } from './store/store';
import Notification from './components/Notification';
import { useRateLimit } from './hooks/useRateLimit';
import { useAppSelector } from './store/hooks';

// Pages
import LoginPage from './pages/Auth/LoginPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Layout from './components/Layout';

// Lazy-loaded pages (code splitting)
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Media = React.lazy(() => import('./pages/Media/Media'));
const Playlists = React.lazy(() => import('./pages/Playlists/Playlists'));
const Players = React.lazy(() => import('./pages/Players/Players'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Clients = React.lazy(() => import('./pages/Clients/Clients'));
const Campaigns = React.lazy(() => import('./pages/Campaigns/Campaigns'));
const Reports = React.lazy(() => import('./pages/Reports/Reports'));
const Analytics = React.lazy(() => import('./pages/Analytics/Analytics'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));
const AI = React.lazy(() => import('./pages/AI/AI'));
const SmartPlaylist = React.lazy(() => import('./pages/SmartPlaylist/SmartPlaylist'));
const Totems = React.lazy(() => import('./pages/Totems/Totems'));
const Billing = React.lazy(() => import('./pages/Billing/Billing'));
const QRCodes = React.lazy(() => import('./pages/QRCodes/QRCodes'));
const AdminTools = React.lazy(() => import('./pages/AdminTools/AdminTools'));
const PlaylistMix = React.lazy(() => import('./pages/PlaylistMix/PlaylistMix'));
const PlaylistMixRules = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixRules'));
const PlaylistMixGroup = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixGroup'));
const AIContextDashboard = React.lazy(() => import('./pages/AIContext/AIContextDashboard'));
const PlaylistMixAnalytics = React.lazy(() => import('./pages/PlaylistMix/PlaylistMixAnalytics'));
const OTAUpdates = React.lazy(() => import('./components/OTAUpdates/OTAUpdates'));
const TagsManager = React.lazy(() => import('./components/TagsManager/TagsManager'));
const SmartDisplayFx = React.lazy(() => import('./pages/SmartDisplayFx/SmartDisplayFx'));

const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Hook para lidar com rate limiting
  useRateLimit();

  useEffect(() => {
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

    return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
  };

  return (
    <Router>
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
                <Clients />
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
    </Router>
  );
};

const ThemedApp: React.FC = () => {
  const themeMode = useAppSelector((state) => state.ui.theme);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: '#1976d2',
            dark: '#1565c0',
            light: '#42a5f5',
          },
          secondary: {
            main: '#dc004e',
          },
          background: {
            default: themeMode === 'dark' ? '#121212' : '#f5f5f5',
          },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          h4: {
            fontWeight: 600,
          },
          h6: {
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                boxShadow: themeMode === 'dark'
                  ? '0 2px 8px rgba(0,0,0,0.7)'
                  : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  boxShadow: themeMode === 'dark'
                    ? '0 4px 16px rgba(0,0,0,0.9)'
                    : '0 4px 16px rgba(0,0,0,0.15)',
                },
              },
            },
          },
        },
      }),
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
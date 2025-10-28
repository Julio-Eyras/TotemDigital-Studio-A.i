import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, RootState } from './store/store';
import { checkAuthStatus } from './store/slices/authSlice';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login/Login';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Users } from './pages/Users/Users';
import { Clients } from './pages/Clients/Clients';
import { Players } from './pages/Players/Players';
import { Media } from './pages/Media/Media';
import { Playlists } from './pages/Playlists/Playlists';
import { Campaigns } from './pages/Campaigns/Campaigns';
import { QRCodes } from './pages/QRCodes/QRCodes';
import { Analytics } from './pages/Analytics/Analytics';
import { Billing } from './pages/Billing/Billing';
import { Settings } from './pages/Settings/Settings';
import { Reports } from './pages/Reports/Reports';
import { AI } from './pages/AI/AI';
import { SmartPlaylist } from './pages/SmartPlaylist/SmartPlaylist';
import { LoadingScreen } from './components/LoadingScreen/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Verificar status de autenticação ao carregar a aplicação
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // Mostrar tela de loading enquanto verifica autenticação
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        
        <Routes>
          {/* Rota de login */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } 
          />
          
          {/* Rotas protegidas */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/players" element={<Players />} />
                    <Route path="/media" element={<Media />} />
                    <Route path="/playlists" element={<Playlists />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/qrcodes" element={<QRCodes />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/ai" element={<AI />} />
                    <Route path="/smart-playlist" element={<SmartPlaylist />} />
                    
                    {/* Rota 404 */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Box>
    </ErrorBoundary>
  );
}

export default App;

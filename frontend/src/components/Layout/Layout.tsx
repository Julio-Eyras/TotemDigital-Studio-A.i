import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Badge,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  VideoLibrary,
  QueueMusic,
  People,
  Business,
  Computer,
  Logout,
  AccountCircle,
  Settings,
  Notifications,
  Campaign,
  Assessment,
  Analytics,
  LocationOn,
  SmartToy,
  QrCode,
  Payment,
  Tv,
  Build,
  CloudUpload,
  AutoAwesome,
  DarkMode,
  LightMode,
  Shuffle,
  Link,
  AdminPanelSettings,
  Warning,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../services/api';
import { filterMenuItemsByRole, UserRole } from '../../utils/rolePermissions';
import { getMenuHierarchyByRole, HierarchicalMenuItem } from '../../utils/menuHierarchy';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setDarkTone, setTheme } from '../../store/slices/uiSlice';
import { useSystemAlerts } from '../../services/api/queries';
import { useFlags } from '../../hooks/useFlags';
import NotificationCenter from '../Notification/NotificationCenter';
import { APP_DISPLAY_NAME, TOTEMDIGITAL_COMPACT } from '../../config/featureFlags';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  badge?: number;
}

interface OpenMenusState {
  [key: string]: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.ui.theme);
  const darkTone = useAppSelector((state) => state.ui.darkTone);
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [user, setUser] = useState<any>(null);
  const [alertsAnchorEl, setAlertsAnchorEl] = useState<null | HTMLElement>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);
  const [openMenus, setOpenMenus] = useState<OpenMenusState>({});
  const canReadAlerts = ['admin', 'admin_sql', 'owner_system'].includes(user?.role || '');
  const { data: alerts = [] } = useSystemAlerts(10, canReadAlerts);
  const { flags } = useFlags(); // Hook para acessar flags do usuário

  useEffect(() => {
    document.title = APP_DISPLAY_NAME;
  }, []);

  useEffect(() => {
    // Load user from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Erro ao parsear user do localStorage:', error);
      }
    }
  }, []);

  // Obter menu hierárquico baseado na role do usuário e filtrar por permissões
  const getMenuItems = (): HierarchicalMenuItem[] => {
    if (!user?.role) {
      // Fallback para menu padrão se não houver role
      return [
        { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
        { text: 'Mídia', icon: <VideoLibrary />, path: '/media' },
        { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
      ];
    }

    // Obter flags do user do localStorage ou do Redux (useFlags)
    // Priorizar flags do user do localStorage se disponível, senão usar do Redux
    const userFlags = user?.flags || flags;

    // Obter menu hierárquico filtrado por permissões (role + flags)
    const hierarchicalMenu = getMenuHierarchyByRole(
      user.role as UserRole,
      userFlags // Passar flags do usuário para filtragem
    );
    
    return hierarchicalMenu;
  };

  const menuItems = getMenuItems();
  const compactOwnerDisplayName = useMemo(() => {
    if (!TOTEMDIGITAL_COMPACT) return APP_DISPLAY_NAME;
    if (user?.role !== 'owner_system') return APP_DISPLAY_NAME;

    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    return user?.name || fullName || user?.username || APP_DISPLAY_NAME;
  }, [user]);

  const handleToggleMenu = (menuKey: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  /**
   * Renderiza item de menu hierárquico com suporte a submenus
   */
  const renderMenuItem = (item: HierarchicalMenuItem, level: number = 0) => {
    const isActive = location.pathname === item.path || 
                     location.pathname.startsWith(item.path + '/') ||
                     (item.children?.some(child => 
                       location.pathname === child.path || 
                       location.pathname.startsWith(child.path + '/')
                     ));
    const hasChildren = item.children && item.children.length > 0;
    const menuKey = item.text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const isOpen = openMenus[menuKey] || false;

    return (
      <React.Fragment key={`${item.path}-${level}`}>
        <ListItem disablePadding sx={{ mb: 0.5, pl: level * 2 }}>
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                handleToggleMenu(menuKey);
              } else {
                handleNavigation(item.path);
              }
            }}
            sx={{
              borderRadius: 2,
              backgroundColor: isActive ? theme.palette.primary.main : 'transparent',
              color: isActive ? 'white' : theme.palette.text.primary,
              '&:hover': {
                backgroundColor: isActive 
                  ? theme.palette.primary.dark 
                  : theme.palette.action.hover,
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <ListItemIcon
              sx={{
                color: isActive ? 'white' : theme.palette.text.secondary,
                minWidth: 40,
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.text}
              primaryTypographyProps={{
                fontWeight: isActive ? 'bold' : 'normal',
                fontSize: level > 0 ? '0.875rem' : '1rem',
              }}
            />
            {item.badge && (
              <Chip
                label={item.badge}
                size="small"
                color="error"
                sx={{ ml: 1 }}
              />
            )}
            {hasChildren && (isOpen ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map((child) => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Removido - usando NotificationCenter agora

  const handleThemeMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setThemeAnchorEl(event.currentTarget);
  };

  const handleThemeMenuClose = () => {
    setThemeAnchorEl(null);
  };

  const handleSetTheme = (nextMode: 'light' | 'dark', nextTone?: 'carvao' | 'grafite' | 'suave') => {
    dispatch(setTheme(nextMode));
    if (nextMode === 'dark' && nextTone) {
      dispatch(setDarkTone(nextTone));
      try {
        localStorage.setItem('darkTone', nextTone);
      } catch {
        // ignore storage errors
      }
    }
    try {
      localStorage.setItem('theme', nextMode);
    } catch {
      // ignore storage errors
    }
    handleThemeMenuClose();
  };

  const drawer = (
    <Box>
      {/* Logo Section */}
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Avatar
          sx={{
            width: 60,
            height: 60,
            mx: 'auto',
            mb: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }}
        >
          <Business sx={{ fontSize: 32 }} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
          {compactOwnerDisplayName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Sistema de Sinalização Digital
        </Typography>
      </Box>

      {/* Navigation Menu - Hierárquico */}
      <List sx={{ px: 2, py: 1 }}>
        {menuItems.map((item) => renderMenuItem(item))}
      </List>

      <Divider sx={{ mx: 2 }} />

      {/* User Info */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <Avatar sx={{ backgroundColor: theme.palette.secondary.main }}>
            <AccountCircle />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {user?.name || 'Usuário'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'user'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: theme.shadows[1],
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>

          {/* Notification Center */}
          <NotificationCenter />

          {/* Theme Toggle */}
          <IconButton
            color="inherit"
            onClick={handleThemeMenuOpen}
            sx={{ mr: 1 }}
            aria-label="Menu de tema"
          >
            {themeMode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>

          <Menu
            anchorEl={themeAnchorEl}
            open={Boolean(themeAnchorEl)}
            onClose={handleThemeMenuClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            keepMounted
          >
            <MenuItem onClick={() => handleSetTheme('light')}>
              <ListItemIcon>
                <LightMode fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={themeMode === 'light' ? 'Tema claro (selecionado)' : 'Tema claro'}
              />
            </MenuItem>

            <MenuItem onClick={() => handleSetTheme('dark', 'carvao')}>
              <ListItemIcon>
                <DarkMode fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  themeMode === 'dark' && darkTone === 'carvao'
                    ? 'Tema escuro: Carvão (selecionado)'
                    : 'Tema escuro: Carvão'
                }
              />
            </MenuItem>

            <MenuItem onClick={() => handleSetTheme('dark', 'grafite')}>
              <ListItemIcon>
                <DarkMode fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  themeMode === 'dark' && darkTone === 'grafite'
                    ? 'Tema escuro: Grafite (selecionado)'
                    : 'Tema escuro: Grafite'
                }
              />
            </MenuItem>

            <MenuItem onClick={() => handleSetTheme('dark', 'suave')}>
              <ListItemIcon>
                <DarkMode fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  themeMode === 'dark' && darkTone === 'suave'
                    ? 'Tema escuro: Suave (selecionado)'
                    : 'Tema escuro: Suave'
                }
              />
            </MenuItem>
          </Menu>

          {/* User Menu */}
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              <AccountCircle />
            </Avatar>
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              <ListItemText>Perfil</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              handleMenuClose();
              navigate('/settings');
            }}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              <ListItemText>Configurações</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sair</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Alerts Menu removido - usando NotificationCenter agora */}

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: theme.palette.background.paper,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: theme.palette.background.paper,
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

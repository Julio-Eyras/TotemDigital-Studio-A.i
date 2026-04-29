/**
 * Subscriber Layout
 * Layout específico para usuários de subscribers (subscriber.sistema.com)
 * Menu: Campanhas, Mídias, Playlists, Analytics, Faturamento
 */

import React, { useState, useEffect } from 'react';
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
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Campaign,
  VideoLibrary,
  QueueMusic,
  Analytics,
  Payment,
  Logout,
  AccountCircle,
  Settings,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setTheme } from '../../store/slices/uiSlice';
import { getMenuHierarchyByRole, HierarchicalMenuItem } from '../../utils/menuHierarchy';
import { UserRole } from '../../utils/rolePermissions';
import { useFlags } from '../../hooks/useFlags';

const drawerWidth = 280;

interface SubscriberLayoutProps {
  children: React.ReactNode;
}

interface OpenMenusState {
  [key: string]: boolean;
}

const SubscriberLayout: React.FC<SubscriberLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.ui.theme);
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [user, setUser] = useState<any>(null);
  const [openMenus, setOpenMenus] = useState<OpenMenusState>({});
  const { flags } = useFlags();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const menuItems: HierarchicalMenuItem[] = (() => {
    if (!user?.role) {
      return [
        { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
        { text: 'Minhas Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Minhas Mídias', icon: <VideoLibrary />, path: '/media' },
        { text: 'Minhas Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
        { text: 'Faturamento', icon: <Payment />, path: '/billing' },
        { text: 'Configurações', icon: <Settings />, path: '/settings' },
      ];
    }
    const userFlags = user?.flags || flags;
    return getMenuHierarchyByRole(user.role as UserRole, userFlags);
  })();

  const handleToggleMenu = (menuKey: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const renderMenuItem = (item: HierarchicalMenuItem, level: number = 0) => {
    const isActive =
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + '/') ||
      (item.children?.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/')));
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
              backgroundColor: isActive ? theme.palette.secondary.main : 'transparent',
              color: isActive ? 'white' : theme.palette.text.primary,
              '&:hover': {
                backgroundColor: isActive ? theme.palette.secondary.dark : theme.palette.action.hover,
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <ListItemIcon sx={{ color: isActive ? 'white' : theme.palette.text.secondary, minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{ fontWeight: isActive ? 'bold' : 'normal', fontSize: level > 0 ? '0.875rem' : '1rem' }}
            />
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

  const drawer = (
    <Box>
      {/* Logo Section */}
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box
          component="img"
          src="/logo-smart-signage.png"
          alt="Smart Signage"
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2,
            objectFit: 'cover',
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.secondary.main }}>
          Smart Signage Pro
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Subscriber Portal
        </Typography>
      </Box>

      {/* Navigation Menu */}
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
              {user?.name || 'Subscriber'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.subscriberId ? `Subscriber #${user.subscriberId}` : 'Subscriber User'}
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

export default SubscriberLayout;

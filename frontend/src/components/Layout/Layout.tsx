import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Business,
  Devices,
  VideoLibrary,
  PlaylistPlay,
  Campaign,
  QrCode,
  Analytics,
  Payment,
  Settings,
  Assessment,
  Psychology,
  SmartToy,
  AccountCircle,
  Logout,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store/store';
import { logout } from '../../store/slices/authSlice';
import { toggleSidebar, setTheme } from '../../store/slices/uiSlice';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

const menuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Usuários', icon: <People />, path: '/users' },
  { text: 'Clientes', icon: <Business />, path: '/clients' },
  { text: 'Totems', icon: <Devices />, path: '/totems' },
  { text: 'Mídia', icon: <VideoLibrary />, path: '/media' },
  { text: 'Playlists', icon: <PlaylistPlay />, path: '/playlists' },
  { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
  { text: 'QR Codes', icon: <QrCode />, path: '/qrcodes' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  { text: 'Faturamento', icon: <Payment />, path: '/billing' },
  { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
  { text: 'IA', icon: <Psychology />, path: '/ai' },
  { text: 'Smart Playlist', icon: <SmartToy />, path: '/smart-playlist' },
  { text: 'Configurações', icon: <Settings />, path: '/settings' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { sidebarOpen, theme: currentTheme } = useSelector((state: RootState) => state.ui);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    dispatch(toggleSidebar());
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleProfileMenuClose();
  };

  const handleThemeToggle = () => {
    dispatch(setTheme(currentTheme === 'light' ? 'dark' : 'light'));
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          Smart Signage v2.0
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${sidebarOpen ? drawerWidth : 0}px)` },
          ml: { md: sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Painel Administrativo
          </Typography>

          <IconButton
            color="inherit"
            onClick={handleThemeToggle}
            sx={{ mr: 1 }}
          >
            {currentTheme === 'light' ? <Brightness4 /> : <Brightness7 />}
          </IconButton>

          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.charAt(0).toUpperCase() || <AccountCircle />}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" color="text.secondary">
            {user?.name}
          </Typography>
        </MenuItem>
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sair</ListItemText>
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { md: sidebarOpen ? drawerWidth : 0 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={sidebarOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${sidebarOpen ? drawerWidth : 0}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

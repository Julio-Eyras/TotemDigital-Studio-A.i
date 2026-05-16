/**
 * CommandPalette Component - SmartSignage Pro v2.1
 * Busca global e ações rápidas (Command Palette)
 * Atalho: Ctrl+K ou Cmd+K
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  Search,
  Dashboard,
  People,
  Business,
  Campaign,
  VideoLibrary,
  QueueMusic,
  Computer,
  Settings,
  ArrowForward,
  LocationOn,
  Add,
  Payment,
  MonitorHeart,
  Shuffle,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { DASHBOARD_COMMERCIAL_FOCUS, TOTEMDIGITAL_COMPACT } from '../../../config/featureFlags';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  type: 'page' | 'action' | 'totem' | 'subscriber' | 'publisher' | 'campaign' | 'media' | 'playlist';
  path?: string;
  action?: () => void;
  keywords?: string[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items?: CommandItem[];
}

const defaultItems: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral do sistema',
    icon: <Dashboard />,
    type: 'page',
    path: '/dashboard',
    keywords: ['dashboard', 'home', 'inicio', 'visao geral'],
  },
  {
    id: 'subscribers',
    label: 'Anunciantes',
    description: 'Gerenciar anunciantes',
    icon: <People />,
    type: 'page',
    path: '/subscribers',
    keywords: ['anunciantes', 'subscribers', 'assinantes', 'clientes'],
  },
  {
    id: 'publishers',
    label: 'Publishers',
    description: 'Gerenciar publishers',
    icon: <Business />,
    type: 'page',
    path: '/publishers',
    keywords: ['publishers', 'publicadores'],
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    description: 'Gerenciar campanhas',
    icon: <Campaign />,
    type: 'page',
    path: '/campaigns',
    keywords: ['campaigns', 'campanhas'],
  },
  {
    id: 'media',
    label: 'Mídias',
    description: 'Gerenciar mídias',
    icon: <VideoLibrary />,
    type: 'page',
    path: '/media',
    keywords: ['media', 'midias', 'arquivos'],
  },
  {
    id: 'playlists',
    label: 'Playlists',
    description: 'Gerenciar playlists',
    icon: <QueueMusic />,
    type: 'page',
    path: '/playlists',
    keywords: ['playlists', 'listas'],
  },
  {
    id: 'totems',
    label: 'Totens',
    description: 'Gerenciar totens',
    icon: <Computer />,
    type: 'page',
    path: '/totems',
    keywords: ['totems', 'players', 'dispositivos'],
  },
  {
    id: 'billing',
    label: 'Faturamento e Cobrança',
    description: 'Visão geral, planos e faturas',
    icon: <Payment />,
    type: 'page',
    path: '/billing?view=plans',
    keywords: ['faturamento', 'cobranca', 'billing', 'financeiro'],
  },
  {
    id: 'billing-subscribers',
    label: 'Faturamento — Anunciantes',
    description: 'Faturas de anunciantes',
    icon: <Payment />,
    type: 'page',
    path: '/billing?type=subscriber&view=invoices',
    keywords: ['anunciantes', 'subscriber', 'faturas'],
  },
  {
    id: 'billing-publishers',
    label: 'Faturamento — Exibidores',
    description: 'Faturas de publicadores',
    icon: <Payment />,
    type: 'page',
    path: '/billing?type=publisher&view=invoices',
    keywords: ['publicadores', 'publisher', 'exibidor', 'faturas'],
  },
  {
    id: 'dispatcher',
    label: 'Dispatcher — Gerenciar',
    description: 'Campanhas e playlists elegíveis',
    icon: <MonitorHeart />,
    type: 'page',
    path: '/dispatcher-manager',
    keywords: ['dispatcher', 'gerenciar'],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Configurações do sistema',
    icon: <Settings />,
    type: 'page',
    path: '/settings',
    keywords: ['settings', 'configuracoes', 'config'],
  },
];

/** Alinhado ao menu compacto em menuHierarchy (TotemDigital monousuário). */
const compactCommandItems: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão comercial e telas',
    icon: <Dashboard />,
    type: 'page',
    path: '/dashboard',
    keywords: ['dashboard', 'home', 'inicio', 'visao geral'],
  },
  {
    id: 'plans',
    label: 'Planos',
    description: 'Planos e vínculo a locais',
    icon: <Business />,
    type: 'page',
    path: '/plan-publisher-access',
    keywords: ['planos', 'plans', 'acesso', 'publishers'],
  },
  {
    id: 'locals',
    label: 'Locais',
    description: 'Locais de instalação',
    icon: <LocationOn />,
    type: 'page',
    path: '/locals',
    keywords: ['locais', 'locals', 'lojas'],
  },
  {
    id: 'totems',
    label: 'Totens',
    description: 'Telas e ativação',
    icon: <Computer />,
    type: 'page',
    path: '/totems',
    keywords: ['totems', 'totens', 'dispositivos', 'telas'],
  },
  {
    id: 'quick-publish',
    label: 'Nova publicação',
    description: 'Publicar conteúdo na tela em poucos passos',
    icon: <Add />,
    type: 'page',
    path: '/quick-publish',
    keywords: ['publicar', 'publicacao', 'quick', 'nova'],
  },
  {
    id: 'subscribers',
    label: 'Anunciantes',
    description: 'Clientes e contas',
    icon: <People />,
    type: 'page',
    path: '/subscribers',
    keywords: ['assinantes', 'subscribers', 'anunciantes', 'clientes'],
  },
  {
    id: 'media',
    label: 'Mídias',
    description: 'Biblioteca de arquivos',
    icon: <VideoLibrary />,
    type: 'page',
    path: '/media',
    keywords: ['media', 'midias', 'arquivos'],
  },
  {
    id: 'playlists',
    label: 'Playlists',
    description: 'Listas de reprodução',
    icon: <QueueMusic />,
    type: 'page',
    path: '/playlists',
    keywords: ['playlists', 'listas'],
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    description: 'Campanhas e veiculação',
    icon: <Campaign />,
    type: 'page',
    path: '/campaigns',
    keywords: ['campaigns', 'campanhas'],
  },
  {
    id: 'billing',
    label: 'Faturamento e Cobrança',
    description: 'Visão geral, faturas e cobrança',
    icon: <Payment />,
    type: 'page',
    path: '/billing?view=plans',
    keywords: ['faturamento', 'cobranca', 'billing', 'faturas', 'financeiro'],
  },
  {
    id: 'billing-subscribers',
    label: 'Faturamento — Anunciantes',
    description: 'Faturas de anunciantes',
    icon: <Payment />,
    type: 'page',
    path: '/billing?type=subscriber&view=invoices',
    keywords: ['anunciantes', 'subscriber', 'faturas'],
  },
  {
    id: 'users',
    label: 'Usuários',
    description: 'Manutenção de utilizadores',
    icon: <People />,
    type: 'page',
    path: '/users',
    keywords: ['users', 'usuarios', 'utilizadores'],
  },
  {
    id: 'dispatcher',
    label: 'Dispatcher — Gerenciar',
    description: 'Campanhas e playlists elegíveis',
    icon: <MonitorHeart />,
    type: 'page',
    path: '/dispatcher-manager',
    keywords: ['dispatcher', 'gerenciar', 'elegivel'],
  },
  {
    id: 'playlist-mix',
    label: 'Playlist Mix',
    description: 'Mix por totem e regras',
    icon: <Shuffle />,
    type: 'page',
    path: '/playlist-mix',
    keywords: ['playlist', 'mix', 'totem'],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Configurações do sistema',
    icon: <Settings />,
    type: 'page',
    path: '/settings',
    keywords: ['settings', 'configuracoes', 'config'],
  },
];

/** Pro com `REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=true`: atalhos alinhados ao menu comercial (sem depender só do modo compacto). */
const commercialFocusProCommandItems: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral',
    icon: <Dashboard />,
    type: 'page',
    path: '/dashboard',
    keywords: ['dashboard', 'home', 'inicio', 'visao geral'],
  },
  {
    id: 'quick-publish',
    label: 'Publicar em Tela',
    description: 'Fluxo rápido de publicação',
    icon: <Add />,
    type: 'page',
    path: '/quick-publish',
    keywords: ['publicar', 'publicacao', 'quick', 'nova', 'tela'],
  },
  {
    id: 'subscribers',
    label: 'Anunciantes',
    description: 'Gerenciar anunciantes',
    icon: <People />,
    type: 'page',
    path: '/subscribers',
    keywords: ['anunciantes', 'subscribers', 'clientes'],
  },
  {
    id: 'totems',
    label: 'Totens',
    description: 'Telas e ativação',
    icon: <Computer />,
    type: 'page',
    path: '/totems',
    keywords: ['totems', 'totens', 'dispositivos', 'telas'],
  },
  {
    id: 'media',
    label: 'Mídias',
    description: 'Biblioteca de arquivos',
    icon: <VideoLibrary />,
    type: 'page',
    path: '/media',
    keywords: ['media', 'midias', 'arquivos'],
  },
  {
    id: 'publishers',
    label: 'Publishers',
    description: 'Gerenciar exibidores',
    icon: <Business />,
    type: 'page',
    path: '/publishers',
    keywords: ['publishers', 'publicadores', 'exibidores'],
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    description: 'Gerenciar campanhas',
    icon: <Campaign />,
    type: 'page',
    path: '/campaigns',
    keywords: ['campaigns', 'campanhas'],
  },
  {
    id: 'playlists',
    label: 'Playlists',
    description: 'Gerenciar playlists',
    icon: <QueueMusic />,
    type: 'page',
    path: '/playlists',
    keywords: ['playlists', 'listas'],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Configurações do sistema',
    icon: <Settings />,
    type: 'page',
    path: '/settings',
    keywords: ['settings', 'configuracoes', 'config'],
  },
];

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems = useMemo(
    () =>
      items ??
      (TOTEMDIGITAL_COMPACT
        ? compactCommandItems
        : DASHBOARD_COMMERCIAL_FOCUS
          ? commercialFocusProCommandItems
          : defaultItems),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return commandItems.slice(0, 12);
    }

    const term = searchTerm.toLowerCase();
    return commandItems.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(term);
      const descMatch = item.description?.toLowerCase().includes(term);
      const keywordMatch = item.keywords?.some((kw) => kw.toLowerCase().includes(term));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commandItems, searchTerm]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  const handleSelectItem = (item: CommandItem) => {
    if (item.path) {
      try {
        navigate(item.path);
      } catch (error) {
        // Fallback se navigate falhar
        window.location.href = item.path;
      }
    } else if (item.action) {
      item.action();
    }
    onClose();
    setSearchTerm('');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'page':
        return 'primary';
      case 'action':
        return 'secondary';
      case 'totem':
        return 'info';
      case 'subscriber':
        return 'success';
      case 'publisher':
        return 'warning';
      case 'campaign':
        return 'error';
      default:
        return 'default';
    }
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          mt: '10vh',
          maxHeight: '70vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          fullWidth
          placeholder="Buscar em todo o sistema..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
            },
          }}
        />

        <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
          {filteredItems.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Nenhum resultado encontrado
              </Typography>
            </Box>
          ) : (
            <List>
              {Object.entries(groupedItems).map(([type, typeItems], groupIndex) => (
                <React.Fragment key={type}>
                  {groupIndex > 0 && <Divider />}
                  {typeItems.map((item, index) => {
                    const globalIndex = filteredItems.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <ListItem
                        key={item.id}
                        button
                        selected={isSelected}
                        onClick={() => handleSelectItem(item)}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: 'action.selected',
                          },
                        }}
                      >
                        <ListItemIcon>
                          {item.icon || <Search />}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          secondary={item.description}
                        />
                        <Chip
                          label={type}
                          size="small"
                          color={getTypeColor(type) as any}
                          sx={{ mr: 1 }}
                        />
                        <ArrowForward fontSize="small" color="action" />
                      </ListItem>
                    );
                  })}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        <Box
          sx={{
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'text.secondary',
          }}
        >
          <span>↑↓ Navegar • Enter Selecionar • Esc Fechar</span>
          <span>Ctrl+K ou Cmd+K</span>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;

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
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

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
    label: 'Subscribers',
    description: 'Gerenciar assinantes',
    icon: <People />,
    type: 'page',
    path: '/subscribers',
    keywords: ['subscribers', 'assinantes', 'clientes'],
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
  items = defaultItems,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return items.slice(0, 8); // Mostrar apenas os primeiros 8 quando sem busca
    }

    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(term);
      const descMatch = item.description?.toLowerCase().includes(term);
      const keywordMatch = item.keywords?.some((kw) => kw.toLowerCase().includes(term));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [items, searchTerm]);

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
      navigate(item.path);
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

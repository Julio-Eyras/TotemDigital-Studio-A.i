/**
 * SubscriberList Component
 * Lista de subscribers com visualização em grid ou lista
 */

import React from 'react';
import { Grid, Box, Typography, TextField, InputAdornment, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Search, ViewModule, ViewList } from '@mui/icons-material';
import SubscriberCard from './SubscriberCard';
import { Subscriber } from '../../../services/api';
import { usePaginatedData } from '../../../hooks/usePaginatedData';
import { Pagination } from '@mui/material';

export interface SubscriberListProps {
  subscribers: Subscriber[];
  loading?: boolean;
  onEdit?: (subscriber: Subscriber) => void;
  onDelete?: (subscriber: Subscriber) => void;
  onView?: (subscriber: Subscriber) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

const SubscriberList: React.FC<SubscriberListProps> = ({
  subscribers,
  loading = false,
  onEdit,
  onDelete,
  onView,
  searchTerm = '',
  onSearchChange,
  viewMode = 'grid',
  onViewModeChange,
}) => {
  const {
    page,
    limit,
    total,
    paginatedData,
    setPage,
    setLimit,
  } = usePaginatedData({
    data: subscribers,
    initialPage: 1,
    initialLimit: 12,
  });

  const filteredSubscribers = React.useMemo(() => {
    if (!searchTerm) return paginatedData;
    const term = searchTerm.toLowerCase();
    return paginatedData.filter(
      (sub) =>
        sub.name?.toLowerCase().includes(term) ||
        sub.email?.toLowerCase().includes(term) ||
        sub.phone?.toLowerCase().includes(term) ||
        sub.category_segment?.toLowerCase().includes(term)
    );
  }, [paginatedData, searchTerm]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">Carregando...</Typography>
      </Box>
    );
  }

  if (filteredSubscribers.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          {searchTerm ? 'Nenhum subscriber encontrado' : 'Nenhum subscriber cadastrado'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <TextField
          placeholder="Buscar anunciantes..."
          value={searchTerm}
          onChange={(e) => onSearchChange?.(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300, flexGrow: 1, maxWidth: 500 }}
        />

        {onViewModeChange && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null) onViewModeChange(newMode);
            }}
            size="small"
          >
            <ToggleButton value="grid">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Grid/List */}
      {viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {filteredSubscribers.map((subscriber) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={subscriber.subscriber_id}>
              <SubscriberCard
                subscriber={subscriber}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box>
          {filteredSubscribers.map((subscriber) => (
            <Box key={subscriber.subscriber_id} sx={{ mb: 2 }}>
              <SubscriberCard
                subscriber={subscriber}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Pagination */}
      {total > limit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default SubscriberList;

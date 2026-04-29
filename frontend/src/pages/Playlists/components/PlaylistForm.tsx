/**
 * PlaylistForm Component
 * Formulário reutilizável para criar/editar playlists
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  PlaylistItem,
  Subscriber,
} from '../../../services/api';

export interface PlaylistFormProps {
  mode: 'create' | 'edit';
  playlist?: PlaylistItem;
  data: CreatePlaylistRequest | UpdatePlaylistRequest;
  onChange: (data: CreatePlaylistRequest | UpdatePlaylistRequest) => void;
  errors?: { [key: string]: string };
  // Dados auxiliares
  subscribers?: Subscriber[];
  canSelectSubscriber?: boolean;
  userSubscriberId?: number;
}

const PlaylistForm: React.FC<PlaylistFormProps> = ({
  mode,
  playlist,
  data,
  onChange,
  errors = {},
  subscribers = [],
  canSelectSubscriber = false,
  userSubscriberId,
}) => {
  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const getFieldValue = (field: string): any => {
    return (data as any)[field] || '';
  };

  const hasError = (field: string): boolean => {
    return !!errors[field];
  };

  const getHelperText = (field: string, defaultText?: string): string => {
    if (errors[field]) return errors[field];
    return defaultText || '';
  };

  // Para usuários que não podem selecionar subscriber, manter sempre fixo
  useEffect(() => {
    if (!canSelectSubscriber && userSubscriberId !== undefined) {
      handleFieldChange('subscriberId', userSubscriberId);
      handleFieldChange('clientId', userSubscriberId);
    }
  }, [canSelectSubscriber, userSubscriberId]);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {mode === 'create' ? 'Dados da Playlist' : 'Informações da Playlist'}
      </Typography>

      <Grid container spacing={2}>
        {/* Seleção de Subscriber (apenas para admins) */}
        {mode === 'create' && canSelectSubscriber && (
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Anunciante</InputLabel>
              <Select
                value={getFieldValue('subscriberId') || ''}
                onChange={(e) => {
                  const subscriberId = e.target.value ? Number(e.target.value) : undefined;
                  handleFieldChange('subscriberId', subscriberId);
                  handleFieldChange('clientId', subscriberId); // Compatibilidade
                }}
                label="Anunciante"
                error={hasError('subscriberId')}
              >
                <MenuItem value="">Selecione um subscriber</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
              {getHelperText('subscriberId', 'Selecione o subscriber (cliente) que será dono desta playlist')}
            </FormControl>
            {subscribers.length === 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Nenhum subscriber disponível. É necessário criar um subscriber primeiro.
              </Alert>
            )}
          </Grid>
        )}

        {/* Para usuários não-admin, mostrar subscriber fixo */}
        {mode === 'create' && !canSelectSubscriber && userSubscriberId && (
          <Grid item xs={12}>
            <Alert severity="info">
              Esta playlist será criada para o subscriber: {subscribers.find(s => s.subscriber_id === userSubscriberId)?.name || `ID: ${userSubscriberId}`}
            </Alert>
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Nome da Playlist"
            value={getFieldValue('name')}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            margin="normal"
            required
            error={hasError('name')}
            helperText={getHelperText('name', 'Nome identificador da playlist')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Categoria/Segmento"
            value={getFieldValue('categorySegment') || getFieldValue('category_segment') || ''}
            onChange={(e) => handleFieldChange('categorySegment', e.target.value)}
            margin="normal"
            helperText={getHelperText('categorySegment', 'Ex.: Promoções, Institucional, Saúde...')}
          />
        </Grid>

        {mode === 'edit' && (
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={(playlist as any)?.is_active ?? false}
                  onChange={(e) => {
                    if (mode === 'edit') {
                      onChange({
                        ...data,
                        isActive: e.target.checked,
                      } as UpdatePlaylistRequest);
                    }
                  }}
                />
              }
              label="Playlist Ativa"
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Descrição"
            value={getFieldValue('description') || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            margin="normal"
            multiline
            rows={3}
            error={hasError('description')}
            helperText={getHelperText('description')}
          />
        </Grid>
      </Grid>

      {mode === 'create' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Após criar a playlist, você poderá adicionar mídias e configurar a ordem de reprodução.
        </Alert>
      )}
    </Box>
  );
};

export default PlaylistForm;

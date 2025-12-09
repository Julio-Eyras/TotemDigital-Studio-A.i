/**
 * Tags Manager Component - Smart Signage v2.1
 * Componente para gerenciar tags e suas associações
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  QrCode,
  CreditCard,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { tagApi, Tag } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';

const TagsManager: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const [formData, setFormData] = useState({
    tagId: '',
    tagType: 'qr_code' as 'rfid' | 'nfc' | 'qr_code' | 'barcode',
    name: '',
    description: '',
    contentId: '',
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await tagApi.getAll();
      setTags(response.data || []);
    } catch (error: any) {
      showError('Erro ao carregar tags', error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.tagId || !formData.tagType) {
      showError('Preencha tagId e tagType');
      return;
    }

    try {
      await tagApi.create({
        tagId: formData.tagId,
        tagType: formData.tagType,
        name: formData.name || undefined,
        description: formData.description || undefined,
        contentId: formData.contentId ? parseInt(formData.contentId) : undefined,
      });

      showSuccess('Tag criada/atualizada com sucesso');
      setOpenDialog(false);
      resetForm();
      loadTags();
    } catch (error: any) {
      showError('Erro ao criar tag', error.response?.data?.error || error.message);
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!window.confirm('Deseja realmente desativar esta tag?')) {
      return;
    }

    try {
      await tagApi.deactivate(tagId);
      showSuccess('Tag desativada com sucesso');
      loadTags();
    } catch (error: any) {
      showError('Erro ao desativar tag', error.response?.data?.error || error.message);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      tagId: tag.tagId,
      tagType: tag.tagType,
      name: tag.name || '',
      description: tag.description || '',
      contentId: tag.contentId?.toString() || '',
    });
    setOpenDialog(true);
  };

  const resetForm = () => {
    setFormData({
      tagId: '',
      tagType: 'qr_code',
      name: '',
      description: '',
      contentId: '',
    });
    setEditingTag(null);
  };

  const getTagTypeIcon = (type: string) => {
    switch (type) {
      case 'qr_code':
        return <QrCode fontSize="small" />;
      case 'nfc':
      case 'rfid':
        return <CreditCard fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Gerenciar Tags</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
          >
            Nova Tag
          </Button>
          <IconButton onClick={loadTags} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : tags.length === 0 ? (
            <Alert severity="info">Nenhuma tag cadastrada</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tag ID</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Conteúdo</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {tag.tagId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getTagTypeIcon(tag.tagType)}
                          label={tag.tagType.toUpperCase()}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{tag.name || '-'}</TableCell>
                      <TableCell>{tag.contentId || '-'}</TableCell>
                      <TableCell>
                        {tag.isActive ? (
                          <Chip icon={<CheckCircle />} label="Ativa" color="success" size="small" />
                        ) : (
                          <Chip icon={<Cancel />} label="Inativa" color="default" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEdit(tag)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Desativar">
                          <IconButton size="small" onClick={() => handleDelete(tag.tagId)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Criar/Editar Tag */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingTag ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Tag ID"
              value={formData.tagId}
              onChange={(e) => setFormData({ ...formData, tagId: e.target.value })}
              required
              disabled={!!editingTag}
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={formData.tagType}
                label="Tipo"
                onChange={(e) => setFormData({ ...formData, tagType: e.target.value as any })}
              >
                <MenuItem value="qr_code">QR Code</MenuItem>
                <MenuItem value="nfc">NFC</MenuItem>
                <MenuItem value="rfid">RFID</MenuItem>
                <MenuItem value="barcode">Barcode</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Nome"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />

            <TextField
              label="Descrição"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="ID do Conteúdo"
              type="number"
              value={formData.contentId}
              onChange={(e) => setFormData({ ...formData, contentId: e.target.value })}
              helperText="ID da mídia que será exibida quando a tag for lida"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreate} variant="contained">
            {editingTag ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagsManager;


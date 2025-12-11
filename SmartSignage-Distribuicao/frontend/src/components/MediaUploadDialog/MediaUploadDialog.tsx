import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  CheckCircle,
  Error,
  Close,
} from '@mui/icons-material';
import { mediaApi, CreateMediaRequest } from '../../services/api';
import { validateFileSize, validateFileType, VALIDATION_CONSTANTS } from '../../utils/validation';
import { useNotification } from '../../hooks/useNotification';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MediaUploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError } = useNotification();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setError(null);
    
    const validFiles: File[] = [];
    
    for (const file of selectedFiles) {
      // Validar tipo de arquivo
      const typeValidation = validateFileType(file, VALIDATION_CONSTANTS.ALLOWED_FILE_TYPES);
      if (!typeValidation.valid) {
        showError(typeValidation.error || 'Tipo de arquivo não permitido', 'Erro de Validação');
        continue;
      }
      
      // Validar tamanho de arquivo
      const sizeValidation = validateFileSize(file, VALIDATION_CONSTANTS.MAX_UPLOAD_SIZE);
      if (!sizeValidation.valid) {
        showError(sizeValidation.error || 'Arquivo muito grande', 'Erro de Validação');
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length === 0 && selectedFiles.length > 0) {
      setError('Nenhum arquivo válido foi selecionado. Verifique o tipo e tamanho dos arquivos.');
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Selecione pelo menos um arquivo');
      return;
    }

    try {
      setUploading(true);
      setUploadStatus('uploading');
      setError(null);
      setUploadProgress(0);

      const uploadPromises = files.map(async (file, index) => {
        const mediaData: CreateMediaRequest = {
          name: formData.name || file.name.split('.')[0],
          title: formData.name || file.name.split('.')[0],
          description: formData.description,
          tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        };

        const result = await mediaApi.upload(file, mediaData);
        
        // Atualizar progresso
        setUploadProgress(((index + 1) / files.length) * 100);
        
        return result;
      });

      await Promise.all(uploadPromises);
      
      setUploadStatus('success');
      setUploadProgress(100);
      
      // Limpar formulário após sucesso
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 2000);

    } catch (error: any) {
      console.error('Erro no upload:', error);
      setError(error.response?.data?.error || 'Erro ao fazer upload dos arquivos');
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setFormData({ name: '', description: '', tags: '' });
    setUploading(false);
    setUploadProgress(0);
    setUploadStatus('idle');
    setError(null);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'unknown';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upload de Mídia
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Informações gerais */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome da Mídia"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Deixe em branco para usar o nome do arquivo"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrição"
                name="description"
                multiline
                rows={3}
                value={formData.description}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (separadas por vírgula)"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="promoção, verão, produto"
              />
            </Grid>
          </Grid>

          {/* Upload de arquivos */}
          <Box sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUpload />}
              fullWidth
              sx={{ py: 2 }}
            >
              Selecionar Arquivos
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
              />
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Tipos suportados: JPG, PNG, GIF, MP4, AVI, MOV, MP3, WAV (máximo 100MB por arquivo)
            </Typography>
          </Box>

          {/* Lista de arquivos selecionados */}
          {files.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Arquivos Selecionados ({files.length})
              </Typography>
              <List dense>
                {files.map((file, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={file.name}
                      secondary={`${formatFileSize(file.size)} • ${getFileType(file.type)}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={getFileType(file.type)}
                        color={getFileType(file.type) === 'image' ? 'primary' : 
                               getFileType(file.type) === 'video' ? 'secondary' : 'default'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveFile(index)}
                        disabled={uploading}
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Progresso do upload */}
          {uploading && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Fazendo upload... {Math.round(uploadProgress)}%
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}

          {/* Status do upload */}
          {uploadStatus === 'success' && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ mr: 1 }} />
                Upload concluído com sucesso!
              </Box>
            </Alert>
          )}

          {uploadStatus === 'error' && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Error sx={{ mr: 1 }} />
                Erro no upload
              </Box>
            </Alert>
          )}

          {/* Mensagens de erro */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          startIcon={uploading ? <LinearProgress /> : <CloudUpload />}
        >
          {uploading ? 'Fazendo Upload...' : 'Fazer Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MediaUploadDialog;

import React, { useEffect, useState, useRef } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  CheckCircle,
  Error,
  Close,
  Image as ImageIcon,
  Videocam,
  AudioFile,
} from '@mui/icons-material';
import { mediaApi, CreateMediaRequest, Client, subscriberApi, Subscriber } from '../../services/api';
import { validateFileSize, validateFileType, VALIDATION_CONSTANTS } from '../../utils/validation';
import { useNotification } from '../../hooks/useNotification';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { isStudioMode } from '../../config/studioMode';
import { isDirectTotemMode } from '../../config/directTotemMode';
import type { MediaItem } from '../../services/api';

/** Preview local após seleção — o diálogo nativo do SO não é controlável pela web app. */
async function buildLocalFilePreview(file: File): Promise<string | null> {
  if (file.type.startsWith('image/')) {
    return URL.createObjectURL(file);
  }
  if (!file.type.startsWith('video/')) {
    return null;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const dataUrl = await new Promise<string | null>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;

      const fail = () => resolve(null);

      video.onerror = fail;
      video.onloadeddata = () => {
        try {
          const t = Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(0.4, video.duration * 0.05)
            : 0.1;
          video.currentTime = t;
        } catch {
          fail();
        }
      };
      video.onseeked = () => {
        try {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          if (w < 2 || h < 2) {
            resolve(null);
            return;
          }
          const maxSide = 160;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(null);
        }
      };
    });
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function filePreviewKey(file: File, index: number): string {
  return `${file.name}:${file.size}:${file.lastModified}:${index}`;
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (uploaded?: MediaItem[]) => void;
  isAdmin?: boolean;
  canSelectSubscriber?: boolean;
  subscribers?: (Client | Subscriber)[];
  userSubscriberId?: number;
  dialogTitle?: string;
  defaultTags?: string[];
  lockDefaultTags?: boolean;
  /** TotemDigital compacto: sem /api/subscribers; usar ID inferido de mídias existentes se necessário */
  fallbackSubscriberId?: number;
  /** Nome exibido quando o subscriber é fixo (ex.: edição de anunciante) e `subscribers` não é passado */
  subscriberLabel?: string;
}

const MediaUploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  isAdmin = false,
  canSelectSubscriber,
  subscribers = [],
  userSubscriberId,
  dialogTitle,
  defaultTags = [],
  lockDefaultTags = false,
  fallbackSubscriberId,
  subscriberLabel,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [validationInfo, setValidationInfo] = useState<{
    storage?: { valid: boolean; message: string; remainingGB?: number | null };
    limits?: { valid: boolean; message: string; remaining?: number | null };
  } | null>(null);
  // Função auxiliar para obter subscriberId de um objeto Client ou Subscriber
  const getSubscriberId = (item: Client | Subscriber): number | undefined => {
    // Verificar se é Subscriber (tem subscriber_id)
    if ('subscriber_id' in item && item.subscriber_id !== undefined) {
      return item.subscriber_id;
    }
    // Verificar se é Client (tem client_id) - deprecated
    if ('client_id' in item && item.client_id !== undefined) {
      return item.client_id;
    }
    return undefined;
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: defaultTags.join(', '),
    subscriberId:
      userSubscriberId ||
      fallbackSubscriberId ||
      ((canSelectSubscriber ?? isAdmin) && subscribers.length > 0 ? getSubscriberId(subscribers[0]) : undefined),
  });

  const canPickSubscriber = canSelectSubscriber !== undefined ? canSelectSubscriber : isAdmin;

  // Sincronizar subscriberId quando props carregam/atualizam (ex.: userSubscriberId e subscribers vêm async)
  useEffect(() => {
    if (!open) return;
    setFormData((prev) => {
      const nextTags = lockDefaultTags ? defaultTags.join(', ') : (prev.tags || defaultTags.join(', '));
      const fallback =
        userSubscriberId ||
        fallbackSubscriberId ||
        (canPickSubscriber && subscribers.length > 0 ? getSubscriberId(subscribers[0]) : undefined);
      if (prev.subscriberId) return { ...prev, tags: nextTags };
      return { ...prev, subscriberId: fallback, tags: nextTags };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userSubscriberId, canPickSubscriber, subscribers?.length, lockDefaultTags, defaultTags.join(','), fallbackSubscriberId]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError } = useNotification();

  // Previews locais (imagem/vídeo) depois da seleção — independente do seletor nativo do SO.
  useEffect(() => {
    let cancelled = false;
    const revokeBlobUrls = (map: Record<string, string>) => {
      Object.values(map).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };

    if (files.length === 0) {
      setFilePreviews((prev) => {
        revokeBlobUrls(prev);
        return {};
      });
      return undefined;
    }

    (async () => {
      const next: Record<string, string> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const key = filePreviewKey(file, i);
        const preview = await buildLocalFilePreview(file);
        if (cancelled) {
          if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
          break;
        }
        if (preview) next[key] = preview;
      }
      if (cancelled) {
        revokeBlobUrls(next);
        return;
      }
      setFilePreviews((prev) => {
        revokeBlobUrls(prev);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [files]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setError(null);
    setValidationInfo(null);
    
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
      return;
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    
    // Validar limites e storage se subscriberId estiver definido (API Pro)
    if (!isStudioMode() && !isDirectTotemMode() && formData.subscriberId && validFiles.length > 0) {
      try {
        // Validar storage (soma de todos os arquivos)
        const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
        const storageValidation = await subscriberApi.validateStorage(formData.subscriberId, totalSize);
        setValidationInfo(prev => ({
          ...prev,
          storage: {
            valid: storageValidation.valid,
            message: storageValidation.message,
            remainingGB: storageValidation.remainingGB,
          }
        }));
        
        // Validar limite de mídias
        const limitsValidation = await subscriberApi.validatePlanLimits(formData.subscriberId, 'media');
        setValidationInfo(prev => ({
          ...prev,
          limits: {
            valid: limitsValidation.valid,
            message: limitsValidation.message,
            remaining: limitsValidation.remaining,
          }
        }));
      } catch {
        // Não bloquear upload se a API de limites falhar
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    // Validar subscriberId (Pro); no compacto o backend pode aceitar só contexto admin
    if (!formData.subscriberId && !isStudioMode() && !isDirectTotemMode()) {
      setError('É necessário selecionar um subscriber (anunciante)');
      return;
    }

    // Validações prévias (API subscriber — não disponível no perfil compacto)
    if (!isStudioMode() && !isDirectTotemMode() && formData.subscriberId) {
      try {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const storageValidation = await subscriberApi.validateStorage(formData.subscriberId, totalSize);
        if (!storageValidation.valid) {
          setError(storageValidation.message);
          return;
        }
        const limitsValidation = await subscriberApi.validatePlanLimits(formData.subscriberId, 'media');
        if (!limitsValidation.valid) {
          setError(limitsValidation.message);
          return;
        }
      } catch {
        /* validação prévia opcional */
      }
    }

    try {
      setUploading(true);
      setUploadStatus('uploading');
      setError(null);
      setUploadProgress(0);

      const mediaStem = (fileName: string) => {
        const base = fileName.replace(/\.[^/.]+$/, '').trim();
        return base || fileName;
      };

      /** Garante nomes únicos no lote (evita colisão se "Nome da Mídia" for partilhado). */
      const usedNames = new Set<string>();
      const uniqueNameFor = (preferred: string, file: File, index: number): string => {
        let base = preferred.trim() || mediaStem(file.name);
        if (!base) base = `midia-${index + 1}`;
        let candidate = base;
        let n = 2;
        while (usedNames.has(candidate.toLowerCase())) {
          candidate = `${base} (${n})`;
          n += 1;
        }
        usedNames.add(candidate.toLowerCase());
        return candidate;
      };

      const sharedName = formData.name.trim();
      const uploaded: MediaItem[] = [];
      const failures: string[] = [];

      // Sequencial: evita race no check de nome único e permite listar falhas por ficheiro.
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const baseName =
          files.length === 1
            ? sharedName || mediaStem(file.name)
            : sharedName || mediaStem(file.name);
        const mediaName = uniqueNameFor(baseName, file, index);

        const mediaData: CreateMediaRequest = {
          name: mediaName,
          description: formData.description,
          tags: Array.from(
            new Set([
              ...defaultTags.map((t) => t.trim()).filter(Boolean),
              ...(formData.tags ? formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []),
            ])
          ),
          ...(formData.subscriberId != null ? { subscriberId: formData.subscriberId } : {}),
        } as CreateMediaRequest;

        try {
          const result = await mediaApi.upload(file, mediaData);
          uploaded.push(result);
        } catch (fileErr: any) {
          const detail = pickApiErrorMessage(fileErr, 'falha no upload');
          failures.push(`«${mediaName}» (${file.name}): ${detail}`);
        }
        setUploadProgress(((index + 1) / files.length) * 100);
      }

      if (uploaded.length === 0) {
        setUploadStatus('error');
        setError(
          failures.length > 0
            ? `Nenhuma mídia enviada.\n${failures.join('\n')}`
            : 'Erro ao fazer upload dos arquivos'
        );
        return;
      }

      if (failures.length > 0) {
        setUploadStatus('error');
        setError(
          `${uploaded.length} enviada(s) com sucesso; ${failures.length} falhou(aram):\n${failures.join('\n')}`
        );
        // Mesmo com falhas parciais, devolve as que entraram (ex.: add ao totem).
        onSuccess(uploaded);
        return;
      }

      setUploadStatus('success');
      setUploadProgress(100);

      setTimeout(() => {
        handleClose();
        onSuccess(uploaded);
      }, 2000);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao fazer upload dos arquivos'));
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFilePreviews((prev) => {
      Object.values(prev).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      return {};
    });
    setFiles([]);
    setFormData({ 
      name: '', 
      description: '', 
      tags: defaultTags.join(', '),
      subscriberId: userSubscriberId || ((canSelectSubscriber ?? isAdmin) && subscribers.length > 0 ? getSubscriberId(subscribers[0]) : undefined),
    });
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
        {dialogTitle || 'Upload de Mídia'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Informações gerais */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {canPickSubscriber && subscribers.length > 0 && !isDirectTotemMode() && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Anunciante *</InputLabel>
                  <Select
                    value={formData.subscriberId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscriberId: e.target.value as number }))}
                    label="Anunciante *"
                    disabled={uploading}
                  >
                    {subscribers.map((subscriber) => {
                      // Pode ser Client ou Subscriber
                      const subscriberId = getSubscriberId(subscriber);
                      const key = subscriberId || 0;
                      return (
                        <MenuItem key={key} value={subscriberId}>
                          {subscriber.name} {subscriber.email ? `(${subscriber.email})` : ''}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {!canPickSubscriber && userSubscriberId && !isDirectTotemMode() && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Anunciante"
                  value={
                    subscriberLabel ||
                    subscribers.find((s) => getSubscriberId(s) === userSubscriberId)?.name ||
                    'Anunciante'
                  }
                  disabled
                  margin="normal"
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome da Mídia"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Deixe em branco para usar o nome do arquivo"
                disabled={uploading}
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
                disabled={uploading}
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
                disabled={uploading || lockDefaultTags}
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
              Tipos: JPG, PNG, GIF, MP4, AVI, MOV, MP3, WAV (máx. 100MB). Após selecionar, o preview aparece
              nesta lista (o seletor do Windows/Android/iPhone pode não mostrar miniatura de vídeo).
            </Typography>
          </Box>

          {/* Informações de validação */}
          {validationInfo && (
            <Box sx={{ mb: 2 }}>
              {validationInfo.storage && (
                <Alert 
                  severity={validationInfo.storage.valid ? 'info' : 'warning'} 
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2">
                    <strong>Storage:</strong> {validationInfo.storage.message}
                    {validationInfo.storage.remainingGB !== null && validationInfo.storage.remainingGB !== undefined && validationInfo.storage.valid && (
                      <span> ({validationInfo.storage.remainingGB.toFixed(2)} GB disponíveis)</span>
                    )}
                  </Typography>
                </Alert>
              )}
              {validationInfo.limits && (
                <Alert 
                  severity={validationInfo.limits.valid ? 'info' : 'warning'} 
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2">
                    <strong>Limite de Mídias:</strong> {validationInfo.limits.message}
                    {validationInfo.limits.remaining !== null && validationInfo.limits.remaining !== undefined && validationInfo.limits.valid && (
                      <span> ({validationInfo.limits.remaining} restantes)</span>
                    )}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Lista de arquivos selecionados */}
          {files.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Arquivos Selecionados ({files.length})
              </Typography>
              <List dense>
                {files.map((file, index) => {
                  const kind = getFileType(file.type);
                  const preview = filePreviews[filePreviewKey(file, index)];
                  const fallbackIcon =
                    kind === 'image' ? <ImageIcon /> : kind === 'video' ? <Videocam /> : <AudioFile />;
                  return (
                  <ListItem key={filePreviewKey(file, index)} divider sx={{ gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        minWidth: 72,
                        borderRadius: 1,
                        bgcolor: '#111',
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'grey.500',
                      }}
                    >
                      {preview ? (
                        <Box
                          component="img"
                          src={preview}
                          alt=""
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            objectPosition: 'center',
                            display: 'block',
                          }}
                        />
                      ) : (
                        fallbackIcon
                      )}
                    </Box>
                    <ListItemText
                      primary={file.name}
                      secondary={`${formatFileSize(file.size)} • ${kind}`}
                      sx={{ minWidth: 0, pr: 10 }}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={kind}
                        color={kind === 'image' ? 'primary' : 
                               kind === 'video' ? 'secondary' : 'default'}
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
                  );
                })}
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
            <Alert severity="error" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
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

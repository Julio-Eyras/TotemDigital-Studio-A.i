import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { AutoAwesome, Image, PlayCircleOutline, Save, Send, Stars } from '@mui/icons-material';
import { SortableList } from '../SortableList/SortableList';
import { PublishBoardPreview } from './PublishBoardPreview';
import {
  menuCatalogApi,
  MenuProductDto,
  publishBoardApi,
  PublishBoardLayoutDto,
} from '../../services/api';
import type { QuickPublishPreset } from '../../services/api';
import {
  findPublishBoardPresetUi,
  PUBLISH_BOARD_PRESETS,
} from '../../config/publishBoardFields';
import {
  findPublishPreset,
  findPublishSegment,
  PUBLISH_SEGMENTS,
} from '../../config/publishTemplates';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const PRESET_TABS: QuickPublishPreset[] = ['menu', 'promotion', 'ad', 'announcement', 'institutional'];

export interface AutoPublishContext {
  contractId: number;
  totemIds: number[];
  title: string;
  description?: string;
  durationMs: number;
}

export interface CreatePublishPanelProps {
  subscriberId: number;
  segment: string;
  preset: QuickPublishPreset;
  onPresetChange: (preset: QuickPublishPreset) => void;
  onSegmentChange: (segment: string) => void;
  onMediaGenerated: (mediaId: number) => void;
  onTitleSuggestion?: (title: string) => void;
  disabled?: boolean;
  autoPublishReady?: boolean;
  autoPublishContext?: AutoPublishContext | null;
  onAutoPublished?: (payload: { mediaId: number; message: string }) => void;
}

export const CreatePublishPanel: React.FC<CreatePublishPanelProps> = ({
  subscriberId,
  segment,
  preset,
  onPresetChange,
  onSegmentChange,
  onMediaGenerated,
  onTitleSuggestion,
  disabled = false,
  autoPublishReady = false,
  autoPublishContext = null,
  onAutoPublished,
}) => {
  const [layout, setLayout] = useState<PublishBoardLayoutDto | null>(null);
  const [menuProducts, setMenuProducts] = useState<MenuProductDto[]>([]);
  const [productOrder, setProductOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [premiumMsg, setPremiumMsg] = useState<string | null>(null);
  const [aiAssist, setAiAssist] = useState<{ available: boolean; message: string } | null>(null);
  const renderInFlightRef = useRef(false);
  const autoPublishInFlightRef = useRef(false);
  const [autoPublishing, setAutoPublishing] = useState(false);
  const [useAiForAutoPublish, setUseAiForAutoPublish] = useState(false);

  const presetUi = useMemo(() => findPublishBoardPresetUi(preset), [preset]);
  const presetConfig = useMemo(() => findPublishPreset(preset), [preset]);
  const segmentConfig = useMemo(() => findPublishSegment(segment), [segment]);

  const loadLayout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [layoutRes, productsRes] = await Promise.all([
        publishBoardApi.getLayout(subscriberId, preset),
        preset === 'menu' ? menuCatalogApi.listProducts(subscriberId) : Promise.resolve({ data: [] as MenuProductDto[] }),
      ]);
      const data = layoutRes.data;
      const ui = findPublishBoardPresetUi(preset);
      if (preset !== 'menu' && (!data.blockOrder || data.blockOrder.length === 0)) {
        data.blockOrder = [...ui.defaultBlockOrder];
      }
      setLayout(data);
      if (preset === 'menu') {
        const available = (productsRes.data || []).filter((x) => x.isAvailable);
        setMenuProducts(available);
        const order = data.productOrder?.length
          ? data.productOrder.filter((id) => available.some((pr) => pr.productId === id))
          : available.map((pr) => pr.productId);
        const rest = available.map((pr) => pr.productId).filter((id) => !order.includes(id));
        setProductOrder([...order, ...rest]);
      }
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar layout.'));
    } finally {
      setLoading(false);
    }
  }, [preset, subscriberId]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  useEffect(() => {
    publishBoardApi
      .getAiAssistStatus(subscriberId)
      .then((res) => setAiAssist({ available: res.data.available, message: res.data.message }))
      .catch(() =>
        setAiAssist({
          available: false,
          message: 'Assistente de textos indisponível. Configure AI_PROVIDER no servidor.',
        })
      );
  }, [subscriberId]);

  const orderedProducts = productOrder
    .map((id) => menuProducts.find((p) => p.productId === id))
    .filter((p): p is MenuProductDto => Boolean(p));

  const updateContent = (key: string, value: string) => {
    if (!layout) return;
    setLayout({ ...layout, content: { ...layout.content, [key]: value } });
  };

  const layoutPayload = useMemo(() => {
    if (!layout) return null;
    return {
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      preferredOrientation: layout.preferredOrientation,
      content: layout.content,
      blockOrder: layout.blockOrder,
      productOrder: preset === 'menu' ? productOrder : layout.productOrder,
      showPrices: layout.showPrices,
    };
  }, [layout, preset, productOrder]);

  useEffect(() => {
    if (!layoutPayload || loading) return;
    const timer = window.setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const res = await publishBoardApi.previewHtml(subscriberId, preset, layoutPayload);
        setPreviewHtml(res.data?.html || null);
      } catch {
        setPreviewHtml(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [layoutPayload, loading, preset, subscriberId]);

  const handleSave = async () => {
    if (!layout || !layoutPayload) return;
    try {
      setSaving(true);
      await publishBoardApi.saveLayout(subscriberId, preset, layoutPayload);
      setSuccess('Layout salvo.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestCopy = async () => {
    if (!layout) return;
    try {
      setSuggesting(true);
      setError(null);
      const res = await publishBoardApi.suggestCopy(subscriberId, preset, {
        segment,
        segmentLabel: segmentConfig.shortLabel,
        visualLanguage: segmentConfig.visualLanguage,
        boardTitle: layout.boardTitle,
        content: layout.content,
      });
      setLayout({ ...layout, content: { ...layout.content, ...res.data.content } });
      if (res.data.summary) setSuccess(`IA: ${res.data.summary}`);
      else setSuccess('Textos sugeridos pela IA aplicados.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao sugerir textos com IA.'));
    } finally {
      setSuggesting(false);
    }
  };

  const handleRenderHtml = async () => {
    if (!layout || !layoutPayload || renderInFlightRef.current || rendering) return;
    renderInFlightRef.current = true;
    try {
      setRendering(true);
      setError(null);
      await publishBoardApi.saveLayout(subscriberId, preset, layoutPayload);
      const res = await publishBoardApi.renderHtml(subscriberId, preset);
      const mediaId = res.data?.mediaId;
      if (!mediaId) throw new Error('Mídia não retornada');
      onMediaGenerated(mediaId);
      if (onTitleSuggestion && layout.boardTitle) onTitleSuggestion(layout.boardTitle);
      setSuccess('Animação HTML gerada e selecionada para publicação.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao gerar animação HTML.'));
    } finally {
      renderInFlightRef.current = false;
      setRendering(false);
    }
  };

  const handleAutoPublish = async () => {
    if (
      !layout
      || !layoutPayload
      || !autoPublishContext
      || !autoPublishReady
      || autoPublishInFlightRef.current
      || autoPublishing
    ) {
      return;
    }
    autoPublishInFlightRef.current = true;
    try {
      setAutoPublishing(true);
      setError(null);
      setSuccess(null);
      const res = await publishBoardApi.autoPublish(subscriberId, preset, {
        contractId: autoPublishContext.contractId,
        totemIds: autoPublishContext.totemIds,
        title: autoPublishContext.title,
        description: autoPublishContext.description,
        durationMs: autoPublishContext.durationMs,
        publishNow: true,
        useAi: useAiForAutoPublish,
        segment,
        segmentLabel: segmentConfig.shortLabel,
        visualLanguage: segmentConfig.visualLanguage,
        ...layoutPayload,
      });
      const mediaId = res.data?.mediaId;
      if (!mediaId) throw new Error('Mídia não retornada pelo servidor');
      onMediaGenerated(mediaId);
      onAutoPublished?.({ mediaId, message: res.message || 'Propaganda gerada e publicada.' });
      setSuccess(res.message || 'Propaganda gerada e publicada nas telas selecionadas.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao gerar e publicar propaganda.'));
    } finally {
      autoPublishInFlightRef.current = false;
      setAutoPublishing(false);
    }
  };

  const handleRenderPng = async () => {
    if (!layout || !layoutPayload || renderInFlightRef.current || rendering) return;
    renderInFlightRef.current = true;
    try {
      setRendering(true);
      await publishBoardApi.saveLayout(subscriberId, preset, layoutPayload);
      const res = await publishBoardApi.render(subscriberId, preset);
      const mediaId = res.data?.mediaId;
      if (!mediaId) throw new Error('Mídia não retornada');
      onMediaGenerated(mediaId);
      setSuccess('Imagem PNG gerada (fallback) e selecionada.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao gerar PNG.'));
    } finally {
      renderInFlightRef.current = false;
      setRendering(false);
    }
  };

  const handleQueueVideoAi = async () => {
    try {
      setPremiumMsg(null);
      const res = await publishBoardApi.queueVideoAi(subscriberId, preset, {
        briefSummary: layout?.boardTitle,
      });
      if (res.data?.premiumRequired) {
        setPremiumMsg(res.message || 'Vídeo IA disponível apenas no plano Premium.');
      } else {
        setSuccess(res.message || 'Pedido de vídeo IA registrado.');
      }
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao solicitar vídeo IA.'));
    }
  };

  const tabIndex = PRESET_TABS.indexOf(preset);

  if (loading && !layout) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!layout) return null;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {premiumMsg && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPremiumMsg(null)}>
          {premiumMsg}
        </Alert>
      )}
      {aiAssist && !aiAssist.available && preset !== 'menu' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {aiAssist.message}
        </Alert>
      )}
      {aiAssist?.available && preset !== 'menu' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {aiAssist.message}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel>Segmento comercial</InputLabel>
            <Select
              label="Segmento comercial"
              value={segment}
              onChange={(e) => onSegmentChange(String(e.target.value))}
            >
              {PUBLISH_SEGMENTS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Tabs
        value={tabIndex >= 0 ? tabIndex : 0}
        onChange={(_, idx) => onPresetChange(PRESET_TABS[idx])}
        sx={{ mb: 2 }}
      >
        {PUBLISH_BOARD_PRESETS.map((p) => {
          const cfg = findPublishPreset(p.preset);
          return <Tab key={p.preset} label={cfg.label} disabled={disabled} />;
        })}
      </Tabs>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Pré-visualização animada (HTML offline — sem CDN)
          </Typography>
          <Box
            sx={{
              position: 'relative',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#000',
              aspectRatio: layout.preferredOrientation === 'portrait' ? '9/16' : '16/9',
              maxHeight: 520,
            }}
          >
            {previewLoading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, bgcolor: 'rgba(0,0,0,0.35)' }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {previewHtml ? (
              <Box
                component="iframe"
                title="preview-html"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                sx={{ width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <PublishBoardPreview
                fullScreen
                preset={preset}
                layout={{ ...layout, productOrder, showPrices: layout.showPrices }}
                productLines={orderedProducts.map((p) => ({
                  name: p.name,
                  price: p.price,
                  description: p.description,
                }))}
              />
            )}
          </Box>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                {presetConfig.label} — monte o conteúdo
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Título do quadro"
                    value={layout.boardTitle}
                    disabled={disabled}
                    onChange={(e) => setLayout({ ...layout, boardTitle: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cor"
                    value={layout.accentColor}
                    disabled={disabled}
                    onChange={(e) => setLayout({ ...layout, accentColor: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small" disabled={disabled}>
                    <InputLabel>Formato</InputLabel>
                    <Select
                      label="Formato"
                      value={layout.preferredOrientation}
                      onChange={(e) =>
                        setLayout({
                          ...layout,
                          preferredOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                    >
                      <MenuItem value="portrait">9:16 vertical</MenuItem>
                      <MenuItem value="landscape">16:9 horizontal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={suggesting ? <CircularProgress size={16} /> : <AutoAwesome />}
                  onClick={handleSuggestCopy}
                  disabled={disabled || suggesting || preset === 'menu' || aiAssist?.available === false}
                  title={
                    aiAssist?.available === false
                      ? aiAssist.message
                      : 'Gera headline, CTA e mensagens com base no segmento'
                  }
                >
                  Sugerir textos com IA
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  startIcon={<Stars />}
                  onClick={handleQueueVideoAi}
                  disabled={disabled}
                >
                  Vídeo IA (Premium)
                </Button>
              </Box>

              {preset === 'menu' ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Preços atualizam na tela automaticamente (cardápio dinâmico). Gerencie em{' '}
                    <Link component={RouterLink} to={`/menu-catalog?subscriber=${subscriberId}`}>
                      Cardápio por cliente
                    </Link>
                  </Alert>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={layout.showPrices}
                        disabled={disabled}
                        onChange={(e) => setLayout({ ...layout, showPrices: e.target.checked })}
                      />
                    }
                    label="Mostrar preços"
                  />
                  <SortableList
                    items={orderedProducts.map((p) => ({
                      id: p.productId,
                      label: p.name,
                      secondary: p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : undefined,
                    }))}
                    onReorder={(ids) => setProductOrder(ids.map(Number).filter((n) => n > 0))}
                    emptyMessage="Cadastre produtos no cardápio."
                  />
                </>
              ) : (
                <>
                  <SortableList
                    items={(layout.blockOrder.length ? layout.blockOrder : presetUi.defaultBlockOrder)
                      .map((blockId) => {
                        const block = presetUi.blocks.find((b) => b.id === blockId);
                        if (!block) return null;
                        return {
                          id: blockId,
                          label: block.label,
                          secondary: block.fields
                            .map((f) => layout.content[f.key])
                            .filter(Boolean)
                            .join(' · '),
                        };
                      })
                      .filter((item): item is { id: string; label: string; secondary: string } => Boolean(item))}
                    onReorder={(ids) => setLayout({ ...layout, blockOrder: ids.map(String) })}
                  />
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {presetUi.blocks.map((block) =>
                      block.fields.map((field) => (
                        <TextField
                          key={field.key}
                          fullWidth
                          size="small"
                          label={field.label}
                          placeholder={field.placeholder}
                          multiline={field.multiline}
                          minRows={field.multiline ? 2 : 1}
                          disabled={disabled}
                          value={layout.content[field.key] || ''}
                          onChange={(e) => updateContent(field.key, e.target.value)}
                        />
                      ))
                    )}
                  </Box>
                </>
              )}

              {preset !== 'menu' && aiAssist?.available && (
                <FormControlLabel
                  sx={{ mb: 1 }}
                  control={
                    <Checkbox
                      checked={useAiForAutoPublish}
                      disabled={disabled || autoPublishing}
                      onChange={(e) => setUseAiForAutoPublish(e.target.checked)}
                    />
                  }
                  label="Usar IA nos textos ao gerar e publicar"
                />
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                <Button variant="outlined" startIcon={<Save />} onClick={handleSave} disabled={disabled || saving}>
                  Salvar rascunho
                </Button>
                <Button
                  variant="contained"
                  startIcon={rendering ? <CircularProgress size={18} color="inherit" /> : <PlayCircleOutline />}
                  onClick={handleRenderHtml}
                  disabled={disabled || rendering || autoPublishing}
                >
                  Gerar animação HTML
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={autoPublishing ? <CircularProgress size={18} color="inherit" /> : <Send />}
                  onClick={handleAutoPublish}
                  disabled={disabled || autoPublishing || rendering || !autoPublishReady || !autoPublishContext}
                  title={
                    autoPublishReady
                      ? 'Gera HTML e publica nas telas selecionadas'
                      : 'Preencha contrato, telas e título na página antes de publicar'
                  }
                >
                  {autoPublishing ? 'Publicando...' : 'Gerar e publicar agora'}
                </Button>
                <Button
                  variant="text"
                  startIcon={<Image />}
                  onClick={handleRenderPng}
                  disabled={disabled || rendering || autoPublishing}
                >
                  PNG (fallback)
                </Button>
              </Box>
              {!autoPublishReady && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Para publicar automaticamente, selecione contrato, ao menos uma tela e o título da publicação acima.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

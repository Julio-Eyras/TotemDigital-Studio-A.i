import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Checkbox,
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
import { Image, Save } from '@mui/icons-material';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { SortableList } from '../../components/SortableList/SortableList';
import { PublishBoardPreview } from '../../components/Publish/PublishBoardPreview';
import {
  menuCatalogApi,
  MenuProductDto,
  publishBoardApi,
  PublishBoardLayoutDto,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import type { QuickPublishPreset } from '../../services/api';
import {
  findPublishBoardPresetUi,
  PUBLISH_BOARD_PRESETS,
  resolvePublishBoardPreset,
} from '../../config/publishBoardFields';
import {
  defaultSegmentForPreset,
  findPublishPreset,
  PUBLISH_PRESETS,
} from '../../config/publishTemplates';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const PRESET_TABS: QuickPublishPreset[] = ['menu', 'promotion', 'ad', 'announcement', 'institutional'];

const PublishBoardStudio: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const breadcrumbs = useBreadcrumbs();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberId, setSubscriberId] = useState<number | ''>('');
  const [preset, setPreset] = useState<QuickPublishPreset>(
    resolvePublishBoardPreset(searchParams.get('preset'))
  );
  const [layout, setLayout] = useState<PublishBoardLayoutDto | null>(null);
  const [menuProducts, setMenuProducts] = useState<MenuProductDto[]>([]);
  const [productOrder, setProductOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const presetUi = useMemo(() => findPublishBoardPresetUi(preset), [preset]);
  const presetConfig = useMemo(() => findPublishPreset(preset), [preset]);

  const loadSubscribers = useCallback(async () => {
    const res = await subscriberApi.getAll({ limit: 500, active_only: true });
    setSubscribers(res.data || []);
  }, []);

  const loadLayout = useCallback(async (sid: number, p: QuickPublishPreset) => {
    setLoading(true);
    setError(null);
    try {
      const [layoutRes, productsRes] = await Promise.all([
        publishBoardApi.getLayout(sid, p),
        p === 'menu' ? menuCatalogApi.listProducts(sid) : Promise.resolve({ data: [] as MenuProductDto[] }),
      ]);
      const data = layoutRes.data;
      const ui = findPublishBoardPresetUi(p);
      if (p !== 'menu' && (!data.blockOrder || data.blockOrder.length === 0)) {
        data.blockOrder = [...ui.defaultBlockOrder];
      }
      setLayout(data);
      if (p === 'menu') {
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
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    const sid = searchParams.get('subscriber');
    if (sid && /^\d+$/.test(sid)) setSubscriberId(Number(sid));
    const p = searchParams.get('preset');
    if (p) setPreset(resolvePublishBoardPreset(p));
  }, [searchParams]);

  useEffect(() => {
    if (subscriberId) loadLayout(Number(subscriberId), preset);
    else {
      setLayout(null);
      setMenuProducts([]);
    }
  }, [subscriberId, preset, loadLayout]);

  const syncUrl = (p: QuickPublishPreset, sid: number) => {
    const segment = searchParams.get('segment') || defaultSegmentForPreset(p);
    setSearchParams({ preset: p, subscriber: String(sid), segment }, { replace: true });
  };

  const handleTabPreset = (_: React.SyntheticEvent, idx: number) => {
    const next = PRESET_TABS[idx];
    setPreset(next);
    if (subscriberId) syncUrl(next, Number(subscriberId));
  };

  const orderedProducts = productOrder
    .map((id) => menuProducts.find((p) => p.productId === id))
    .filter((p): p is MenuProductDto => Boolean(p));

  const updateContent = (key: string, value: string) => {
    if (!layout) return;
    setLayout({ ...layout, content: { ...layout.content, [key]: value } });
  };

  const handleSave = async () => {
    if (!subscriberId || !layout) return;
    try {
      setSaving(true);
      await publishBoardApi.saveLayout(Number(subscriberId), preset, {
        boardTitle: layout.boardTitle,
        accentColor: layout.accentColor,
        preferredOrientation: layout.preferredOrientation,
        content: layout.content,
        blockOrder: layout.blockOrder,
        productOrder: preset === 'menu' ? productOrder : layout.productOrder,
        showPrices: layout.showPrices,
      });
      setSuccess('Layout salvo.');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRender = async () => {
    if (!subscriberId || !layout) return;
    try {
      setRendering(true);
      await publishBoardApi.saveLayout(Number(subscriberId), preset, {
        boardTitle: layout.boardTitle,
        accentColor: layout.accentColor,
        preferredOrientation: layout.preferredOrientation,
        content: layout.content,
        blockOrder: layout.blockOrder,
        productOrder: preset === 'menu' ? productOrder : layout.productOrder,
        showPrices: layout.showPrices,
      });
      const res = await publishBoardApi.render(Number(subscriberId), preset);
      const mediaId = res.data?.mediaId;
      if (!mediaId) throw new Error('Mídia não retornada');
      const segment = searchParams.get('segment') || defaultSegmentForPreset(preset);
      const orientation = layout.preferredOrientation;
      navigate(
        `/quick-publish?mode=create&preset=${preset}&segment=${segment}&orientation=${orientation}&subscriber=${subscriberId}&mediaIds=${mediaId}`
      );
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao gerar mídia.'));
    } finally {
      setRendering(false);
    }
  };

  const tabIndex = PRESET_TABS.indexOf(preset);

  return (
    <Box>
      <PageHeader
        title="Estúdio de publicação visual"
        subtitle="Crie o quadro para Cardápio, Promoção, Anúncio, Comunicado ou Institucional e publique na tela."
        breadcrumbs={breadcrumbs}
        loading={loading}
      />
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

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
            <InputLabel>Anunciante</InputLabel>
            <Select
              label="Anunciante"
              value={subscriberId === '' ? '' : String(subscriberId)}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : '';
                setSubscriberId(id);
                if (id) syncUrl(preset, Number(id));
              }}
            >
              {subscribers.map((s) => (
                <MenuItem key={s.subscriber_id} value={String(s.subscriber_id)}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Tabs value={tabIndex >= 0 ? tabIndex : 0} onChange={handleTabPreset} sx={{ mb: 2 }}>
        {PUBLISH_BOARD_PRESETS.map((p) => {
          const cfg = findPublishPreset(p.preset);
          return <Tab key={p.preset} label={cfg.label} />;
        })}
      </Tabs>

      {!subscriberId && !loading && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Selecione um anunciante
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Escolha o cliente acima para montar o quadro visual e gerar a mídia para publicação.
            </Typography>
            <Button component={RouterLink} to="/subscribers" variant="outlined">
              Gerir anunciantes
            </Button>
          </CardContent>
        </Card>
      )}

      {subscriberId && layout && (
        <Grid container spacing={3}>
          <Grid
            item
            xs={12}
            lg={5}
            sx={{
              position: { lg: 'sticky' },
              top: { lg: 16 },
              alignSelf: 'flex-start',
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Pré-visualização em tela cheia ({layout.preferredOrientation === 'portrait' ? '9:16' : '16:9'})
            </Typography>
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
          </Grid>
          <Grid item xs={12} lg={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {presetConfig.label} — {presetConfig.description}
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Título do quadro"
                      value={layout.boardTitle}
                      onChange={(e) => setLayout({ ...layout, boardTitle: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cor"
                      value={layout.accentColor}
                      onChange={(e) => setLayout({ ...layout, accentColor: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
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

                {preset === 'menu' ? (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Gerencie produtos em{' '}
                      <Link component={RouterLink} to={`/menu-catalog?subscriber=${subscriberId}`}>
                        Cardápio por cliente
                      </Link>
                      . Arraste para definir a ordem na tela.
                    </Alert>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={layout.showPrices}
                          onChange={(e) => setLayout({ ...layout, showPrices: e.target.checked })}
                        />
                      }
                      label="Mostrar preços"
                    />
                    <SortableList
                      items={orderedProducts.map((p) => ({
                        id: p.productId,
                        label: p.name,
                        secondary:
                          p.price != null
                            ? `R$ ${Number(p.price).toFixed(2)}`
                            : undefined,
                      }))}
                      onReorder={setProductOrder}
                      emptyMessage="Cadastre produtos no cardápio."
                    />
                  </>
                ) : (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Blocos de texto (arraste para reordenar na tela)
                    </Typography>
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
                        .filter((item): item is { id: string; label: string; secondary: string } =>
                          Boolean(item)
                        )}
                      onReorder={(ids) =>
                        setLayout({ ...layout, blockOrder: ids.map(String) })
                      }
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
                            value={layout.content[field.key] || ''}
                            onChange={(e) => updateContent(field.key, e.target.value)}
                          />
                        ))
                      )}
                    </Box>
                  </>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Button variant="outlined" startIcon={<Save />} onClick={handleSave} disabled={saving}>
                    Salvar layout
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={rendering ? <CircularProgress size={18} color="inherit" /> : <Image />}
                    onClick={handleRender}
                    disabled={rendering}
                  >
                    Gerar mídia e continuar publicação
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default PublishBoardStudio;

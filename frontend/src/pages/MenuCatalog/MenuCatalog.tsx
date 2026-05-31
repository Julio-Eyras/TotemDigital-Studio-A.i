import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  menuCatalogApi,
  MenuCategoryDto,
  MenuProductDto,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const MenuCatalog: React.FC = () => {
  const [searchParams] = useSearchParams();
  const breadcrumbs = useBreadcrumbs();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberId, setSubscriberId] = useState<number | ''>('');
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [products, setProducts] = useState<MenuProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number | ''>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editProduct, setEditProduct] = useState<MenuProductDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | ''>('');
  const [editAvailable, setEditAvailable] = useState(true);

  const loadSubscribers = useCallback(async () => {
    const res = await subscriberApi.getAll({ limit: 500, active_only: true });
    setSubscribers(res.data || []);
  }, []);

  const loadCatalog = useCallback(async (sid: number) => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        menuCatalogApi.listCategories(sid),
        menuCatalogApi.listProducts(sid),
      ]);
      setCategories(catRes.data || []);
      setProducts(prodRes.data || []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar cardápio.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    const preselect = searchParams.get('subscriber');
    if (preselect && /^\d+$/.test(preselect)) {
      setSubscriberId(Number(preselect));
    }
  }, [searchParams]);

  useEffect(() => {
    if (subscriberId) loadCatalog(Number(subscriberId));
    else {
      setCategories([]);
      setProducts([]);
    }
  }, [subscriberId, loadCatalog]);

  const categoryName = (id: number | null) =>
    categories.find((c) => c.categoryId === id)?.name || '—';

  const handleCreateProduct = async () => {
    if (!subscriberId || !newName.trim()) return;
    try {
      await menuCatalogApi.createProduct(Number(subscriberId), {
        name: newName.trim(),
        price: newPrice ? Number(newPrice) : undefined,
        categoryId: newCategoryId === '' ? undefined : Number(newCategoryId),
      });
      setNewName('');
      setNewPrice('');
      setNewCategoryId('');
      await loadCatalog(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar produto.'));
    }
  };

  const handleCreateCategory = async () => {
    if (!subscriberId || !newCategoryName.trim()) return;
    try {
      await menuCatalogApi.createCategory(Number(subscriberId), { name: newCategoryName.trim() });
      setNewCategoryName('');
      await loadCatalog(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar categoria.'));
    }
  };

  const openEdit = (product: MenuProductDto) => {
    setEditProduct(product);
    setEditName(product.name);
    setEditPrice(product.price != null ? String(product.price) : '');
    setEditCategoryId(product.categoryId ?? '');
    setEditAvailable(product.isAvailable);
  };

  const handleSaveEdit = async () => {
    if (!subscriberId || !editProduct) return;
    try {
      await menuCatalogApi.updateProduct(Number(subscriberId), editProduct.productId, {
        name: editName.trim(),
        price: editPrice ? Number(editPrice) : null,
        categoryId: editCategoryId === '' ? null : Number(editCategoryId),
        isAvailable: editAvailable,
      });
      setEditProduct(null);
      await loadCatalog(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao atualizar produto.'));
    }
  };

  const handleDelete = async (productId: number) => {
    if (!subscriberId) return;
    try {
      await menuCatalogApi.deleteProduct(Number(subscriberId), productId);
      await loadCatalog(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao remover produto.'));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Cardápio por cliente"
        subtitle="Cadastro de categorias e produtos por anunciante — use com o template Cardápio Digital na publicação rápida."
        breadcrumbs={breadcrumbs}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Alert severity="info" sx={{ mb: 2 }}>
        Depois de cadastrar itens, publique com{' '}
        <Link component={RouterLink} to="/quick-publish?preset=menu&segment=restaurant&orientation=portrait">
          Publicação rápida → Cardápio
        </Link>
        .
      </Alert>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
            <InputLabel>Anunciante (tenant)</InputLabel>
            <Select
              label="Anunciante (tenant)"
              value={subscriberId === '' ? '' : String(subscriberId)}
              onChange={(e) => setSubscriberId(e.target.value ? Number(e.target.value) : '')}
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

      {subscriberId && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Categorias ({categories.length})
                </Typography>
                {categories.map((c) => (
                  <Chip key={c.categoryId} label={c.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
                <TextField
                  fullWidth
                  size="small"
                  label="Nova categoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  sx={{ mt: 2, mb: 1 }}
                />
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={handleCreateCategory}>
                  Adicionar categoria
                </Button>
              </CardContent>
            </Card>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Novo produto
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Nome"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Preço (R$)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>Categoria</InputLabel>
                  <Select
                    label="Categoria"
                    value={newCategoryId === '' ? '' : String(newCategoryId)}
                    onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <MenuItem value="">Sem categoria</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c.categoryId} value={String(c.categoryId)}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained" startIcon={<Add />} onClick={handleCreateProduct}>
                  Adicionar produto
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Produtos ({products.length})
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell>Preço</TableCell>
                      <TableCell>Disponível</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{categoryName(p.categoryId)}</TableCell>
                        <TableCell>
                          {p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell>{p.isAvailable ? 'Sim' : 'Não'}</TableCell>
                        <TableCell align="right">
                          <Button size="small" startIcon={<Edit />} onClick={() => openEdit(p)}>
                            Editar
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => handleDelete(p.productId)}
                          >
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && products.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhum produto cadastrado.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={Boolean(editProduct)} onClose={() => setEditProduct(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar produto</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Nome" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth />
          <TextField label="Preço (R$)" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} fullWidth />
          <FormControl fullWidth size="small">
            <InputLabel>Categoria</InputLabel>
            <Select
              label="Categoria"
              value={editCategoryId === '' ? '' : String(editCategoryId)}
              onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : '')}
            >
              <MenuItem value="">Sem categoria</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.categoryId} value={String(c.categoryId)}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Disponível</InputLabel>
            <Select
              label="Disponível"
              value={editAvailable ? 'yes' : 'no'}
              onChange={(e) => setEditAvailable(e.target.value === 'yes')}
            >
              <MenuItem value="yes">Sim</MenuItem>
              <MenuItem value="no">Não</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditProduct(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MenuCatalog;

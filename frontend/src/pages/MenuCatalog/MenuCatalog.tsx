import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
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
import { Add, Delete } from '@mui/icons-material';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  menuCatalogApi,
  MenuProductDto,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const MenuCatalog: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberId, setSubscriberId] = useState<number | ''>('');
  const [products, setProducts] = useState<MenuProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadSubscribers = useCallback(async () => {
    const res = await subscriberApi.getAll({ limit: 500, active_only: true });
    setSubscribers(res.data || []);
  }, []);

  const loadProducts = useCallback(async (sid: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await menuCatalogApi.listProducts(sid);
      setProducts(res.data || []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar produtos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    if (subscriberId) loadProducts(Number(subscriberId));
    else setProducts([]);
  }, [subscriberId, loadProducts]);

  const handleCreateProduct = async () => {
    if (!subscriberId || !newName.trim()) return;
    try {
      await menuCatalogApi.createProduct(Number(subscriberId), {
        name: newName.trim(),
        price: newPrice ? Number(newPrice) : undefined,
      });
      setNewName('');
      setNewPrice('');
      await loadProducts(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar produto.'));
    }
  };

  const handleCreateCategory = async () => {
    if (!subscriberId || !newCategoryName.trim()) return;
    try {
      await menuCatalogApi.createCategory(Number(subscriberId), { name: newCategoryName.trim() });
      setNewCategoryName('');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao criar categoria.'));
    }
  };

  const handleDelete = async (productId: number) => {
    if (!subscriberId) return;
    try {
      await menuCatalogApi.deleteProduct(Number(subscriberId), productId);
      await loadProducts(Number(subscriberId));
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao remover produto.'));
    }
  };

  return (
    <Box>
      <PageHeader title="Cardápio por cliente" breadcrumbs={breadcrumbs} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
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
                  Nova categoria
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Nome da categoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button variant="outlined" startIcon={<Add />} onClick={handleCreateCategory}>
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
                  Produtos cadastrados
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Preço</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>
                          {p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(p.productId)}>
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && products.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhum produto cadastrado para este cliente.
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
    </Box>
  );
};

export default MenuCatalog;

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Fab,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Email,
  Phone,
  LocationOn,
  MoreVert,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { clientApi, Client, CreateClientRequest } from '../../services/api';

export const Clients: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<CreateClientRequest>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      
      // Simular carregamento de dados (substituir por chamadas reais da API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setClients([
        {
          client_id: 1,
          name: 'Empresa ABC Ltda',
          email: 'contato@empresaabc.com',
          phone: '(11) 99999-9999',
          address: 'Rua das Flores, 123 - São Paulo/SP',
          is_active: true,
          created_at: '2024-01-01 00:00:00',
          updated_at: '2024-01-20 14:30:00',
        },
        {
          client_id: 2,
          name: 'Comércio XYZ',
          email: 'vendas@comercioxyz.com',
          phone: '(21) 88888-8888',
          address: 'Av. Principal, 456 - Rio de Janeiro/RJ',
          is_active: true,
          created_at: '2024-01-05 09:00:00',
          updated_at: '2024-01-19 16:45:00',
        },
        {
          client_id: 3,
          name: 'Loja Central',
          email: 'loja@central.com',
          phone: '(31) 77777-7777',
          address: 'Praça Central, 789 - Belo Horizonte/MG',
          is_active: false,
          created_at: '2024-01-10 14:30:00',
          updated_at: '2024-01-15 11:20:00',
        },
        {
          client_id: 4,
          name: 'Supermercado Moderno',
          email: 'admin@supermoderno.com',
          phone: '(41) 66666-6666',
          address: 'Rua Comercial, 321 - Curitiba/PR',
          is_active: true,
          created_at: '2024-01-12 08:15:00',
          updated_at: '2024-01-18 10:30:00',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
    });
    setOpenDialog(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setOpenDialog(true);
  };

  const handleDeleteClient = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        // Implementar exclusão via API
        setClients(prev => prev.filter(item => item.client_id !== id));
      } catch (error) {
        console.error('Erro ao excluir cliente:', error);
      }
    }
  };

  const handleSaveClient = async () => {
    try {
      if (editingClient) {
        // Atualizar cliente existente
        const updatedClient = await clientApi.update(editingClient.client_id, formData);
        setClients(prev => prev.map(item => 
          item.client_id === editingClient.client_id ? updatedClient : item
        ));
      } else {
        // Criar novo cliente
        const newClient = await clientApi.create(formData);
        setClients(prev => [...prev, newClient]);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStatusChange = async (id: number, isActive: boolean) => {
    try {
      // Implementar mudança de status via API
      setClients(prev => prev.map(item => 
        item.client_id === id ? { ...item, is_active: isActive } : item
      ));
    } catch (error) {
      console.error('Erro ao alterar status do cliente:', error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Clientes...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Gerenciamento de Clientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddClient}
        >
          Novo Cliente
        </Button>
      </Box>

      <Grid container spacing={3}>
        {clients.map((client) => (
          <Grid item xs={12} md={6} lg={4} key={client.client_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Business sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">
                      {client.name}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    <MoreVert />
                  </IconButton>
                </Box>

                <Box sx={{ mb: 2 }}>
                  {client.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Email sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {client.email}
                      </Typography>
                    </Box>
                  )}
                  
                  {client.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Phone sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {client.phone}
                      </Typography>
                    </Box>
                  )}
                  
                  {client.address && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <LocationOn sx={{ mr: 1, fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
                      <Typography variant="body2" color="text.secondary">
                        {client.address}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={client.is_active ? 'Ativo' : 'Inativo'}
                    color={client.is_active ? 'success' : 'default'}
                    size="small"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={client.is_active}
                        onChange={(e) => handleStatusChange(client.client_id, e.target.checked)}
                        size="small"
                      />
                    }
                    label=""
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleEditClient(client)}
                  >
                    <Edit sx={{ mr: 0.5 }} />
                    Editar
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDeleteClient(client.client_id)}
                    color="error"
                  >
                    <Delete sx={{ mr: 0.5 }} />
                    Excluir
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Criado em: {new Date(client.created_at).toLocaleDateString('pt-BR')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog para adicionar/editar cliente */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome da Empresa"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Telefone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Endereço"
                  name="address"
                  multiline
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveClient}>
            {editingClient ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar cliente */}
      <Tooltip title="Adicionar Cliente">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleAddClient}
        >
          <Add />
        </Fab>
      </Tooltip>
    </Box>
  );
};
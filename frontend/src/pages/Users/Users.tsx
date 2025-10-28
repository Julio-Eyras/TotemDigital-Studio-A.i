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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  AdminPanelSettings,
  Business,
  MoreVert,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { userApi, User, CreateUserRequest } from '../../services/api';

export const Users: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Simular carregamento de dados (substituir por chamadas reais da API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUsers([
        {
          user_id: 1,
          username: 'admin',
          email: 'admin@smart-signage.com',
          name: 'Administrator',
          role: 'admin',
          is_active: true,
          last_login: '2024-01-20 14:30:00',
          created_at: '2024-01-01 00:00:00',
        },
        {
          user_id: 2,
          username: 'joao.silva',
          email: 'joao@empresa.com',
          name: 'João Silva',
          role: 'user',
          client_id: 1,
          is_active: true,
          last_login: '2024-01-20 10:15:00',
          created_at: '2024-01-15 09:00:00',
        },
        {
          user_id: 3,
          username: 'maria.santos',
          email: 'maria@empresa.com',
          name: 'Maria Santos',
          role: 'client',
          client_id: 2,
          is_active: true,
          last_login: '2024-01-19 16:45:00',
          created_at: '2024-01-10 14:30:00',
        },
        {
          user_id: 4,
          username: 'pedro.oliveira',
          email: 'pedro@empresa.com',
          name: 'Pedro Oliveira',
          role: 'user',
          client_id: 1,
          is_active: false,
          last_login: '2024-01-15 11:20:00',
          created_at: '2024-01-12 08:15:00',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'user',
    });
    setOpenDialog(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      name: user.name,
      role: user.role,
    });
    setOpenDialog(true);
  };

  const handleDeleteUser = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        // Implementar exclusão via API
        setUsers(prev => prev.filter(item => item.user_id !== id));
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
      }
    }
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        // Atualizar usuário existente
        const updatedUser = await userApi.update(editingUser.user_id, formData);
        setUsers(prev => prev.map(item => 
          item.user_id === editingUser.user_id ? updatedUser : item
        ));
      } else {
        // Criar novo usuário
        const newUser = await userApi.create(formData);
        setUsers(prev => [...prev, newUser]);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings />;
      case 'user': return <Person />;
      case 'client': return <Business />;
      default: return <Person />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'user': return 'primary';
      case 'client': return 'secondary';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'user': return 'Usuário';
      case 'client': return 'Cliente';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Usuários...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Gerenciamento de Usuários
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddUser}
        >
          Novo Usuário
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuário</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>Função</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Último Login</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getRoleIcon(user.role)}
                    <Typography sx={{ ml: 1 }}>
                      {user.username}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  <Chip
                    icon={getRoleIcon(user.role)}
                    label={getRoleLabel(user.role)}
                    color={getRoleColor(user.role) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.is_active ? 'Ativo' : 'Inativo'}
                    color={user.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : 'Nunca'}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEditUser(user)}>
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteUser(user.user_id)}
                    disabled={user.user_id === 1} // Não permitir excluir admin
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para adicionar/editar usuário */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nome de Usuário"
                  name="username"
                  value={formData.username}
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome Completo"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Função</InputLabel>
                  <Select
                    name="role"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    label="Função"
                  >
                    <MenuItem value="admin">Administrador</MenuItem>
                    <MenuItem value="user">Usuário</MenuItem>
                    <MenuItem value="client">Cliente</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Senha"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                  helperText={editingUser ? 'Deixe em branco para manter a senha atual' : ''}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveUser}>
            {editingUser ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar usuário */}
      <Tooltip title="Adicionar Usuário">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleAddUser}
        >
          <Add />
        </Fab>
      </Tooltip>
    </Box>
  );
};
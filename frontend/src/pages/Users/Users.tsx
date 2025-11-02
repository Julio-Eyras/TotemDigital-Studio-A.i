import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  People,
  Person,
  AdminPanelSettings,
  Business,
  Refresh,
  MoreVert,
  CheckCircle,
  Warning,
  Error,
} from '@mui/icons-material';
import { userApi, User, CreateUserRequest, clientApi, Client } from '../../services/api';

const Users: React.FC = () => {
  const theme = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
    clientId: undefined,
  });

  useEffect(() => {
    loadUsers();
    loadClients();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userApi.getAll({
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setError('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientApi.getAll();
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      await userApi.create(newUser);
      setCreateDialogOpen(false);
      setNewUser({ username: '', email: '', password: '', name: '', role: 'user', clientId: undefined });
      loadUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      setError('Erro ao criar usuário');
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    
    try {
      await userApi.update(selectedUser.user_id, {
        username: selectedUser.username,
        email: selectedUser.email,
        name: selectedUser.name,
        role: selectedUser.role,
        clientId: selectedUser.client_id,
        isActive: selectedUser.is_active,
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setError('Erro ao atualizar usuário');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await userApi.delete(id);
        loadUsers();
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        setError('Erro ao excluir usuário');
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettings />;
      case 'client':
        return <Business />;
      default:
        return <Person />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return theme.palette.error.main;
      case 'client':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return 'Nunca';
    
    const now = new Date();
    const lastSeen = new Date(lastLogin);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return `${Math.floor(diffInMinutes / 1440)}d atrás`;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando usuários...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Usuários
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie os usuários do sistema
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ 
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Adicionar Usuário
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <People sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Função</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  label="Função"
                >
                  <MenuItem value="all">Todas</MenuItem>
                  <MenuItem value="admin">Administrador</MenuItem>
                  <MenuItem value="user">Usuário</MenuItem>
                  <MenuItem value="client">Cliente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadUsers}
              >
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Usuário</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Função</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Último Login</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ 
                        backgroundColor: alpha(getRoleColor(user.role), 0.1),
                        color: getRoleColor(user.role)
                      }}>
                        {getRoleIcon(user.role)}
                      </Avatar>
    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {user.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                          @{user.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.email || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: alpha(getRoleColor(user.role), 0.1),
                        color: getRoleColor(user.role),
                        fontWeight: 'bold',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.client_id ? `Cliente ${user.client_id}` : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {formatLastLogin(user.last_login)}
      </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Ativo' : 'Inativo'}
                      size="small"
                      color={user.is_active ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setSelectedUser(user);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteUser(user.user_id)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Empty State */}
      {users.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8, mt: 3 }}>
          <CardContent>
            <People sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum usuário encontrado
        </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros usuários
        </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Usuário
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Usuário</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome de Usuário"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Nome Completo"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Senha"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Função</InputLabel>
            <Select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              label="Função"
            >
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="user">Usuário</MenuItem>
              <MenuItem value="client">Cliente</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Cliente</InputLabel>
            <Select
              value={newUser.clientId || ''}
              onChange={(e) => {
                const value = e.target.value;
                setNewUser({ 
                  ...newUser, 
                  clientId: value && value !== '' ? parseInt(String(value), 10) : undefined 
                });
              }}
              label="Cliente"
            >
              <MenuItem value="">Nenhum</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.client_id} value={client.client_id}>
                  {client.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateUser}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Usuário</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome de Usuário"
            value={selectedUser?.username || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser!, username: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Nome Completo"
            value={selectedUser?.name || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser!, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={selectedUser?.email || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser!, email: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Função</InputLabel>
            <Select
              value={selectedUser?.role || 'user'}
              onChange={(e) => setSelectedUser({ ...selectedUser!, role: e.target.value as any })}
              label="Função"
            >
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="user">Usuário</MenuItem>
              <MenuItem value="client">Cliente</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Cliente</InputLabel>
            <Select
              value={selectedUser?.client_id || ''}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedUser({ 
                  ...selectedUser!, 
                  client_id: value && value !== '' ? parseInt(String(value), 10) : undefined 
                });
              }}
              label="Cliente"
            >
              <MenuItem value="">Nenhum</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.client_id} value={client.client_id}>
                  {client.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={selectedUser?.is_active || false}
                onChange={(e) => setSelectedUser({ ...selectedUser!, is_active: e.target.checked })}
              />
            }
            label="Usuário Ativo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditUser}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;
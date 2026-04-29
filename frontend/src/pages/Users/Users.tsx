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
import { userApi, User, CreateUserRequest, UserFlags, publisherApi, Publisher, subscriberApi, Subscriber } from '../../services/api';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';

const Users: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const [users, setUsers] = useState<User[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [flagsDialogOpen, setFlagsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserFlags, setSelectedUserFlags] = useState<UserFlags | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
    userType: 'system_user',
    isTenantUser: false,
    flags: undefined,
  });

  useEffect(() => {
    loadUsers();
    loadPublishers();
    loadSubscribers();
  }, []);

  const loadSubscribers = async () => {
    try {
      const response = await subscriberApi.getAll();
      setSubscribers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userApi.getAll({
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        userType: userTypeFilter !== 'all' ? userTypeFilter : undefined,
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setError('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: true });
      setPublishers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      await userApi.create(newUser);
      setCreateDialogOpen(false);
      setNewUser({ 
        username: '', 
        email: '', 
        password: '', 
        name: '', 
        role: 'user',
        userType: 'system_user',
        isTenantUser: false,
        flags: undefined,
      });
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
        userType: selectedUser.user_type,
        publisherId: selectedUser.publisher_id,
        subscriberId: selectedUser.subscriber_id,
        isTenantUser: (selectedUser as any).isTenantUser ?? (selectedUser as any).is_tenant_user,
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

  const handleOpenFlagsDialog = async (user: User) => {
    try {
      setSelectedUser(user);
      const flags = await userApi.getFlags(user.user_id);
      setSelectedUserFlags(flags);
      setFlagsDialogOpen(true);
    } catch (error) {
      console.error('Erro ao carregar flags:', error);
      setError('Erro ao carregar flags do usuário');
    }
  };

  const handleSaveFlags = async () => {
    if (!selectedUser || !selectedUserFlags) return;
    
    try {
      await userApi.updateFlags(selectedUser.user_id, selectedUserFlags);
      setFlagsDialogOpen(false);
      setSelectedUser(null);
      setSelectedUserFlags(null);
      loadUsers();
    } catch (error) {
      console.error('Erro ao salvar flags:', error);
      setError('Erro ao salvar flags');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettings />;
        return <Business />;
      default:
        return <Person />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return theme.palette.error.main;
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
      <PageHeader
        title="Usuários"
        subtitle="Gerencie os usuários do sistema"
        breadcrumbs={breadcrumbs}
        actions={[
          {
            label: 'Criar Usuário',
            icon: <Add />,
            onClick: () => setCreateDialogOpen(true),
            variant: 'contained',
          },
        ]}
        onRefresh={loadUsers}
        loading={loading}
      />

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
                  <MenuItem value="owner_system">Owner System</MenuItem>
                  <MenuItem value="admin_sql">Admin SQL</MenuItem>
                  <MenuItem value="admin">Administrador</MenuItem>
                  <MenuItem value="operador_tecnico">Operador Técnico</MenuItem>
                  <MenuItem value="operador_faturamento">Operador Faturamento</MenuItem>
                  <MenuItem value="operador_comercial">Operador Comercial</MenuItem>
                  <MenuItem value="gerente_marketing">Gerente Marketing</MenuItem>
                  <MenuItem value="editoracao">Edição</MenuItem>
                  <MenuItem value="visualizador">Visualizador</MenuItem>
                  <MenuItem value="user">Usuário</MenuItem>
                  <MenuItem value="publisher_user">Publisher</MenuItem>
                  <MenuItem value="subscriber_user">Subscriber</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={userTypeFilter}
                  onChange={(e) => setUserTypeFilter(e.target.value)}
                  label="Tipo"
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="system_user">Sistema</MenuItem>
                  <MenuItem value="publisher_user">Publisher</MenuItem>
                  <MenuItem value="subscriber_user">Subscriber</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1}>
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
                <TableCell>Tipo</TableCell>
                <TableCell>Publisher/Subscriber</TableCell>
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
                    <Chip
                      label={user.user_type ? user.user_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.info.main, 0.1),
                        color: theme.palette.info.main,
                      }}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {user.publisher_id && (
                        <Chip
                          label={`Publisher #${user.publisher_id}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {user.subscriber_id && (
                        <Chip
                          label={`Subscriber #${user.subscriber_id}`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                      {!user.publisher_id && !user.subscriber_id && (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                          N/A
                        </Typography>
                      )}
                    </Box>
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
                    <Tooltip title="Gerenciar Flags">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenFlagsDialog(user)}
                        sx={{ color: theme.palette.info.main }}
                      >
                        <AdminPanelSettings />
                      </IconButton>
                    </Tooltip>
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
              onChange={(e) => {
                const value = e.target.value as any;
                setNewUser({ 
                  ...newUser, 
                  role: value
                });
              }}
              label="Função"
            >
              <MenuItem value="owner_system">Owner System</MenuItem>
              <MenuItem value="admin_sql">Admin SQL</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="operador_tecnico">Operador Técnico</MenuItem>
              <MenuItem value="operador_faturamento">Operador Faturamento</MenuItem>
              <MenuItem value="operador_comercial">Operador Comercial</MenuItem>
              <MenuItem value="gerente_marketing">Gerente Marketing</MenuItem>
              <MenuItem value="editoracao">Edição</MenuItem>
              <MenuItem value="visualizador">Visualizador</MenuItem>
              <MenuItem value="user">Usuário</MenuItem>
              <MenuItem value="publisher_user">Publisher</MenuItem>
              <MenuItem value="subscriber_user">Subscriber</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo de Usuário</InputLabel>
            <Select
              value={newUser.userType || 'system_user'}
              onChange={(e) => {
                const value = e.target.value as any;
                setNewUser({ 
                  ...newUser, 
                  userType: value,
                  publisherId: undefined,
                  subscriberId: undefined,
                  isTenantUser: value === 'system_user',
                });
              }}
              label="Tipo de Usuário"
            >
              <MenuItem value="system_user">Sistema</MenuItem>
              <MenuItem value="publisher_user">Publisher</MenuItem>
              <MenuItem value="subscriber_user">Subscriber</MenuItem>
            </Select>
          </FormControl>
          {newUser.userType === 'publisher_user' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Publisher</InputLabel>
              <Select
                value={newUser.publisherId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewUser({ 
                    ...newUser, 
                    publisherId: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label="Publisher"
              >
                <MenuItem value="">Selecione um Publisher</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {newUser.userType === 'subscriber_user' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Anunciante</InputLabel>
              <Select
                value={newUser.subscriberId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewUser({ 
                    ...newUser, 
                    subscriberId: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label="Anunciante"
              >
                <MenuItem value="">Selecione um Subscriber</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {newUser.userType === 'system_user' && (
            <FormControlLabel
              control={
                <Switch
                  checked={newUser.isTenantUser || false}
                  onChange={(e) => setNewUser({ ...newUser, isTenantUser: e.target.checked })}
                />
              }
              label="Usuário Tenant (Admin/Operador do Sistema)"
              sx={{ mt: 1 }}
            />
          )}
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
              onChange={(e) => {
                const value = e.target.value as any;
                setSelectedUser({ 
                  ...selectedUser!, 
                  role: value
                });
              }}
              label="Função"
            >
              <MenuItem value="owner_system">Owner System</MenuItem>
              <MenuItem value="admin_sql">Admin SQL</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="operador_tecnico">Operador Técnico</MenuItem>
              <MenuItem value="operador_faturamento">Operador Faturamento</MenuItem>
              <MenuItem value="operador_comercial">Operador Comercial</MenuItem>
              <MenuItem value="gerente_marketing">Gerente Marketing</MenuItem>
              <MenuItem value="editoracao">Edição</MenuItem>
              <MenuItem value="visualizador">Visualizador</MenuItem>
              <MenuItem value="user">Usuário</MenuItem>
              <MenuItem value="publisher_user">Publisher</MenuItem>
              <MenuItem value="subscriber_user">Subscriber</MenuItem>
              {/* Removido: publisher_subscriber não existe no domínio */}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo de Usuário</InputLabel>
            <Select
              value={selectedUser?.user_type || 'system_user'}
              onChange={(e) => {
                const value = e.target.value as any;
                setSelectedUser({ 
                  ...selectedUser!, 
                  user_type: value,
                  publisher_id: value !== 'publisher_user' ? undefined : selectedUser?.publisher_id,
                  subscriber_id: value !== 'subscriber_user' ? undefined : selectedUser?.subscriber_id,
                  is_tenant_user: value === 'system_user'
                    ? (((selectedUser as any)?.isTenantUser ?? (selectedUser as any)?.is_tenant_user) || false)
                    : false,
                });
              }}
              label="Tipo de Usuário"
            >
              <MenuItem value="system_user">Sistema</MenuItem>
              <MenuItem value="publisher_user">Publisher</MenuItem>
              <MenuItem value="subscriber_user">Subscriber</MenuItem>
              {/* Removido: publisher_subscriber não existe no domínio */}
            </Select>
          </FormControl>
          {selectedUser?.user_type === 'publisher_user' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Publisher</InputLabel>
              <Select
                value={selectedUser?.publisher_id || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedUser({ 
                    ...selectedUser!, 
                    publisher_id: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label="Publisher"
              >
                <MenuItem value="">Selecione um Publisher</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {selectedUser?.user_type === 'subscriber_user' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Anunciante</InputLabel>
              <Select
                value={selectedUser?.subscriber_id || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedUser({ 
                    ...selectedUser!, 
                    subscriber_id: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label="Anunciante"
              >
                <MenuItem value="">Selecione um Subscriber</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {selectedUser?.user_type === 'system_user' && (
            <FormControlLabel
              control={
                <Switch
                  checked={(((selectedUser as any)?.isTenantUser ?? (selectedUser as any)?.is_tenant_user) || false)}
                  onChange={(e) => setSelectedUser({ ...selectedUser!, is_tenant_user: e.target.checked })}
                />
              }
              label="Usuário Tenant (Admin/Operador do Sistema)"
              sx={{ mt: 1 }}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={selectedUser?.is_active || false}
                onChange={(e) => setSelectedUser({ ...selectedUser!, is_active: e.target.checked })}
              />
            }
            label="Usuário Ativo"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditUser}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Flags Dialog */}
      <Dialog open={flagsDialogOpen} onClose={() => setFlagsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Gerenciar Flags - {selectedUser?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: theme.palette.text.secondary }}>
            Configure as permissões específicas deste usuário. As flags sobrescrevem as permissões padrão da role.
          </Typography>
          <Grid container spacing={2}>
            {selectedUserFlags && Object.entries(selectedUserFlags).map(([flagName, value]) => (
              <Grid item xs={12} sm={6} key={flagName}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={value}
                      onChange={(e) => {
                        setSelectedUserFlags({
                          ...selectedUserFlags,
                          [flagName]: e.target.checked,
                        });
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {flagName.replace('flag_smart_', 'Flag ').toUpperCase()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {flagName === 'flag_smart_0' && 'Acesso técnico (totens, Smart TVs, players)'}
                        {flagName === 'flag_smart_1' && 'OTA Updates'}
                        {flagName === 'flag_smart_2' && 'Admin Tools'}
                        {flagName === 'flag_smart_3' && 'Faturamento'}
                        {flagName.startsWith('flag_smart_') && !['flag_smart_0', 'flag_smart_1', 'flag_smart_2', 'flag_smart_3'].includes(flagName) && 'Reservado'}
                      </Typography>
                    </Box>
                  }
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFlagsDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveFlags}>Salvar Flags</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;
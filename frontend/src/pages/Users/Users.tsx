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
import { isStudioMode } from '../../config/studioMode';
import { getProductTerminology } from '../../config/productTerminology';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  applyRoleToCreateUser,
  applyRoleToUserRecord,
  isPublisherScopedRole,
  isSubscriberScopedRole,
  isSystemScopedRole,
  normalizeAppRole,
  sanitizeCreateUserPayload,
  sanitizeUpdateUserPayload,
  userTypeForRole,
  validateCreateUserPayload,
} from '../../utils/userRoleUserType';
import UserRolePicker, { UserRoleFilterSelect } from '../../components/Users/UserRolePicker';
import { useAppSelector } from '../../store';
import { isDirectTotemMode } from '../../config/directTotemMode';
import { getUserFlagLabel } from '../../utils/userFlagLabels';

const userDialogProps = {
  disableEnforceFocus: true,
  fullWidth: true,
  maxWidth: 'sm' as const,
};

const USER_TYPE_LABEL_PT: Record<string, string> = {
  publisher_user: 'Usuário da organização',
  subscriber_user: 'Anunciante',
  system_user: 'Sistema',
};

const Users: React.FC = () => {
  const orgTerms = getProductTerminology();
  const theme = useTheme();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const directTotem = isDirectTotemMode();
  const rolePickerOpts = {
    actorRole: currentUser?.role,
    directTotem,
  };
  const formatUserTypeDisplay = (userType?: string | null) =>
    userType ? USER_TYPE_LABEL_PT[userType] || userType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'N/A';
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
  const [dialogError, setDialogError] = useState<string | null>(null);

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
      setError(pickApiErrorMessage(error, 'Erro ao carregar lista de usuários'));
    } finally {
      setLoading(false);
    }
  };

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: true });
      setPublishers(response.data || []);
    } catch (error) {
    }
  };

  const handleCreateUser = async () => {
    const payload = sanitizeCreateUserPayload(newUser);
    const validationError = validateCreateUserPayload(payload);
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    try {
      setDialogError(null);
      await userApi.create(payload);
      setCreateDialogOpen(false);
      setDialogError(null);
      setNewUser({
        username: '',
        email: '',
        password: '',
        name: '',
        role: 'user',
        userType: 'system_user',
        isTenantUser: true,
        flags: undefined,
      });
      loadUsers();
    } catch (error) {
      setDialogError(pickApiErrorMessage(error, 'Erro ao criar usuário'));
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    const payload = sanitizeUpdateUserPayload(selectedUser);
    if (isPublisherScopedRole(payload.role) && !payload.publisherId) {
      setDialogError('Selecione uma organização para usuários da organização.');
      return;
    }
    if (isSubscriberScopedRole(payload.role) && !payload.subscriberId) {
      setDialogError('Selecione um anunciante para usuários anunciantes.');
      return;
    }

    try {
      setDialogError(null);
      await userApi.update(selectedUser.user_id, payload);
      setEditDialogOpen(false);
      setDialogError(null);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      setDialogError(pickApiErrorMessage(error, 'Erro ao atualizar usuário'));
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await userApi.delete(id);
        loadUsers();
      } catch (error) {
        setError(pickApiErrorMessage(error, 'Erro ao excluir usuário'));
      }
    }
  };

  const handleOpenFlagsDialog = async (user: User) => {
    try {
      setError(null);
      setSelectedUser(user);
      const flags = await userApi.getFlags(user.user_id);
      setSelectedUserFlags(flags);
      setFlagsDialogOpen(true);
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar flags do usuário'));
    }
  };

  const handleSaveFlags = async () => {
    if (!selectedUser || !selectedUserFlags) return;
    
    try {
      setError(null);
      await userApi.updateFlags(selectedUser.user_id, selectedUserFlags);
      setFlagsDialogOpen(false);
      setSelectedUser(null);
      setSelectedUserFlags(null);
      loadUsers();
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao salvar flags'));
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
            onClick: () => {
              setDialogError(null);
              setCreateDialogOpen(true);
            },
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
              <UserRoleFilterSelect
                value={roleFilter}
                onChange={setRoleFilter}
                organizationLabel={orgTerms.organization}
                includeAll
              />
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
                  <MenuItem value="publisher_user">Usuário da organização</MenuItem>
                  <MenuItem value="subscriber_user">Anunciante</MenuItem>
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
                <TableCell>{isStudioMode() ? 'Escopo' : `${orgTerms.organization} / Anunciante`}</TableCell>
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
                      label={formatUserTypeDisplay(user.user_type)}
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
                          label={
                            isStudioMode()
                              ? 'Instalação principal'
                              : `${orgTerms.organization} #${user.publisher_id}`
                          }
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {user.subscriber_id && (
                        <Chip
                          label={`Anunciante #${user.subscriber_id}`}
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
                      color={user.is_active ? 'success' : 'warning'}
                      variant="outlined"
                      sx={!user.is_active ? { fontWeight: 700 } : undefined}
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
                          setDialogError(null);
                          setSelectedUser({ ...user, role: normalizeAppRole(user.role) });
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
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setDialogError(null);
        }}
        {...userDialogProps}
      >
        <DialogTitle>Adicionar Usuário</DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          {dialogError && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }} onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}
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
          <UserRolePicker
            value={newUser.role}
            onChange={(role) => {
              setDialogError(null);
              setNewUser(applyRoleToCreateUser(newUser, role));
            }}
            organizationLabel={orgTerms.organization}
            actorRole={rolePickerOpts.actorRole}
            directTotem={rolePickerOpts.directTotem}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
            Tipo de usuário: <strong>{formatUserTypeDisplay(userTypeForRole(newUser.role))}</strong>
          </Typography>
          {isPublisherScopedRole(newUser.role) && (
            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>{orgTerms.organization}</InputLabel>
              <Select
                value={newUser.publisherId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewUser({ 
                    ...newUser, 
                    publisherId: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label={orgTerms.organization}
              >
                <MenuItem value="">Selecione uma {orgTerms.organization.toLowerCase()}</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {isSubscriberScopedRole(newUser.role) && (
            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>Anunciante</InputLabel>
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
                <MenuItem value="">Selecione um Anunciante</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {isSystemScopedRole(newUser.role) && (
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
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setDialogError(null);
        }}
        {...userDialogProps}
      >
        <DialogTitle>Editar Usuário</DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          {dialogError && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }} onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}
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
          <UserRolePicker
            value={selectedUser?.role || 'user'}
            onChange={(role) => {
              setDialogError(null);
              setSelectedUser(applyRoleToUserRecord(selectedUser!, role));
            }}
            organizationLabel={orgTerms.organization}
            actorRole={rolePickerOpts.actorRole}
            directTotem={rolePickerOpts.directTotem}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
            Tipo de usuário:{' '}
            <strong>{formatUserTypeDisplay(userTypeForRole(selectedUser?.role || 'user'))}</strong>
          </Typography>
          {isPublisherScopedRole(selectedUser?.role || '') && (
            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>{orgTerms.organization}</InputLabel>
              <Select
                value={selectedUser?.publisher_id || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedUser({ 
                    ...selectedUser!, 
                    publisher_id: value && value !== '' ? parseInt(String(value), 10) : undefined 
                  });
                }}
                label={orgTerms.organization}
              >
                <MenuItem value="">Selecione uma {orgTerms.organization.toLowerCase()}</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {isSubscriberScopedRole(selectedUser?.role || '') && (
            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>Anunciante</InputLabel>
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
                <MenuItem value="">Selecione um Anunciante</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {isSystemScopedRole(selectedUser?.role || '') && (
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
            {selectedUserFlags && Object.entries(selectedUserFlags).map(([flagName, value]) => {
              const flagLabel = getUserFlagLabel(flagName);
              return (
              <Grid item xs={12} sm={6} key={flagName}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(value)}
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
                        {flagLabel.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {flagLabel.description}
                      </Typography>
                    </Box>
                  }
                />
              </Grid>
              );
            })}
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
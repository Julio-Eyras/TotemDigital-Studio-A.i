import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi, LoginResponse } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner_system' | 'admin' | 'admin_sql' | 'manager' | 'operator' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'publisher_user' | 'subscriber_user';
  isActive: boolean;
  // Compat: backend em transição entre snake_case e camelCase para flag tenant
  isTenantUser?: boolean;
  is_tenant_user?: boolean;
  user_type?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO: Tipo de usuário para detecção automática
  subscriberId?: number; // NOVO: ID do subscriber (anunciante)
  clientId?: number; // DEPRECATED: Usar subscriberId - mantido para compatibilidade
  publisherId?: number; // NOVO: ID do publisher (publicador)
  subscriberName?: string; // NOVO: Nome do subscriber
  flags?: UserFlags; // NOVO: Flags de permissão do usuário
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/** Hidrata Redux após F5: o layout já usa localStorage, mas páginas como Totems usam state.auth.user. */
function parseStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as Partial<User>;
    if (!u || typeof u !== 'object' || typeof u.role !== 'string') return null;
    return u as User;
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('token');
const storedRefreshToken = localStorage.getItem('refreshToken');
const storedUser = parseStoredUser();

const initialState: AuthState = {
  user: storedUser,
  token: storedToken,
  refreshToken: storedRefreshToken,
  isAuthenticated: Boolean(storedToken && storedUser),
  isLoading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk<LoginResponse, { username: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      return response;
    } catch (error: any) {
      return rejectWithValue(pickApiErrorMessage(error, 'Erro ao fazer login'));
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (state.auth.token) {
        await authApi.logout();
      }
      return null;
    } catch (error: any) {
      return rejectWithValue(pickApiErrorMessage(error, 'Erro ao fazer logout'));
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await authApi.refreshToken(state.auth.refreshToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Erro ao renovar token');
    }
  }
);

export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.token) {
        throw new Error('No token available');
      }
      
      const response = await authApi.getProfile();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Token inválido');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData: Partial<User>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.token) {
        throw new Error('No token available');
      }
      
      const response = await authApi.updateProfile(state.auth.token, profileData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Erro ao atualizar perfil');
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (passwordData: { currentPassword: string; newPassword: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.token) {
        throw new Error('No token available');
      }
      
      const response = await authApi.changePassword(state.auth.token, passwordData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Erro ao alterar senha');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // Verificar se login foi bem-sucedido e tem dados necessários
        if (action.payload.success === false || !action.payload.token || !action.payload.user) {
          state.error = action.payload.error || 'Erro ao fazer login';
          state.isAuthenticated = false;
          return;
        }
        
        // Garantir que o role seja um dos valores permitidos e mapear campos
        const apiUser = action.payload.user;
        if (!apiUser) {
          throw new Error('User data not found in login response');
        }
        
        const userRole = (apiUser as any).role as string;
        let mappedRole: 'admin' | 'admin_sql' | 'manager' | 'operator' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'owner_system' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'publisher_user' | 'subscriber_user' = 'operator';
        
        if (userRole === 'admin' || userRole === 'admin_sql' || userRole === 'owner_system') {
          mappedRole = userRole === 'admin_sql' ? 'admin_sql' : userRole === 'owner_system' ? 'owner_system' : 'admin';
        } else if (userRole === 'user') {
          mappedRole = 'operator';
        } else if (['gerente_marketing', 'editoracao', 'visualizador', 'operador_tecnico', 'operador_faturamento', 'operador_comercial', 'publisher_user', 'subscriber_user'].includes(userRole)) {
          mappedRole = userRole as any;
        } else {
          // Fallback: manter role original ou usar 'operator'
          mappedRole = (userRole as any) || 'operator';
        }
        
        // Extrair ID (pode vir como id, user_id, ou userId)
        const userId = (apiUser as any).id || (apiUser as any).user_id || (apiUser as any).userId || 0;
        const isTenantUser = Boolean(
          (apiUser as any).isTenantUser ??
          (apiUser as any).is_tenant_user ??
          ((apiUser as any).user_type === 'system_user') ??
          ((apiUser as any).userType === 'system_user')
        );
        
        state.user = {
          id: userId,
          name: (apiUser as any).name || (apiUser as any).username || '',
          email: (apiUser as any).email || '',
          role: mappedRole,
          isActive: (apiUser as any).is_active !== undefined ? (apiUser as any).is_active : (apiUser as any).isActive !== undefined ? (apiUser as any).isActive : true,
          isTenantUser,
          is_tenant_user: isTenantUser,
          user_type: (apiUser as any).user_type || (apiUser as any).userType, // NOVO: Salvar user_type
          subscriberId: (apiUser as any).subscriberId || (apiUser as any).subscriber_id || (apiUser as any).client_id || (apiUser as any).clientId,
          publisherId: (apiUser as any).publisherId || (apiUser as any).publisher_id,
          subscriberName: (apiUser as any).subscriberName || (apiUser as any).subscriber_name,
          flags: (apiUser as any).flags, // NOVO: Flags de permissão
          createdAt: (apiUser as any).created_at || (apiUser as any).createdAt || new Date().toISOString(),
          updatedAt: (apiUser as any).updated_at || (apiUser as any).updatedAt || new Date().toISOString(),
        };
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken || '';
        state.isAuthenticated = true;
        state.error = null;
        
        // Salvar tokens e dados do usuário no localStorage
        if (action.payload.token) {
          localStorage.setItem('token', action.payload.token);
        }
        if (action.payload.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.refreshToken);
        }
        // Salvar user completo no localStorage (incluindo user_type)
        localStorage.setItem('user', JSON.stringify(state.user));
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
        
        // Remover tokens do localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        
        // Mesmo com erro, limpar dados locais
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })
      
      // Refresh Token
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        
        // Atualizar tokens no localStorage
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      })
      .addCase(refreshToken.rejected, (state) => {
        // Se refresh falhar, fazer logout
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })
      
      // Check Auth Status
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        // Garantir que o role seja um dos valores permitidos e mapear campos
        const apiUser = action.payload;
        const isTenantUser = Boolean(
          (apiUser as any).isTenantUser ??
          (apiUser as any).is_tenant_user ??
          ((apiUser as any).user_type === 'system_user') ??
          ((apiUser as any).userType === 'system_user')
        );
        state.user = {
          id: apiUser.user_id || 0,
          name: apiUser.name || '',
          email: apiUser.email || '',
          role: apiUser.role === 'admin'
            ? 'admin' as const
            : apiUser.role === 'user'
            ? 'operator' as const
            : apiUser.role as any, // Manter o role original do backend
          isActive: apiUser.is_active !== undefined ? apiUser.is_active : true,
          isTenantUser,
          is_tenant_user: isTenantUser,
          user_type: (apiUser as any).user_type || (apiUser as any).userType, // NOVO: Extrair user_type
          subscriberId: (apiUser as any).subscriberId || (apiUser as any).subscriber_id, // NOVO
          clientId: (apiUser as any).subscriberId || (apiUser as any).subscriber_id, // DEPRECADO: compatibilidade
          publisherId: (apiUser as any).publisherId || (apiUser as any).publisher_id,
          subscriberName: (apiUser as any).subscriberName || (apiUser as any).subscriber_name,
          flags: (apiUser as any).flags, // NOVO: Flags de permissão
          createdAt: apiUser.created_at || new Date().toISOString(),
          updatedAt: apiUser.updated_at || new Date().toISOString(),
        };
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        
        // Limpar tokens inválidos
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })
      
      // Update Profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        // Garantir que o role seja um dos valores permitidos e mapear campos
        const apiUser = action.payload;
        const isTenantUser = Boolean(
          (apiUser as any).isTenantUser ??
          (apiUser as any).is_tenant_user ??
          ((apiUser as any).user_type === 'system_user') ??
          ((apiUser as any).userType === 'system_user') ??
          (state.user?.isTenantUser ?? state.user?.is_tenant_user)
        );
        state.user = {
          id: apiUser.user_id || state.user?.id || 0,
          name: apiUser.name || state.user?.name || '',
          email: apiUser.email || state.user?.email || '',
          role: apiUser.role === 'admin' 
            ? 'admin' as const
            : apiUser.role === 'user'
            ? 'operator' as const
            : (apiUser.role as any) || (state.user?.role || 'operator') as any,
          isActive: apiUser.is_active !== undefined ? apiUser.is_active : (state.user?.isActive ?? true),
          isTenantUser,
          is_tenant_user: isTenantUser,
          user_type: (apiUser as any).user_type || (apiUser as any).userType || state.user?.user_type, // NOVO: Extrair user_type
          subscriberId: (apiUser as any).subscriberId || (apiUser as any).subscriber_id || state.user?.subscriberId,
          clientId: (apiUser as any).subscriberId || (apiUser as any).subscriber_id || state.user?.clientId, // DEPRECADO: compatibilidade
          publisherId: (apiUser as any).publisherId || (apiUser as any).publisher_id || state.user?.publisherId,
          subscriberName: (apiUser as any).subscriberName || (apiUser as any).subscriber_name || state.user?.subscriberName,
          flags: (apiUser as any).flags || state.user?.flags, // NOVO: Flags de permissão
          createdAt: apiUser.created_at || state.user?.createdAt || new Date().toISOString(),
          updatedAt: apiUser.updated_at || state.user?.updatedAt || new Date().toISOString(),
        };
      })
      
      // Change Password
      .addCase(changePassword.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearAuth } = authSlice.actions;
export { authSlice };

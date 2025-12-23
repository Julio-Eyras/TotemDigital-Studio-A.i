import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi, LoginResponse } from '../../services/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  isActive: boolean;
  clientId?: number;
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

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
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
      return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Erro ao fazer login');
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
      return rejectWithValue(error.response?.data?.message || 'Erro ao fazer logout');
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
        state.user = {
          id: apiUser.user_id || 0,
          name: apiUser.name || '',
          email: apiUser.email || '',
          role: apiUser.role === 'admin' 
            ? 'admin' as const
            : apiUser.role === 'user' || apiUser.role === 'client'
            ? 'operator' as const
            : 'operator' as const,
          isActive: apiUser.is_active !== undefined ? apiUser.is_active : true,
          clientId: apiUser.client_id,
          createdAt: apiUser.created_at || new Date().toISOString(),
          updatedAt: apiUser.updated_at || new Date().toISOString(),
        };
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken || '';
        state.isAuthenticated = true;
        state.error = null;
        
        // Salvar tokens no localStorage
        if (action.payload.token) {
          localStorage.setItem('token', action.payload.token);
        }
        if (action.payload.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.refreshToken);
        }
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
      })
      
      // Check Auth Status
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        // Garantir que o role seja um dos valores permitidos e mapear campos
        const apiUser = action.payload;
        state.user = {
          id: apiUser.user_id || 0,
          name: apiUser.name || '',
          email: apiUser.email || '',
          role: apiUser.role === 'admin' 
            ? 'admin' as const
            : apiUser.role === 'user' || apiUser.role === 'client'
            ? 'operator' as const
            : 'operator' as const,
          isActive: apiUser.is_active !== undefined ? apiUser.is_active : true,
          clientId: apiUser.client_id,
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
        state.token = null;
        state.refreshToken = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      })
      
      // Update Profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        // Garantir que o role seja um dos valores permitidos e mapear campos
        const apiUser = action.payload;
        state.user = {
          id: apiUser.user_id || state.user?.id || 0,
          name: apiUser.name || state.user?.name || '',
          email: apiUser.email || state.user?.email || '',
          role: apiUser.role === 'admin' 
            ? 'admin' as const
            : apiUser.role === 'user' || apiUser.role === 'client'
            ? 'operator' as const
            : (state.user?.role || 'operator') as 'admin' | 'manager' | 'operator',
          isActive: apiUser.is_active !== undefined ? apiUser.is_active : (state.user?.isActive ?? true),
          clientId: apiUser.client_id ?? state.user?.clientId,
          createdAt: apiUser.created_at || state.user?.createdAt || new Date().toISOString(),
          updatedAt: apiUser.updated_at || new Date().toISOString(),
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

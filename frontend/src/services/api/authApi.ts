import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Configuração base do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com respostas e refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Retry a requisição original
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Se refresh falhar, redirecionar para login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    clientId?: number;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface ProfileResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  clientId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SubscriberLoginRequest {
  email: string;
  password: string;
}

export interface SubscriberLoginResponse {
  message: string;
  token: string;
  refreshToken?: string;
  user: {
    id: number;
    username: string;
    role: string;
    subscriberId?: number;
    publisherId?: number;
    subscriberName?: string;
    clientId?: number;
  };
}

export const authApi = {
  login: async (credentials: LoginRequest) => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response;
  },

  subscriberLogin: async (credentials: SubscriberLoginRequest) => {
    const response = await api.post<SubscriberLoginResponse>('/auth/subscriber-login', credentials);
    return response;
  },

  logout: async (token: string) => {
    const response = await api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post<RefreshTokenResponse>('/auth/refresh', {
      refreshToken,
    });
    return response;
  },

  getProfile: async (token: string) => {
    const response = await api.get<ProfileResponse>('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  },

  updateProfile: async (token: string, profileData: UpdateProfileRequest) => {
    const response = await api.put<ProfileResponse>('/auth/profile', profileData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  },

  changePassword: async (token: string, passwordData: ChangePasswordRequest) => {
    const response = await api.put('/auth/change-password', passwordData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response;
  },
};

export { api };

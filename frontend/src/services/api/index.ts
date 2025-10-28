import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Configurar axios com interceptors
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
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

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Interfaces para Media
export interface MediaItem {
  media_id: number;
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  media_type: 'image' | 'video' | 'audio';
  file_path: string;
  preview_url?: string;
  size_bytes: number;
  duration_seconds?: number;
  mime_type: string;
  width?: number;
  height?: number;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface CreateMediaRequest {
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  clientId?: number;
  file: File;
}

export interface MediaListResponse {
  data: MediaItem[];
  total: number;
  page: number;
  limit: number;
}

// Interfaces para Playlists
export interface PlaylistItem {
  playlist_id: number;
  name: string;
  description?: string;
  client_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_count?: number;
  total_duration?: number;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  clientId?: number;
}

export interface PlaylistMediaItem {
  item_id: number;
  playlist_id: number;
  media_id: number;
  order_index: number;
  duration: number;
  media: MediaItem;
}

// Interfaces para Users
export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  client_id?: number;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  clientId?: number;
}

// Interfaces para Clients
export interface Client {
  client_id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Interfaces para Players/Totems
export interface Player {
  totem_id: number;
  name: string;
  location?: string;
  client_id?: number;
  is_active: boolean;
  last_heartbeat?: string;
  current_playlist_id?: number;
  status: 'online' | 'offline' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreatePlayerRequest {
  name: string;
  location?: string;
  clientId?: number;
}

// APIs para Media
export const mediaApi = {
  // Listar mídia
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    clientId?: number;
  }): Promise<MediaListResponse> => {
    const response = await api.get('/media', { params });
    return response.data;
  },

  // Obter mídia por ID
  getById: async (id: number): Promise<MediaItem> => {
    const response = await api.get(`/media/${id}`);
    return response.data;
  },

  // Upload de arquivo
  upload: async (data: CreateMediaRequest): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('name', data.name);
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.clientId) formData.append('clientId', data.clientId.toString());

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload múltiplo
  uploadMultiple: async (files: File[], clientId?: number): Promise<MediaItem[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (clientId) formData.append('clientId', clientId.toString());

    const response = await api.post('/media/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Atualizar mídia
  update: async (id: number, data: Partial<CreateMediaRequest>): Promise<MediaItem> => {
    const response = await api.put(`/media/${id}`, data);
    return response.data;
  },

  // Excluir mídia
  delete: async (id: number): Promise<void> => {
    await api.delete(`/media/${id}`);
  },
};

// APIs para Playlists
export const playlistApi = {
  // Listar playlists
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    clientId?: number;
  }): Promise<{ data: PlaylistItem[]; total: number }> => {
    const response = await api.get('/playlists', { params });
    return response.data;
  },

  // Obter playlist por ID
  getById: async (id: number): Promise<PlaylistItem> => {
    const response = await api.get(`/playlists/${id}`);
    return response.data;
  },

  // Criar playlist
  create: async (data: CreatePlaylistRequest): Promise<PlaylistItem> => {
    const response = await api.post('/playlists', data);
    return response.data;
  },

  // Atualizar playlist
  update: async (id: number, data: Partial<CreatePlaylistRequest>): Promise<PlaylistItem> => {
    const response = await api.put(`/playlists/${id}`, data);
    return response.data;
  },

  // Excluir playlist
  delete: async (id: number): Promise<void> => {
    await api.delete(`/playlists/${id}`);
  },

  // Obter mídia da playlist
  getMedia: async (id: number): Promise<PlaylistMediaItem[]> => {
    const response = await api.get(`/playlists/${id}/media`);
    return response.data;
  },

  // Adicionar mídia à playlist
  addMedia: async (playlistId: number, mediaId: number, orderIndex?: number, duration?: number): Promise<void> => {
    await api.post(`/playlists/${playlistId}/media`, {
      mediaId,
      orderIndex,
      duration,
    });
  },

  // Remover mídia da playlist
  removeMedia: async (playlistId: number, itemId: number): Promise<void> => {
    await api.delete(`/playlists/${playlistId}/media/${itemId}`);
  },

  // Reordenar mídia da playlist
  reorderMedia: async (playlistId: number, items: { itemId: number; orderIndex: number }[]): Promise<void> => {
    await api.put(`/playlists/${playlistId}/media/reorder`, { items });
  },
};

// APIs para Users
export const userApi = {
  // Listar usuários
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    clientId?: number;
  }): Promise<{ data: User[]; total: number }> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Obter usuário por ID
  getById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Criar usuário
  create: async (data: CreateUserRequest): Promise<User> => {
    const response = await api.post('/users', data);
    return response.data;
  },

  // Atualizar usuário
  update: async (id: number, data: Partial<CreateUserRequest>): Promise<User> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  // Excluir usuário
  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

// APIs para Clients
export const clientApi = {
  // Listar clientes
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: Client[]; total: number }> => {
    const response = await api.get('/clients', { params });
    return response.data;
  },

  // Obter cliente por ID
  getById: async (id: number): Promise<Client> => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  // Criar cliente
  create: async (data: CreateClientRequest): Promise<Client> => {
    const response = await api.post('/clients', data);
    return response.data;
  },

  // Atualizar cliente
  update: async (id: number, data: Partial<CreateClientRequest>): Promise<Client> => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  // Excluir cliente
  delete: async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

// APIs para Players
export const playerApi = {
  // Listar players
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    clientId?: number;
    status?: string;
  }): Promise<{ data: Player[]; total: number }> => {
    const response = await api.get('/players', { params });
    return response.data;
  },

  // Obter player por ID
  getById: async (id: number): Promise<Player> => {
    const response = await api.get(`/players/${id}`);
    return response.data;
  },

  // Criar player
  create: async (data: CreatePlayerRequest): Promise<Player> => {
    const response = await api.post('/players', data);
    return response.data;
  },

  // Atualizar player
  update: async (id: number, data: Partial<CreatePlayerRequest>): Promise<Player> => {
    const response = await api.put(`/players/${id}`, data);
    return response.data;
  },

  // Excluir player
  delete: async (id: number): Promise<void> => {
    await api.delete(`/players/${id}`);
  },

  // Atribuir playlist ao player
  assignPlaylist: async (playerId: number, playlistId: number): Promise<void> => {
    await api.post(`/players/${playerId}/playlist`, { playlistId });
  },

  // Obter status do player
  getStatus: async (id: number): Promise<{ status: string; lastHeartbeat: string; currentPlaylist?: PlaylistItem }> => {
    const response = await api.get(`/players/${id}/status`);
    return response.data;
  },
};

// APIs para Dashboard
export const dashboardApi = {
  // Obter estatísticas do dashboard
  getStats: async (): Promise<{
    totalMedia: number;
    totalPlaylists: number;
    totalPlayers: number;
    totalUsers: number;
    activePlayers: number;
    offlinePlayers: number;
  }> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  // Obter atividades recentes
  getRecentActivity: async (limit?: number): Promise<any[]> => {
    const response = await api.get('/dashboard/activity', { params: { limit } });
    return response.data;
  },
};

export default api;

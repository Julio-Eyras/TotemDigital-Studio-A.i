/**
 * Tipos de Entidades - Smart Signage Pro v3.1
 * Tipos para entidades do domínio
 */

/**
 * Entidade base
 */
export interface BaseEntity {
  id: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Entidade com cliente
 */
export interface ClientEntity extends BaseEntity {
  clientId: number;
}

/**
 * Entidade ativável
 */
export interface ActivatableEntity extends BaseEntity {
  isActive: boolean;
}

/**
 * Entidade completa
 */
export interface FullEntity extends ClientEntity, ActivatableEntity {}

/**
 * Usuário
 */
export interface User extends BaseEntity {
  username: string;
  email: string;
  name?: string;
  role: string;
  clientId?: number;
  isActive: boolean;
  lastLogin?: string | Date;
}

/**
 * Cliente
 */
export interface Client extends BaseEntity {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

/**
 * Totem
 */
export interface Totem extends FullEntity {
  name?: string;
  identifier: string;
  deviceId?: string;
  localId?: string;
  location?: string;
  status: string;
  lastHeartbeat?: string | Date;
}

/**
 * Mídia
 */
export interface Media extends FullEntity {
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  size: number;
  metadata?: Record<string, unknown>;
}

/**
 * Playlist
 */
export interface Playlist extends FullEntity {
  name: string;
  description?: string;
  totemId?: number;
  campaignId?: number;
  items?: PlaylistItem[];
}

/**
 * Item de Playlist
 */
export interface PlaylistItem extends BaseEntity {
  playlistId: number;
  mediaId: number;
  orderIndex: number;
  duration?: number;
}

/**
 * Campanha
 */
export interface Campaign extends FullEntity {
  name: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Relatório
 */
export interface Report extends BaseEntity {
  name: string;
  type: string;
  format: string;
  status: string;
  filePath?: string;
  generatedAt?: string | Date;
  createdBy: number;
  metadata?: Record<string, unknown>;
}

/**
 * Analytics
 */
export interface AnalyticsData {
  totalViews: number;
  totalPlays: number;
  averageDuration: number;
  uniqueViewers: number;
  dateRange: {
    start: string | Date;
    end: string | Date;
  };
}


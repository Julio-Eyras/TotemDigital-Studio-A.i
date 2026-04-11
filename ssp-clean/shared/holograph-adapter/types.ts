/**
 * Tipos compartilhados para grafo e rede SmartSignage (HoloGraph).
 * Usado por frontend e holograph-engine.
 */
export interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  meta?: Record<string, unknown>;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  type?: string;
  meta?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type ScheduleTargetType = 'publisher' | 'location' | 'totem' | 'smarttv';

export interface ScheduleSlot {
  targetId: string;
  targetType: ScheduleTargetType;
  dayOfWeek?: number[];
  startTime?: string;
  endTime?: string;
}

export interface SmartSignageNetwork {
  publishers: Array<{
    id: string;
    name: string;
    locations?: Array<{
      id: string;
      publisherId: string;
      name: string;
      address?: string;
      totems?: Array<{ id: string; locationId: string; name: string }>;
      smartTvs?: Array<{ id: string; locationId: string; name: string }>;
    }>;
  }>;
  subscribers: Array<{
    id: string;
    name: string;
    media?: Array<{ id: string; subscriberId: string; name: string; type?: string; url?: string }>;
    playlists?: Array<{ id: string; subscriberId: string; name: string; mediaIds?: string[] }>;
    campaigns?: Array<{ id: string; subscriberId: string; name: string; playlistIds?: string[] }>;
  }>;
  scheduleAssignments: Array<{
    id: string;
    sourceId: string;
    sourceType: 'playlist' | 'campaign';
    slots: ScheduleSlot[];
  }>;
}

/** Cores por tipo de nó para o grafo. */
export const NODE_TYPE_COLORS: Record<string, string> = {
  publisher: 'rgba(33, 150, 243, 0.85)',
  location: 'rgba(33, 150, 243, 0.5)',
  totem: 'rgba(76, 175, 80, 0.85)',
  smarttv: 'rgba(76, 175, 80, 0.6)',
  subscriber: 'rgba(156, 39, 176, 0.85)',
  media: 'rgba(156, 39, 176, 0.5)',
  playlist: 'rgba(255, 152, 0, 0.85)',
  campaign: 'rgba(255, 87, 34, 0.85)',
  schedule: 'rgba(0, 188, 212, 0.7)',
};

export const NODE_TYPE_LABELS: Record<string, string> = {
  publisher: 'Publicador',
  location: 'Local',
  totem: 'Totem',
  smarttv: 'Smart TV',
  subscriber: 'Anunciante',
  media: 'Mídia',
  playlist: 'Playlist',
  campaign: 'Campanha',
  schedule: 'Agenda',
};

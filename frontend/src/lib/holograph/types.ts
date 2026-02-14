/**
 * Tipos para grafo e rede SmartSignage (compatível com holograph-engine).
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

/** Cores por tipo de nó para o grafo (exibidores vs anunciantes vs agendamento). */
export const NODE_TYPE_COLORS: Record<string, string> = {
  publisher: 'rgba(33, 150, 243, 0.85)',   // azul - exibidor
  location: 'rgba(33, 150, 243, 0.5)',
  totem: 'rgba(76, 175, 80, 0.85)',       // verde - dispositivo
  smarttv: 'rgba(76, 175, 80, 0.6)',
  subscriber: 'rgba(156, 39, 176, 0.85)', // roxo - anunciante
  media: 'rgba(156, 39, 176, 0.5)',
  playlist: 'rgba(255, 152, 0, 0.85)',    // laranja
  campaign: 'rgba(255, 87, 34, 0.85)',    // laranja escuro
  schedule: 'rgba(0, 188, 212, 0.7)',     // ciano - agendamento
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
    slots: Array<{
      targetId: string;
      targetType: 'location' | 'totem' | 'smarttv';
      dayOfWeek?: number[];
      startTime?: string;
      endTime?: string;
    }>;
  }>;
}

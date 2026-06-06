/**
 * Tipos base do grafo (holograph-engine)
 */
export interface GraphNode {
  id: string
  label?: string
  type?: string
  meta?: Record<string, unknown>
  x?: number
  y?: number
  fx?: number
  fy?: number
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
  type?: string
  meta?: Record<string, unknown>
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Cores por tipo de nó (SmartSignage / dashboard). */
export const NODE_TYPE_COLORS: Record<string, string> = {
  publisher: 'rgba(33, 150, 243, 0.85)',
  location: 'rgba(33, 150, 243, 0.5)',
  totem: 'rgba(76, 175, 80, 0.85)',
  smarttv: 'rgba(76, 175, 80, 0.6)',
  subscriber: 'rgba(156, 39, 176, 0.85)',
  media: 'rgba(156, 39, 176, 0.5)',
  playlist: 'rgba(255, 152, 0, 0.85)',
  campaign: 'rgba(255, 87, 34, 0.85)',
  schedule: 'rgba(0, 188, 212, 0.7)'
}

export const NODE_TYPE_LABELS: Record<string, string> = {
  publisher: 'Organização',
  location: 'Local',
  totem: 'Totem',
  smarttv: 'Smart TV',
  subscriber: 'Anunciante',
  media: 'Mídia',
  playlist: 'Playlist',
  campaign: 'Campanha',
  schedule: 'Agenda'
}

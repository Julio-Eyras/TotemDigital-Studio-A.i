/**
 * Converte a rede SmartSignage em grafo para holograph-engine.
 * Nodes: publishers, locations, totems, smarttvs, subscribers, media, playlists, campaigns.
 * Edges: hierarquia + designações (playlist/campaign → target por schedule).
 */
import type { GraphNode, GraphEdge, GraphData } from '../types'
import type {
  SmartSignageNetwork,
  Publisher,
  Location,
  Totem,
  SmartTV,
  Subscriber,
  Media,
  Playlist,
  Campaign,
  ScheduleAssignment,
  ScheduleSlot
} from './types'

export interface AdapterOptions {
  includeScheduleAsNodes?: boolean
  includeScheduleEdges?: boolean
  filterDayOfWeek?: number
  filterTime?: string
}

const defaultOptions = {
  includeScheduleAsNodes: false,
  includeScheduleEdges: true
}

function slotMatches(slot: ScheduleSlot, day?: number, time?: string): boolean {
  if (day != null && slot.dayOfWeek?.length && !slot.dayOfWeek.includes(day)) return false
  if (time != null && slot.startTime != null && slot.endTime != null) {
    if (time < slot.startTime || time > slot.endTime) return false
  }
  return true
}

function formatSlotLabel(slot: ScheduleSlot): string {
  const parts: string[] = []
  if (slot.dayOfWeek?.length) parts.push(`D:${slot.dayOfWeek.join(',')}`)
  if (slot.startTime) parts.push(slot.startTime)
  if (slot.endTime) parts.push(slot.endTime)
  return parts.join(' ')
}

export function smartSignageToGraph(
  network: SmartSignageNetwork,
  options: AdapterOptions = {}
): GraphData {
  const opts = { ...defaultOptions, ...options }
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeIds = new Set<string>()

  function addNode(n: GraphNode) {
    if (!nodeIds.has(n.id)) {
      nodeIds.add(n.id)
      nodes.push(n)
    }
  }

  function addEdge(e: GraphEdge) {
    edges.push(e)
  }

  for (const p of network.publishers) {
    addNode({ id: p.id, label: p.name, type: 'publisher', meta: p.meta ?? {} })
    for (const loc of p.locations ?? []) {
      addNode({
        id: loc.id,
        label: loc.name,
        type: 'location',
        meta: { ...loc.meta, publisherId: loc.publisherId, address: loc.address }
      })
      addEdge({ from: p.id, to: loc.id, type: 'has-location' })
      for (const t of loc.totems ?? []) {
        addNode({ id: t.id, label: t.name, type: 'totem', meta: { ...t.meta, locationId: t.locationId } })
        addEdge({ from: loc.id, to: t.id, type: 'has-totem' })
      }
      for (const tv of loc.smartTvs ?? []) {
        addNode({ id: tv.id, label: tv.name, type: 'smarttv', meta: { ...tv.meta, locationId: tv.locationId } })
        addEdge({ from: loc.id, to: tv.id, type: 'has-smarttv' })
      }
    }
  }

  for (const s of network.subscribers) {
    addNode({ id: s.id, label: s.name, type: 'subscriber', meta: s.meta ?? {} })
    for (const m of s.media ?? []) {
      addNode({
        id: m.id,
        label: m.name,
        type: 'media',
        meta: { ...m.meta, subscriberId: m.subscriberId, mediaType: m.type, url: m.url }
      })
      addEdge({ from: s.id, to: m.id, type: 'has-media' })
    }
    for (const pl of s.playlists ?? []) {
      addNode({
        id: pl.id,
        label: pl.name,
        type: 'playlist',
        meta: { ...pl.meta, subscriberId: pl.subscriberId, mediaIds: pl.mediaIds }
      })
      addEdge({ from: s.id, to: pl.id, type: 'has-playlist' })
      for (const mid of pl.mediaIds ?? []) {
        addEdge({ from: pl.id, to: mid, type: 'contains-media' })
      }
    }
    for (const c of s.campaigns ?? []) {
      addNode({
        id: c.id,
        label: c.name,
        type: 'campaign',
        meta: { ...c.meta, subscriberId: c.subscriberId, playlistIds: c.playlistIds }
      })
      addEdge({ from: s.id, to: c.id, type: 'has-campaign' })
      for (const pid of c.playlistIds ?? []) {
        addEdge({ from: c.id, to: pid, type: 'uses-playlist' })
      }
    }
  }

  if (opts.includeScheduleEdges) {
    const filterDay = opts.filterDayOfWeek
    const filterTime = opts.filterTime
    for (const a of network.scheduleAssignments) {
      const slots =
        filterDay != null || filterTime != null
          ? a.slots.filter((s) => slotMatches(s, filterDay, filterTime))
          : a.slots
      for (const slot of slots) {
        const label = opts.filterTime != null ? undefined : formatSlotLabel(slot)
        addEdge({
          from: a.sourceId,
          to: slot.targetId,
          type: 'scheduled',
          label: label || undefined,
          meta: {
            sourceType: a.sourceType,
            targetType: slot.targetType,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        })
      }
    }
  }

  if (opts.includeScheduleAsNodes) {
    for (const a of network.scheduleAssignments) {
      const id = `schedule-${a.id}`
      addNode({ id, label: `Agenda: ${a.sourceId}`, type: 'schedule', meta: a })
      addEdge({ from: a.sourceId, to: id, type: 'scheduled-via' })
      for (const slot of a.slots) {
        addEdge({ from: id, to: slot.targetId, type: 'targets', label: formatSlotLabel(slot) })
      }
    }
  }

  return { nodes, edges }
}

export function createDemoNetwork(): SmartSignageNetwork {
  return {
    publishers: [
      {
        id: 'pub-1',
        name: 'Publisher Centro',
        locations: [
          {
            id: 'loc-1',
            publisherId: 'pub-1',
            name: 'Shopping Centro',
            address: 'Av. Central, 100',
            totems: [
              { id: 'totem-1', locationId: 'loc-1', name: 'Totem Entrada A' },
              { id: 'totem-2', locationId: 'loc-1', name: 'Totem Entrada B' }
            ],
            smartTvs: [{ id: 'tv-1', locationId: 'loc-1', name: 'TV Praça de Alimentação' }]
          }
        ]
      },
      {
        id: 'pub-2',
        name: 'Publisher Norte',
        locations: [
          {
            id: 'loc-2',
            publisherId: 'pub-2',
            name: 'Aeroporto Norte',
            totems: [{ id: 'totem-3', locationId: 'loc-2', name: 'Totem Embarque' }],
            smartTvs: []
          }
        ]
      }
    ],
    subscribers: [
      {
        id: 'sub-1',
        name: 'Subscriber Mídia Plus',
        media: [
          { id: 'mid-1', subscriberId: 'sub-1', name: 'Vídeo Promo A', type: 'video' },
          { id: 'mid-2', subscriberId: 'sub-1', name: 'Banner Verão', type: 'image' }
        ],
        playlists: [
          { id: 'pl-1', subscriberId: 'sub-1', name: 'Playlist Verão', mediaIds: ['mid-1', 'mid-2'] }
        ],
        campaigns: [
          { id: 'camp-1', subscriberId: 'sub-1', name: 'Campanha Verão 2025', playlistIds: ['pl-1'] }
        ]
      }
    ],
    scheduleAssignments: [
      {
        id: 'sched-1',
        sourceId: 'pl-1',
        sourceType: 'playlist',
        slots: [
          {
            targetId: 'totem-1',
            targetType: 'totem',
            dayOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '20:00'
          },
          {
            targetId: 'tv-1',
            targetType: 'smarttv',
            dayOfWeek: [0, 6],
            startTime: '10:00',
            endTime: '22:00'
          }
        ]
      },
      {
        id: 'sched-2',
        sourceId: 'camp-1',
        sourceType: 'campaign',
        slots: [
          {
            targetId: 'loc-1',
            targetType: 'location',
            dayOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: '00:00',
            endTime: '23:59'
          }
        ]
      }
    ]
  }
}

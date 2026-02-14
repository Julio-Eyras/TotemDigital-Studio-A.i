/**
 * Converte SmartSignageNetwork em GraphData para visualização.
 * Fonte única usada por frontend e holograph-engine.
 */
import type { GraphNode, GraphEdge, GraphData, SmartSignageNetwork, ScheduleSlot } from './types';

export interface AdapterOptions {
  includeScheduleEdges?: boolean;
  filterDayOfWeek?: number;
  filterTime?: string;
}

function slotMatches(
  slot: ScheduleSlot,
  day?: number,
  time?: string
): boolean {
  if (day != null && slot.dayOfWeek?.length && !slot.dayOfWeek.includes(day)) return false;
  if (time != null && slot.startTime != null && slot.endTime != null) {
    if (time < slot.startTime || time > slot.endTime) return false;
  }
  return true;
}

export function smartSignageToGraph(
  network: SmartSignageNetwork,
  options: AdapterOptions = {}
): GraphData {
  const includeScheduleEdges = options.includeScheduleEdges !== false;
  const filterDay = options.filterDayOfWeek;
  const filterTime = options.filterTime;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  function addNode(n: GraphNode) {
    if (!nodeIds.has(n.id)) {
      nodeIds.add(n.id);
      nodes.push(n);
    }
  }
  function addEdge(e: GraphEdge) {
    edges.push(e);
  }

  for (const p of network.publishers) {
    addNode({ id: p.id, label: p.name, type: 'publisher', meta: {} });
    for (const loc of p.locations ?? []) {
      addNode({
        id: loc.id,
        label: loc.name,
        type: 'location',
        meta: { publisherId: loc.publisherId, address: loc.address }
      });
      addEdge({ from: p.id, to: loc.id, type: 'has-location' });
      for (const t of loc.totems ?? []) {
        addNode({ id: t.id, label: t.name, type: 'totem', meta: { locationId: t.locationId } });
        addEdge({ from: loc.id, to: t.id, type: 'has-totem' });
        for (const tv of (t as { smartTvs?: Array<{ id: string; name: string }> }).smartTvs ?? []) {
          addNode({ id: tv.id, label: tv.name, type: 'smarttv', meta: { totemId: (t as any).id } });
          addEdge({ from: t.id, to: tv.id, type: 'has-smarttv' });
        }
      }
    }
  }

  for (const s of network.subscribers) {
    addNode({ id: s.id, label: s.name, type: 'subscriber', meta: {} });
    for (const m of s.media ?? []) {
      addNode({
        id: m.id,
        label: m.name,
        type: 'media',
        meta: { subscriberId: m.subscriberId, mediaType: m.type, url: m.url }
      });
      addEdge({ from: s.id, to: m.id, type: 'has-media' });
    }
    for (const pl of s.playlists ?? []) {
      addNode({
        id: pl.id,
        label: pl.name,
        type: 'playlist',
        meta: { subscriberId: pl.subscriberId, mediaIds: pl.mediaIds }
      });
      addEdge({ from: s.id, to: pl.id, type: 'has-playlist' });
      for (const mid of pl.mediaIds ?? []) {
        addEdge({ from: pl.id, to: mid, type: 'contains-media' });
      }
    }
    for (const c of s.campaigns ?? []) {
      addNode({
        id: c.id,
        label: c.name,
        type: 'campaign',
        meta: { subscriberId: c.subscriberId, playlistIds: c.playlistIds }
      });
      addEdge({ from: s.id, to: c.id, type: 'has-campaign' });
      for (const pid of c.playlistIds ?? []) {
        addEdge({ from: c.id, to: pid, type: 'uses-playlist' });
      }
    }
  }

  if (includeScheduleEdges) {
    for (const a of network.scheduleAssignments) {
      const slots =
        filterDay != null || filterTime != null
          ? a.slots.filter((s) => slotMatches(s, filterDay, filterTime))
          : a.slots;
      for (const slot of slots) {
        addEdge({
          from: a.sourceId,
          to: slot.targetId,
          type: 'scheduled',
          meta: {
            sourceType: a.sourceType,
            targetType: slot.targetType,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        });
      }
    }
  }

  return { nodes, edges };
}

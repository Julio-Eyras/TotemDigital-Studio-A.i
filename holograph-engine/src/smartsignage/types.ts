/**
 * Re-exporta tipos do adapter compartilhado (shared/holograph-adapter).
 * Fonte única para SmartSignageNetwork, GraphData, etc.
 */
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  SmartSignageNetwork,
  ScheduleTargetType,
  ScheduleSlot,
} from '../../../shared/holograph-adapter'
export { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from '../../../shared/holograph-adapter'

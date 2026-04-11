/**
 * Re-exporta tipos e constantes do adapter compartilhado.
 * Fonte única: shared/holograph-adapter
 */
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  SmartSignageNetwork,
  ScheduleTargetType,
  ScheduleSlot,
} from '@shared/holograph-adapter';
export { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from '@shared/holograph-adapter';

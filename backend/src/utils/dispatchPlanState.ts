export type DispatchPlanState = 'ACTIVE' | 'EMPTY';

export function resolveDispatchPlanState(
  plan: { mediaItems?: unknown[] } | null | undefined
): DispatchPlanState {
  return Array.isArray(plan?.mediaItems) && plan.mediaItems.length > 0 ? 'ACTIVE' : 'EMPTY';
}

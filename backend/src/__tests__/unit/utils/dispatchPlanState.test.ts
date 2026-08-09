import { resolveDispatchPlanState } from '../../../utils/dispatchPlanState';

describe('resolveDispatchPlanState', () => {
  it('marca plano com mídias como ACTIVE', () => {
    expect(resolveDispatchPlanState({ mediaItems: [{ mediaId: 1 }] })).toBe('ACTIVE');
  });

  it('marca ausência de plano ou lista vazia como EMPTY', () => {
    expect(resolveDispatchPlanState(null)).toBe('EMPTY');
    expect(resolveDispatchPlanState({ mediaItems: [] })).toBe('EMPTY');
  });
});

import type { DispatcherMessage } from '../services/api';
import {
  dispatcherHttpStatus,
  dispatcherMessageIsError,
  groupDispatcherMessages,
} from './dispatcherTelemetry';

const message = (patch: Partial<DispatcherMessage>): DispatcherMessage => ({
  id: patch.id ?? Math.random().toString(),
  timestamp: patch.timestamp ?? '2026-08-08T12:00:00Z',
  direction: patch.direction ?? 'incoming',
  ...patch,
});

describe('dispatcherTelemetry', () => {
  it('agrupa entrada e saída pelo traceId', () => {
    const groups = groupDispatcherMessages([
      message({ id: 'out', traceId: 'abc', direction: 'outgoing', httpStatus: 200 }),
      message({ id: 'in', traceId: 'abc', direction: 'incoming' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].incoming?.id).toBe('in');
    expect(groups[0].outgoing?.id).toBe('out');
  });

  it('preserva mensagens sem traceId em linhas independentes', () => {
    const groups = groupDispatcherMessages([
      message({ id: 'a' }),
      message({ id: 'b', direction: 'outgoing' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.traceId === undefined)).toBe(true);
  });

  it('oculta respostas e detecta status HTTP de erro', () => {
    const outgoing = message({
      id: 'out',
      direction: 'outgoing',
      response: { statusCode: 503 },
    });
    expect(dispatcherHttpStatus(outgoing)).toBe(503);
    expect(dispatcherMessageIsError(outgoing)).toBe(true);
    expect(groupDispatcherMessages([outgoing], true, true)).toHaveLength(0);
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWebSocketUrl, totemApi } from '../services/api';
import { normalizePlaybackState, TotemPlaybackState } from '../utils/playbackTelemetry';

const HOVER_DEBOUNCE_MS = 250;
const UNSUBSCRIBE_GRACE_MS = 900;
const REST_FALLBACK_INTERVAL_MS = 10_000;
const REST_RECONCILIATION_INTERVAL_MS = 15_000;

export type PlaybackConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface TotemObservationSample {
  totemId: number;
  occurredAt: string;
  metrics: Record<string, unknown>;
}

export function useTotemPlaybackTelemetry() {
  const [states, setStates] = useState<Record<number, TotemPlaybackState>>({});
  const [observationSamples, setObservationSamples] = useState<Record<number, TotemObservationSample>>({});
  const [connectionStatus, setConnectionStatus] = useState<PlaybackConnectionStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef(new Set<number>());
  const desiredRef = useRef(new Set<number>());
  const timersRef = useRef(new Map<number, number>());

  const send = useCallback((type: 'subscribe_playback_state' | 'unsubscribe_playback_state', totemId: number) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, data: { totemId } }));
    if (type === 'subscribe_playback_state') subscribedRef.current.add(totemId);
    else subscribedRef.current.delete(totemId);
  }, []);

  const fetchState = useCallback(async (totemId: number) => {
    try {
      const payload = await totemApi.getPlaybackState(totemId);
      const normalized = normalizePlaybackState(payload, totemId);
      if (normalized) {
        setStates((previous) => ({ ...previous, [totemId]: normalized }));
      }
    } catch {
      // WebSocket continua sendo a fonte principal; REST é apenas seed/fallback temporário.
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setConnectionStatus('disconnected');
      return undefined;
    }
    let disposed = false;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;
    const timers = timersRef.current;
    const desired = desiredRef.current;

    const connect = () => {
      if (disposed) return;
      setConnectionStatus('connecting');
      const socket = new WebSocket(getWebSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => {
        reconnectAttempt = 0;
        setConnectionStatus('connected');
        desired.forEach((totemId) => send('subscribe_playback_state', totemId));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'totem_observation_sample') {
            const sample = message.data as TotemObservationSample | undefined;
            if (sample?.totemId && sample.occurredAt) {
              setObservationSamples((previous) => ({
                ...previous,
                [sample.totemId]: sample,
              }));
            }
            return;
          }
          if (message.type !== 'totem_playback_state') return;
          const normalized = normalizePlaybackState(message);
          if (!normalized?.totemId) return;
          setStates((previous) => ({ ...previous, [normalized.totemId!]: normalized }));
        } catch {
          // Outros consumidores compartilham /ws; payloads desconhecidos são ignorados.
        }
      };
      socket.onclose = () => {
        setConnectionStatus('disconnected');
        subscribedRef.current.clear();
        if (disposed) return;
        reconnectTimer = window.setTimeout(connect, Math.min(2000 * 2 ** reconnectAttempt++, 30000));
      };
      socket.onerror = () => setConnectionStatus('disconnected');
    };
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      timers.forEach(window.clearTimeout);
      timers.clear();
      desired.forEach((totemId) => send('unsubscribe_playback_state', totemId));
      socketRef.current?.close();
    };
  }, [send]);

  useEffect(() => {
    const refreshDesired = () => {
      desiredRef.current.forEach((totemId) => void fetchState(totemId));
    };
    refreshDesired();
    const intervalMs =
      connectionStatus === 'connected'
        ? REST_RECONCILIATION_INTERVAL_MS
        : REST_FALLBACK_INTERVAL_MS;
    const timer = window.setInterval(refreshDesired, intervalMs);
    return () => window.clearInterval(timer);
  }, [connectionStatus, fetchState]);

  const hoverStart = useCallback((totemId: number) => {
    const previous = timersRef.current.get(totemId);
    if (previous) window.clearTimeout(previous);
    void fetchState(totemId);
    const timer = window.setTimeout(() => {
      desiredRef.current.add(totemId);
      send('subscribe_playback_state', totemId);
      timersRef.current.delete(totemId);
    }, HOVER_DEBOUNCE_MS);
    timersRef.current.set(totemId, timer);
  }, [fetchState, send]);

  const hoverEnd = useCallback((totemId: number) => {
    const previous = timersRef.current.get(totemId);
    if (previous) window.clearTimeout(previous);
    const timer = window.setTimeout(() => {
      desiredRef.current.delete(totemId);
      if (subscribedRef.current.has(totemId)) send('unsubscribe_playback_state', totemId);
      timersRef.current.delete(totemId);
    }, UNSUBSCRIBE_GRACE_MS);
    timersRef.current.set(totemId, timer);
  }, [send]);

  const seedState = useCallback((totemId: number, payload: unknown) => {
    const normalized = normalizePlaybackState(payload, totemId);
    if (normalized) setStates((previous) => ({ ...previous, [totemId]: previous[totemId] ?? normalized }));
  }, []);

  return {
    states,
    observationSamples,
    connectionStatus,
    hoverStart,
    hoverEnd,
    seedState,
  };
}

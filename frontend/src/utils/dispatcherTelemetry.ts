import type { DispatcherMessage } from '../services/api';

export interface DispatcherTraceGroup {
  key: string;
  traceId?: string;
  messages: DispatcherMessage[];
  incoming?: DispatcherMessage;
  outgoing?: DispatcherMessage;
}

export function dispatcherHttpStatus(message: DispatcherMessage): number | undefined {
  const response = message.response as Record<string, unknown> | undefined;
  const value = message.httpStatus ?? message.statusCode ?? response?.status ?? response?.statusCode;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function dispatcherMessageIsError(message: DispatcherMessage): boolean {
  const status = dispatcherHttpStatus(message);
  return Boolean(message.error) || (status !== undefined && status >= 400);
}

export function groupDispatcherMessages(
  messages: DispatcherMessage[],
  grouped = true,
  hideResponses = false,
): DispatcherTraceGroup[] {
  const visible = hideResponses ? messages.filter((message) => message.direction !== 'outgoing') : messages;
  if (!grouped) {
    return visible.map((message, index) => ({
      key: `message:${message.id || index}`,
      traceId: message.traceId,
      messages: [message],
      incoming: message.direction === 'incoming' ? message : undefined,
      outgoing: message.direction === 'outgoing' ? message : undefined,
    }));
  }

  const groups = new Map<string, DispatcherTraceGroup>();
  visible.forEach((message, index) => {
    // Sem traceId, cada mensagem permanece independente para preservar o comportamento antigo.
    const key = message.traceId ? `trace:${message.traceId}` : `legacy:${message.id || index}`;
    const current = groups.get(key) ?? { key, traceId: message.traceId, messages: [] };
    current.messages.push(message);
    if (message.direction === 'incoming' && !current.incoming) current.incoming = message;
    if (message.direction === 'outgoing') current.outgoing = message;
    groups.set(key, current);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const aTime = Math.max(...a.messages.map((message) => new Date(message.timestamp).getTime() || 0));
    const bTime = Math.max(...b.messages.map((message) => new Date(message.timestamp).getTime() || 0));
    return bTime - aTime;
  });
}

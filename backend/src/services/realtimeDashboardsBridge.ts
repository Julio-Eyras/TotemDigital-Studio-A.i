/**
 * Realtime Dashboards Bridge - Smart Signage v2.1
 * Conecta clientes WebSocket ao builder dos dashboards (builders exportados)
 * com polling inteligente: apenas atualiza o cliente quando o hash do dashboard
 * mudou (cache invalidado / ACE detectou novos rostos / FX novos efeitos etc).
 */

import crypto from 'crypto';
import type { DashboardFilters, DashboardKind } from '../types/analytics';
import {
  buildAceDashboard,
  buildFxDashboard,
  buildGeneralDashboard,
} from '../routes/dashboards';
import { logDebug, logInfo, logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';
import type { AuthenticatedRequest as DashboardBuilderReq } from '../routes/dashboards';

type AuthenticatedRequest = DashboardBuilderReq;

export interface DashSubscribeMessage {
  type: 'dash:subscribe' | 'dash:unsubscribe';
  kinds: DashboardKind[];
  filters?: DashboardFilters;
  includeWidgets?: string[];
}

export interface DashUpdateMessage {
  type: 'dash:update';
  kind: DashboardKind;
  data: unknown;
  hash: string;
  serverTimestamp: number;
  includeWidgets?: string[];
}

export interface DashSubscribedAck {
  type: 'dash:subscribed';
  kinds: DashboardKind[];
  serverTimestamp: number;
}

export interface DashConnectionSnapshot {
  type: 'dash:snapshot';
  payloads: DashUpdateMessage[];
  serverTimestamp: number;
}

export type ClientSendFn = (msg: string) => void;

interface ClientSub {
  send: ClientSendFn;
  isOpen: () => boolean;
  kinds: Set<DashboardKind>;
  lastHashes: Partial<Record<DashboardKind, string>>;
  filters?: DashboardFilters;
  includeWidgets?: string[];
  req: AuthenticatedRequest;
}

export const DASH_TICK_MS_DEFAULT = 3000;

export function computeDashboardHash(kind: DashboardKind, payload: unknown): string {
  const stable = JSON.stringify({ kind, payload });
  return crypto
    .createHash('sha256')
    .update(stable)
    .digest('hex')
    .slice(0, 32);
}

export class RealtimeDashboardsBridge {
  private clients: Map<string, ClientSub> = new Map();
  private tickMs: number;
  private interval: ReturnType<typeof setInterval> | null = null;
  private startedAt: number = 0;

  constructor(tickMs = DASH_TICK_MS_DEFAULT) {
    this.tickMs = tickMs;
  }

  public get clientCount(): number {
    return this.clients.size;
  }

  public hasClient(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  public getSubscribedKinds(clientId: string): DashboardKind[] {
    const sub = this.clients.get(clientId);
    if (!sub) return [];
    return Array.from(sub.kinds);
  }

  public start(): void {
    if (this.interval) return;
    this.startedAt = Date.now();
    this.interval = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    if (typeof (this.interval as unknown as { unref?: () => void }).unref === 'function') {
      (this.interval as unknown as { unref: () => void }).unref();
    }
    logInfo('RealtimeDashboardsBridge started', { tickMs: this.tickMs });
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public subscribe(
    clientId: string,
    send: ClientSendFn,
    isOpen: () => boolean,
    kinds: DashboardKind[],
    req: AuthenticatedRequest,
    filters?: DashboardFilters,
    includeWidgets?: string[],
  ): DashSubscribedAck {
    const existing = this.clients.get(clientId);
    const sub: ClientSub = existing ?? {
      send,
      isOpen,
      kinds: new Set<DashboardKind>(),
      lastHashes: {},
      req,
    };
    if (!existing) {
      this.clients.set(clientId, sub);
    }
    for (const k of kinds) sub.kinds.add(k);
    if (filters !== undefined) sub.filters = filters;
    if (includeWidgets?.length) sub.includeWidgets = includeWidgets;
    const ack: DashSubscribedAck = {
      type: 'dash:subscribed', kinds, serverTimestamp: Date.now(),
    };
    try {
      send(JSON.stringify(ack));
    } catch (_err) { /* cliente já fechou, ignore */ }
    void (async () => {
      try {
        const snap = await this.buildClientSnapshot(sub, kinds);
        if (snap.payloads.length) {
          try { send(JSON.stringify(snap)); } catch (_err2) { /* ignore */ }
        }
      } catch (error: unknown) {
        const e = normalizeError(error);
        logDebug('RealtimeDashboardsBridge snapshot failed', { clientId, message: e.message });
      }
    })();
    logDebug('RealtimeDashboardsBridge.subscribe', { clientId, kinds });
    return ack;
  }

  public unsubscribe(clientId: string, kinds?: DashboardKind[]): void {
    const sub = this.clients.get(clientId);
    if (!sub) return;
    if (!kinds || kinds.length === 0) {
      this.clients.delete(clientId);
      return;
    }
    for (const k of kinds) sub.kinds.delete(k);
    if (sub.kinds.size === 0) this.clients.delete(clientId);
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  private async buildClientSnapshot(sub: ClientSub, kinds: DashboardKind[]): Promise<DashConnectionSnapshot> {
    const payloads: DashUpdateMessage[] = [];
    for (const kind of kinds) {
      const built = await this.buildDashboardForClient(sub, kind);
      if (built) payloads.push(built);
    }
    return { type: 'dash:snapshot', payloads, serverTimestamp: Date.now() };
  }

  private async buildDashboardForClient(
    sub: ClientSub,
    kind: DashboardKind,
  ): Promise<DashUpdateMessage | null> {
    try {
      const useCache = true;
      const ttlSec = Math.max(1, Math.floor(this.tickMs / 1000) - 1);
      let raw: unknown;
      switch (kind) {
        case 'ace':
          raw = await buildAceDashboard(sub.req, sub.filters, useCache, ttlSec);
          break;
        case 'fx':
          raw = await buildFxDashboard(sub.req, sub.filters, useCache, ttlSec);
          break;
        case 'general':
          raw = await buildGeneralDashboard(sub.req, sub.filters, useCache, ttlSec);
          break;
      }
      const data = typeof (raw as { data?: unknown })?.data ?? raw;
      const hash = computeDashboardHash(kind, data);
      return {
        type: 'dash:update',
        kind,
        data,
        hash,
        serverTimestamp: Date.now(),
        includeWidgets: sub.includeWidgets,
      };
    } catch (error: unknown) {
      const e = normalizeError(error);
      logError('RealtimeDashboardsBridge buildDashboard failed', e.error, { kind });
      return null;
    }
  }

  public async tick(): Promise<number> {
    if (this.clients.size === 0) return 0;
    let broadcasts = 0;
    for (const [clientId, sub] of this.clients.entries()) {
      if (!sub.isOpen()) {
        this.clients.delete(clientId);
        continue;
      }
      const kinds = Array.from(sub.kinds);
      for (const kind of kinds) {
        const built = await this.buildDashboardForClient(sub, kind);
        if (!built) continue;
        const last = sub.lastHashes[kind];
        if (last && last === built.hash) continue;
        sub.lastHashes[kind] = built.hash;
        try {
          sub.send(JSON.stringify(built));
          broadcasts += 1;
        } catch (error: unknown) {
          const e = normalizeError(error);
          logDebug('RealtimeDashboardsBridge send failed, removing client', { clientId, message: e.message });
          this.clients.delete(clientId);
          break;
        }
      }
    }
    return broadcasts;
  }
}

let realtimeDashboardsBridgeInstance: RealtimeDashboardsBridge | null = null;

export function getRealtimeDashboardsBridge(): RealtimeDashboardsBridge {
  if (!realtimeDashboardsBridgeInstance) {
    realtimeDashboardsBridgeInstance = new RealtimeDashboardsBridge();
  }
  return realtimeDashboardsBridgeInstance;
}

export function resetRealtimeDashboardsBridgeForTests(): void {
  if (realtimeDashboardsBridgeInstance) {
    realtimeDashboardsBridgeInstance.stop();
  }
  realtimeDashboardsBridgeInstance = null;
}

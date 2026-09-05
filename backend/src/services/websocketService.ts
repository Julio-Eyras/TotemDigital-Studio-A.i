/**
 * WebSocket Service - Smart Signage v2.1
 * Serviço para gerenciar conexões WebSocket
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';
import { getTotemLogService, TotemLogEntry } from './totemLogService';
// import { authMiddleware } from '../middleware/auth.middleware'; // Não usado diretamente
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { getDatabase } from '../config/database';
import { getTotemService } from './totemService';
import { normalizeError } from '../utils/errors';
import {
  getRealtimeDashboardsBridge,
  type DashSubscribeMessage,
  type DashboardKind as RtDashKind,
} from './realtimeDashboardsBridge';
import type { DashboardFilters } from '../types/analytics';
import type { AuthenticatedRequest } from '../routes/dashboards';

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  error?: string;
}

export interface LogStreamMessage extends WebSocketMessage {
  type: 'log' | 'log_batch' | 'error' | 'connected' | 'disconnected';
  data?: TotemLogEntry | TotemLogEntry[];
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private logStreams: Map<number, Set<string>> = new Map(); // totemId -> Set<clientId>
  private playbackStreams: Map<number, Set<string>> = new Map(); // totemId -> Set<clientId>
  private userClients: Map<number, Set<string>> = new Map(); // userId -> Set<clientId>
  private clientUsers: Map<string, number> = new Map(); // clientId -> userId

  /**
   * Inicializa servidor WebSocket
   */
  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info, callback) => {
        // Verificar autenticação via query string ou header
        const token = this.extractToken(info.req);
        if (!token) {
          callback(false, 401, 'Unauthorized');
          return;
        }

        try {
          const decoded = jwt.verify(token, config.jwt.secret) as any;
          (info.req as unknown as Record<string, unknown>).user = decoded;
          callback(true);
} catch (error: unknown) {
          callback(false, 401, 'Unauthorized');
        }
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: unknown) => {
      this.handleConnection(ws, req);
    });

    try {
      getRealtimeDashboardsBridge().start();
    } catch (error: unknown) {
      const e = normalizeError(error);
      logError('Falha ao iniciar RealtimeDashboardsBridge', e.error);
    }

    logInfo('WebSocket server initialized', { path: '/ws' });
  }

  /**
   * Extrai token de autenticação da requisição
   */
  private extractToken(reqRaw: unknown): string | null {
    const req = reqRaw as { url?: string; headers?: { host?: string; authorization?: string } };
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (token) return token;

    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Manipula nova conexão WebSocket
   */
  private handleConnection(ws: WebSocket, reqRaw: unknown) {
    const clientId = this.generateClientId();
    const req = reqRaw as { user?: Record<string, unknown> };
    const user = req.user;

    this.clients.set(clientId, ws);
    
    // Registrar mapeamento de usuário
    const userId = Number(user?.id || user?.userId);
    if (userId) {
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId)!.add(clientId);
      this.clientUsers.set(clientId, userId);
    }

    logInfo('WebSocket client connected', { clientId, userId });

    // Enviar mensagem de conexão
    this.sendToClient(clientId, {
      type: 'connected',
      data: { clientId, userId }
    });

    // Manipular mensagens
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(clientId, data, user);} catch (error: unknown) {
        const e = normalizeError(error);
        logError('Erro ao processar mensagem WebSocket', e.error, { clientId });
        this.sendToClient(clientId, {
          type: 'error',
          error: 'Invalid message format'
      });
      }
    });

    // Manipular desconexão
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      logError('WebSocket error', error, { clientId });
      this.handleDisconnection(clientId);
    });
  }

  /**
   * Manipula mensagens recebidas
   */
  private async handleMessage(clientId: string, message: WebSocketMessage, userRaw: unknown) {
    try {
      const msgData = (message.data || {}) as unknown as Record<string, unknown>;
      switch (message.type) {
        case 'subscribe_logs':
          await this.subscribeToLogs(clientId, Number(msgData.totemId), userRaw);
          break;

        case 'unsubscribe_logs':
          this.unsubscribeFromLogs(clientId, Number(msgData.totemId));
          break;

        case 'subscribe_playback_state':
          await this.subscribeToPlaybackState(clientId, msgData.totemId, userRaw);
          break;

        case 'unsubscribe_playback_state':
          this.unsubscribeFromPlaybackState(clientId, msgData?.totemId);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;

        case 'dash:subscribe':
          await this.subscribeToDashboards(clientId, msgData as DashSubscribeMessage, userRaw);
          break;

        case 'dash:unsubscribe':
          this.unsubscribeFromDashboards(clientId, msgData as DashSubscribeMessage);
          break;

        default:
          logDebug('Unknown WebSocket message type', { clientId, type: message.type });
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      logError('Erro ao processar mensagem WebSocket', e.error, { clientId, type: message.type });
      this.sendToClient(clientId, {
        type: 'error',
        error: e.message || 'Internal error'
    });
    }
  }

  /**
   * Inscreve cliente em stream de logs de um totem
   */
  private async subscribeToLogs(clientId: string, totemId: number, userRaw: unknown) {
    const user = userRaw as unknown as Record<string, unknown>;
    // Verificar permissão (apenas admin e manager)
    if (user.role !== 'admin' && user.role !== 'manager') {
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Unauthorized: Only admin and manager can view logs'
      });
      return;
    }

    // Adicionar à lista de streams
    if (!this.logStreams.has(totemId)) {
      this.logStreams.set(totemId, new Set());
    }
    this.logStreams.get(totemId)!.add(clientId);

    // Enviar logs recentes
    try {
      const recentLogs = await getTotemLogService().getRecentLogs(totemId, 100);
      this.sendToClient(clientId, {
        type: 'log_batch',
        data: recentLogs
      });} catch (error: unknown) {
      const e = normalizeError(error);
      logError('Erro ao obter logs recentes', e.error, { totemId, clientId });
    }

    logInfo('Client subscribed to totem logs', { clientId, totemId, userId: user.id });
  }

  /**
   * Remove inscrição de logs
   */
  private unsubscribeFromLogs(clientId: string, totemId: number) {
    const stream = this.logStreams.get(totemId);
    if (stream) {
      stream.delete(clientId);
      if (stream.size === 0) {
        this.logStreams.delete(totemId);
      }
    }

    logDebug('Client unsubscribed from totem logs', { clientId, totemId });
  }

  private async canAccessTotem(userRaw: unknown, totemId: number): Promise<boolean> {
    if (!Number.isInteger(Number(totemId)) || Number(totemId) < 1) return false;
    const user = userRaw as unknown as Record<string, unknown>;
    const userId = Number(user?.id || user?.userId);
    if (!userId) return false;
    const currentUser = await getDatabase().findFirst(
      `SELECT role, publisher_id, subscriber_id FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    if (!currentUser) return false;
    const activeTotem = await getDatabase().findFirst(
      `SELECT 1
       FROM totems
       WHERE totem_id = $1 AND COALESCE(is_active, true) = true`,
      [totemId]
    );
    if (!activeTotem) return false;
    if (['admin', 'admin_sql', 'owner_system', 'operador_tecnico'].includes(currentUser.role)) {
      return true;
    }
    if (currentUser.publisher_id) {
      const owned = await getDatabase().findFirst(
        `SELECT 1
         FROM totems t
         JOIN locals l ON l.local_id = t.local_id
         WHERE t.totem_id = $1 AND l.publisher_id = $2`,
        [totemId, currentUser.publisher_id]
      );
      if (owned) return true;
    }
    if (currentUser.subscriber_id) {
      return getTotemService().isTotemAccessibleToSubscriber(
        Number(totemId),
        Number(currentUser.subscriber_id)
      );
    }
    return false;
  }

  private async subscribeToPlaybackState(clientId: string, rawTotemId: unknown, userRaw: unknown) {
    const totemId = Number(rawTotemId);
    if (!(await this.canAccessTotem(userRaw, totemId))) {
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Unauthorized: totem outside tenant scope',
      });
      return;
    }
    if (!this.playbackStreams.has(totemId)) {
      this.playbackStreams.set(totemId, new Set());
    }
    this.playbackStreams.get(totemId)!.add(clientId);
    const { getPlaybackTelemetryService } = await import('./playbackTelemetryService');
    const state = await getPlaybackTelemetryService().getCurrentState(totemId);
    this.sendToClient(clientId, {
      type: 'totem_playback_state',
      data: state || null,
    });
    logInfo('Client subscribed to playback state', {
      clientId,
      totemId,
      userId: Number((userRaw as unknown as Record<string, unknown>)?.id || (userRaw as unknown as Record<string, unknown>)?.userId),
    });
  }

  private unsubscribeFromPlaybackState(clientId: string, rawTotemId: unknown) {
    const totemId = Number(rawTotemId);
    const stream = this.playbackStreams.get(totemId);
    if (!stream) return;
    stream.delete(clientId);
    if (stream.size === 0) this.playbackStreams.delete(totemId);
  }

  /**
   * Manipula desconexão
   */
  private handleDisconnection(clientId: string) {
    // Remover de todos os streams
    for (const [totemId, clients] of this.logStreams.entries()) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.logStreams.delete(totemId);
      }
    }
    for (const [totemId, clients] of this.playbackStreams.entries()) {
      clients.delete(clientId);
      if (clients.size === 0) this.playbackStreams.delete(totemId);
    }

    // Remover mapeamento de usuário
    const userId = this.clientUsers.get(clientId);
    if (userId) {
      const userClientsSet = this.userClients.get(userId);
      if (userClientsSet) {
        userClientsSet.delete(clientId);
        if (userClientsSet.size === 0) {
          this.userClients.delete(userId);
        }
      }
      this.clientUsers.delete(clientId);
    }

    this.clients.delete(clientId);
    logInfo('WebSocket client disconnected', { clientId });
  }

  /**
   * Envia nova entrada de log para clientes inscritos
   */
  async broadcastLog(totemId: number, logEntry: TotemLogEntry) {
    const clients = this.logStreams.get(totemId);
    if (!clients || clients.size === 0) {
      return;
    }

    const message: LogStreamMessage = {
      type: 'log',
      data: logEntry
    };

    for (const clientId of clients) {
      this.sendToClient(clientId, message);
    }
  }

  broadcastPlaybackState(totemId: number, state: unknown): void {
    const clients = this.playbackStreams.get(totemId);
    if (!clients) return;
    for (const clientId of clients) {
      this.sendToClient(clientId, {
        type: 'totem_playback_state',
        data: state,
      });
    }
  }

  broadcastObservationSample(totemId: number, sample: unknown): void {
    const clients = this.playbackStreams.get(totemId);
    if (!clients) return;
    for (const clientId of clients) {
      this.sendToClient(clientId, {
        type: 'totem_observation_sample',
        data: sample,
      });
    }
  }

  /**
   * Envia mensagem para um cliente específico
   */
  private sendToClient(clientId: string, message: WebSocketMessage) {
    const ws = this.clients.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      ws.send(JSON.stringify(message));} catch (error: unknown) {
      const e = normalizeError(error);
      logError('Erro ao enviar mensagem WebSocket', e.error, { clientId });
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Gera ID único para cliente
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Envia mensagem para um usuário específico
   */
  sendToUser(userId: number, message: WebSocketMessage): void {
    const userClientsSet = this.userClients.get(userId);
    if (!userClientsSet) {
      return;
    }

    for (const clientId of userClientsSet) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Envia mensagem para todos os usuários de um cliente
   */
  broadcastToClient(_clientId: number, message: WebSocketMessage): void {
    // Implementação simplificada: enviar para todos os clientes conectados
    // Em produção, seria necessário mapear clientId (empresa) para userIds
    for (const [clientIdStr, ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientIdStr, message);
      }
    }
  }

  /**
   * Envia mensagem para todos os clientes (opcionalmente filtrado por roles)
   */
  broadcast(message: WebSocketMessage, _roles?: string[]): void {
    for (const [clientId, ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        // Se roles especificadas, seria necessário verificar role do usuário
        // Por enquanto, envia para todos
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Fecha servidor WebSocket
   */
  close() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.logStreams.clear();
    this.playbackStreams.clear();
    this.userClients.clear();
    this.clientUsers.clear();
    logInfo('WebSocket server closed');
  }
}

// Singleton instance
let websocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!websocketServiceInstance) {
    websocketServiceInstance = new WebSocketService();
  }
  return websocketServiceInstance;
}


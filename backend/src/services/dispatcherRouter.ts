/**
 * Dispatcher Router
 * Ponto central de roteamento para todas as requisições dos players
 * Todas as requisições /api/player/* passam por aqui antes de serem processadas
 */

import { Request, Response } from 'express';
import { getDispatcherTotemService } from './dispatcherTotemService';
import { dispatcherDebugService } from './dispatcherDebugService';
import { TotemService } from './totemService';
import { getDeviceTokenService } from './deviceTokenService';
import { getEventLogService, EventType } from './eventLogService';
import { logError, logDebug } from '../utils/loggerHelper';
import { validateTotemToken, generateTotemToken } from '../routes/player';

export interface DispatcherRequest {
  endpoint: string;
  method: string;
  uin?: string;
  totemId?: number;
  query?: any;
  body?: any;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  platform?: string;
  appVersion?: string;
}

export interface DispatcherResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
  duration: number;
  fromCache?: boolean;
}

class DispatcherRouter {
  /**
   * Roteia requisição para o handler apropriado
   */
  async route(req: Request, res: Response, endpoint: string): Promise<void> {
    const startTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Extrair informações da requisição
      const dispatcherRequest: DispatcherRequest = {
        endpoint,
        method: req.method,
        uin: req.query.uin as string || req.body?.uin,
        query: req.query,
        body: req.body,
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.get('user-agent') || undefined,
        deviceId: req.query.deviceId as string || req.body?.deviceId,
        platform: req.query.platform as string || req.body?.platform,
        appVersion: req.query.appVersion as string || req.body?.appVersion,
      };

      // Log incoming (amarelo) - requisição recebida
      dispatcherDebugService.logMessage('incoming', {
        totemId: undefined, // Será preenchido depois
        uin: dispatcherRequest.uin,
        endpoint: dispatcherRequest.endpoint,
        method: dispatcherRequest.method,
        request: {
          uin: dispatcherRequest.uin,
          deviceId: dispatcherRequest.deviceId,
          platform: dispatcherRequest.platform,
          ...(dispatcherRequest.query || {}),
        },
        ipAddress: dispatcherRequest.ipAddress,
      });

      // Roteia para handler específico
      let handlerResponse: DispatcherResponse;
      
      switch (endpoint) {
        case '/api/player/token':
          handlerResponse = await this.handleToken(dispatcherRequest);
          break;
        
        case '/api/player/validate':
          handlerResponse = await this.handleValidate(dispatcherRequest);
          break;
        
        case '/api/player/dispatch':
          handlerResponse = await this.handleDispatch(dispatcherRequest);
          break;
        
        case '/api/player/heartbeat':
          handlerResponse = await this.handleHeartbeat(dispatcherRequest);
          break;
        
        case '/api/player/event':
          handlerResponse = await this.handleEvent(dispatcherRequest);
          break;
        
        default:
          handlerResponse = {
            success: false,
            error: `Endpoint não encontrado: ${endpoint}`,
            statusCode: 404,
            duration: Date.now() - startTime,
          };
      }

      // Log outgoing (verde se sucesso, vermelho se erro)
      dispatcherDebugService.logMessage('outgoing', {
        totemId: dispatcherRequest.totemId,
        uin: dispatcherRequest.uin,
        endpoint: dispatcherRequest.endpoint,
        method: dispatcherRequest.method,
        response: handlerResponse.success ? handlerResponse.data : { error: handlerResponse.error },
        error: handlerResponse.success ? undefined : handlerResponse.error,
        duration: handlerResponse.duration,
        fromCache: handlerResponse.fromCache,
        ipAddress: dispatcherRequest.ipAddress,
      });

      // Enviar resposta HTTP
      res.status(handlerResponse.statusCode).json(
        handlerResponse.success 
          ? handlerResponse.data 
          : { error: handlerResponse.error }
      );

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log erro
      dispatcherDebugService.logMessage('outgoing', {
        totemId: undefined,
        uin: req.query.uin as string || req.body?.uin,
        endpoint,
        method: req.method,
        response: { success: false, error: 'Erro interno' },
        error: error.message || 'Erro interno do servidor',
        duration,
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
      });

      await logError(`[DispatcherRouter] Erro ao processar requisição ${endpoint}`, error, {
        requestId,
        endpoint,
        uin: req.query.uin,
      });

      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message 
      });
    }
  }

  /**
   * Handler para /api/player/token
   */
  private async handleToken(request: DispatcherRequest): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return {
          success: false,
          error: 'UIN não fornecido',
          statusCode: 400,
          duration: Date.now() - startTime,
        };
      }

      const hmacToken = generateTotemToken(request.uin);

      // Registrar também em device_tokens
      try {
        const totemService = new TotemService();
        const totem = await totemService.getTotemByUin(request.uin);
        const totemId = (totem as any)?.id ?? null;

        const deviceTokenService = getDeviceTokenService();
        await deviceTokenService.createOrUpdateToken({
          totemId,
          smartTvId: null,
          uin: request.uin,
          deviceId: request.deviceId || null,
          platform: request.platform || null,
          appVersion: request.appVersion || null,
          ipAddress: request.ipAddress || null,
          userAgent: request.userAgent || null,
          ttlMs: 3600000,
        });
      } catch (e) {
        await logDebug('Falha ao registrar device_token', {
          error: (e as any)?.message,
          uin: request.uin,
        });
      }

      return {
        success: true,
        data: {
          token: hmacToken,
          expiresIn: 3600,
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao gerar token',
        statusCode: 500,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handler para /api/player/validate
   */
  private async handleValidate(request: DispatcherRequest): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return {
          success: false,
          error: 'UIN não fornecido',
          statusCode: 400,
          duration: Date.now() - startTime,
        };
      }

      // Validar token se fornecido
      const token = request.query?.token as string;
      if (token && typeof token === 'string') {
        if (!validateTotemToken(request.uin, token)) {
          return {
            success: false,
            error: 'Token inválido ou expirado',
            statusCode: 401,
            duration: Date.now() - startTime,
          };
        }
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);

      if (!totem) {
        return {
          success: false,
          error: 'Totem não encontrado',
          statusCode: 404,
          duration: Date.now() - startTime,
        };
      }

      const totemId = (totem as any).id;
      request.totemId = totemId;

      // Buscar informações adicionais (comandos pendentes, playlist ativa)
      // TODO: Implementar busca de comandos e playlist se necessário

      return {
        success: true,
        data: {
          valid: true,
          totem: {
            id: totemId,
            uin: request.uin,
            active: totem.active,
            status: (totem as any).status,
          },
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao validar totem',
        statusCode: 500,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handler para /api/player/dispatch
   */
  private async handleDispatch(request: DispatcherRequest): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return {
          success: false,
          error: 'UIN não fornecido',
          statusCode: 400,
          duration: Date.now() - startTime,
        };
      }

      // Validar token
      const token = request.query?.token as string;
      if (!token) {
        return {
          success: false,
          error: 'Token não fornecido',
          statusCode: 401,
          duration: Date.now() - startTime,
        };
      }

      const validHmac = validateTotemToken(request.uin, token);
      const deviceTokenService = getDeviceTokenService();
      const validDeviceToken = await deviceTokenService.validateToken(
        request.uin,
        token,
        {
          deviceId: request.deviceId || null,
          ipAddress: request.ipAddress || undefined,
          userAgent: request.userAgent || undefined,
        }
      );

      if (!validHmac && !validDeviceToken) {
        return {
          success: false,
          error: 'Token inválido ou expirado',
          statusCode: 401,
          duration: Date.now() - startTime,
        };
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);
      if (!totem || !totem.active) {
        return {
          success: false,
          error: 'Totem não encontrado ou inativo',
          statusCode: 404,
          duration: Date.now() - startTime,
        };
      }

      const totemId = (totem as any).id;
      request.totemId = totemId;

      // Chamar dispatcher
      const dispatcher = getDispatcherTotemService();
      const timestamp = request.query?.timestamp 
        ? new Date(request.query.timestamp as string)
        : new Date();
      const timezone = request.query?.timezone as string | undefined;

      const dispatchResponse = await dispatcher.dispatch(
        {
          totemId,
          timestamp,
          timezone,
        },
        {
          includeCandidates: false,
          skipCache: false,
        }
      );

      return {
        success: dispatchResponse.success,
        data: dispatchResponse.plan ? {
          success: true,
          plan: dispatchResponse.plan,
          fromCache: dispatchResponse.fromCache,
        } : {
          success: true,
          plan: null,
        },
        statusCode: 200,
        duration: Date.now() - startTime,
        fromCache: dispatchResponse.fromCache,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao obter dispatch plan',
        statusCode: 500,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handler para /api/player/heartbeat
   */
  private async handleHeartbeat(request: DispatcherRequest): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return {
          success: false,
          error: 'UIN não fornecido',
          statusCode: 400,
          duration: Date.now() - startTime,
        };
      }

      // Validar token
      const token = request.query?.token as string;
      if (!token) {
        return {
          success: false,
          error: 'Token não fornecido',
          statusCode: 401,
          duration: Date.now() - startTime,
        };
      }

      const validHmac = validateTotemToken(request.uin, token);
      const deviceTokenService = getDeviceTokenService();
      const validDeviceToken = await deviceTokenService.validateToken(
        request.uin,
        token,
        {
          deviceId: request.deviceId || null,
          ipAddress: request.ipAddress || undefined,
          userAgent: request.userAgent || undefined,
        }
      );

      if (!validHmac && !validDeviceToken) {
        return {
          success: false,
          error: 'Token inválido ou expirado',
          statusCode: 401,
          duration: Date.now() - startTime,
        };
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);
      if (!totem || !totem.active) {
        return {
          success: false,
          error: 'Totem não encontrado ou inativo',
          statusCode: 404,
          duration: Date.now() - startTime,
        };
      }

      const totemId = (totem as any).id;
      request.totemId = totemId;

      // Processar heartbeat
      const { executedCommands, metrics, status, version, firmwareVersion, ipAddress: heartbeatIp, config } = request.body || {};

      await totemService.processHeartbeat({
        totemId,
        status: status || 'online',
        version,
        firmwareVersion,
        ipAddress: heartbeatIp || request.ipAddress || undefined,
        config,
        metrics,
      });

      // Marcar comandos como executados
      if (executedCommands && Array.isArray(executedCommands) && executedCommands.length > 0) {
        const db = (await import('../config/database')).getDatabase();
        for (const cmdId of executedCommands) {
          await db.executeRaw(`
            UPDATE remote_commands 
            SET status = 'executed', executed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND totem_id = ?
          `, [cmdId, totemId]);
        }
      }

      // Buscar comandos pendentes
      const db = (await import('../config/database')).getDatabase();
      const pendingCommands = await db.findMany(`
        SELECT 
          rc.id as request_id,
          rc.command_type,
          rc.command_data,
          rc.priority
        FROM remote_commands rc
        WHERE rc.totem_id = ? 
          AND rc.status = 'pending'
        ORDER BY rc.priority DESC, rc.created_at ASC
        LIMIT 10
      `, [totemId]);

      const newToken = generateTotemToken(request.uin);

      // Renovar device_token
      try {
        await deviceTokenService.createOrUpdateToken({
          totemId,
          smartTvId: null,
          uin: request.uin,
          deviceId: request.deviceId || null,
          platform: request.platform || null,
          appVersion: version || null,
          ipAddress: heartbeatIp || request.ipAddress || null,
          userAgent: request.userAgent || null,
          ttlMs: 3600000,
        });
      } catch (e) {
        await logDebug('Falha ao renovar device_token no heartbeat', {
          error: (e as any)?.message,
          uin: request.uin,
        });
      }

      return {
        success: true,
        data: {
          success: true,
          token: newToken,
          pendingCommands: pendingCommands.map((cmd: any) => ({
            id: cmd.request_id,
            type: cmd.command_type,
            data: cmd.command_data,
            priority: cmd.priority,
          })),
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao processar heartbeat',
        statusCode: 500,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handler para /api/player/event
   */
  private async handleEvent(request: DispatcherRequest): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return {
          success: false,
          error: 'UIN não fornecido',
          statusCode: 400,
          duration: Date.now() - startTime,
        };
      }

      // Validar token se fornecido
      const token = request.query?.token as string;
      if (token && typeof token === 'string') {
        if (!validateTotemToken(request.uin, token)) {
          return {
            success: false,
            error: 'Token inválido ou expirado',
            statusCode: 401,
            duration: Date.now() - startTime,
          };
        }
      }

      // Buscar totem
      const db = (await import('../config/database')).getDatabase();
      const totem = await db.findFirst(`
        SELECT totem_id FROM totems WHERE uin = $1 LIMIT 1
      `, [request.uin]);

      if (!totem) {
        return {
          success: false,
          error: 'Totem não encontrado',
          statusCode: 404,
          duration: Date.now() - startTime,
        };
      }

      const totemId = totem.totem_id;
      request.totemId = totemId;

      // Registrar evento
      const { eventType, mediaId, playlistId, campaignId, duration, completed, metadata } = request.body || {};
      const eventLogService = getEventLogService();

      // TODO: Implementar registro de eventos completo
      // Por enquanto, apenas retornar sucesso
      const eventId = await eventLogService.logEvent({
        eventType: eventType as EventType,
        entityType: mediaId ? 'media' : playlistId ? 'playlist' : 'totem',
        entityId: mediaId || playlistId || totemId,
        mediaId,
        playlistId,
        campaignId,
        totemId,
        metadata,
      });

      return {
        success: true,
        data: {
          success: true,
          eventId,
          message: 'Evento registrado com sucesso',
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao registrar evento',
        statusCode: 500,
        duration: Date.now() - startTime,
      };
    }
  }
}

// Singleton
let dispatcherRouterInstance: DispatcherRouter | null = null;

export function getDispatcherRouter(): DispatcherRouter {
  if (!dispatcherRouterInstance) {
    dispatcherRouterInstance = new DispatcherRouter();
  }
  return dispatcherRouterInstance;
}

export default DispatcherRouter;

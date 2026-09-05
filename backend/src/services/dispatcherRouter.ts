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
import { normalizeDeviceId } from '../utils/normalizeDeviceId';
import { resolveDispatchPlanState } from '../utils/dispatchPlanState';
import { getPlaybackTelemetryService } from './playbackTelemetryService';
import { getWebSocketService } from './websocketService';
import { normalizeError } from '../utils/errors';

export interface DispatcherRequest {
  endpoint: string;
  method: string;
  uin?: string;
  totemId?: number;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  platform?: string;
  appVersion?: string;
}

export interface DispatcherResponse {
  success: boolean;
  data: Record<string, unknown>;
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
    const traceId = req.get('x-trace-id') || requestId;
    
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
        deviceId: normalizeDeviceId(req.query.deviceId as string || req.body?.deviceId) || undefined,
        platform: req.query.platform as string || req.body?.platform,
        appVersion: req.query.appVersion as string || req.body?.appVersion,
      };

      // Log incoming (amarelo) - requisição recebida
      const body = dispatcherRequest.body && typeof dispatcherRequest.body === 'object'
        ? (dispatcherRequest.body as unknown as Record<string, unknown>)
        : {};
      const media = body.media && typeof body.media === 'object'
        ? (body.media as Record<string, unknown>)
        : {};
      const meta = body.metadata && typeof body.metadata === 'object'
        ? (body.metadata as Record<string, unknown>)
        : {};
      dispatcherDebugService.logMessage('incoming', {
        traceId,
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
        eventType: body.eventType != null ? String(body.eventType) : undefined,
        mediaName:
          (media.name != null ? String(media.name) : undefined) ||
          (meta.mediaName != null ? String(meta.mediaName) : undefined) ||
          (meta.name != null ? String(meta.name) : undefined),
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
          handlerResponse = await this.processHeartbeat(dispatcherRequest);
          break;
        
        case '/api/player/event':
          handlerResponse = await this.handleEvent(dispatcherRequest);
          break;
        
        default:
          handlerResponse = { success: false, data: {}, error: `Endpoint não encontrado: ${endpoint}`, statusCode: 404, duration: Date.now() - startTime,
           };
      }

      // Log outgoing (verde se sucesso, vermelho se erro)
      dispatcherDebugService.logMessage('outgoing', {
        traceId,
        totemId: dispatcherRequest.totemId,
        uin: dispatcherRequest.uin,
        endpoint: dispatcherRequest.endpoint,
        method: dispatcherRequest.method,
        response: handlerResponse.success ? handlerResponse.data : { error: handlerResponse.error },
        error: handlerResponse.success ? undefined : handlerResponse.error,
        duration: handlerResponse.duration,
        fromCache: handlerResponse.fromCache,
        ipAddress: dispatcherRequest.ipAddress,
        statusCode: handlerResponse.statusCode,
        eventType: body.eventType != null ? String(body.eventType) : undefined,
        mediaName:
          (media.name != null ? String(media.name) : undefined) ||
          (meta.mediaName != null ? String(meta.mediaName) : undefined) ||
          (meta.name != null ? String(meta.name) : undefined),
      });

      // Enviar resposta HTTP
      res.status(handlerResponse.statusCode).json(
        handlerResponse.success 
          ? handlerResponse.data 
          : { error: handlerResponse.error }
      );} catch (error: unknown) {
      const e = normalizeError(error);
      const duration = Date.now() - startTime;
      
      // Log erro
      dispatcherDebugService.logMessage('outgoing', {
        traceId,
        totemId: undefined,
        uin: req.query.uin as string || req.body?.uin,
        endpoint,
        method: req.method,
        response: { success: false, error: 'Erro interno' },
        error: e.message || 'Erro interno do servidor',
        duration,
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        statusCode: 500,
        eventType: req.body?.eventType,
        mediaName: req.body?.media?.name || req.body?.metadata?.mediaName || req.body?.metadata?.name,
      });

      await logError(`[DispatcherRouter] Erro ao processar requisição ${endpoint}`, e.error, {
        requestId,
        endpoint,
        uin: req.query.uin,
      });

      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: e.message 
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
        return { success: false, data: {}, error: 'UIN não fornecido', statusCode: 400, duration: Date.now() - startTime,
         };
      }

      const hmacToken = generateTotemToken(request.uin);

      // Registrar também em device_tokens
      try {
        const totemService = new TotemService();
        const totem = await totemService.getTotemByUin(request.uin);
        const totemId = totem != null
          ? Number((totem as unknown as Record<string, unknown>).id) || null
          : null;

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
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        await logDebug('Falha ao registrar device_token', {
          error: (e.raw as { message?: string })?.message,
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
      };} catch (error: unknown) {
      const e = normalizeError(error);
      return { success: false, data: {}, error: e.message || 'Erro ao gerar token', statusCode: 500, duration: Date.now() - startTime,
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
        return { success: false, data: {}, error: 'UIN não fornecido', statusCode: 400, duration: Date.now() - startTime,
         };
      }

      // Validar token se fornecido (HMAC OU device_token — alinhado a dispatch/heartbeat/event)
      const token = request.query?.token as string;
      if (token && typeof token === 'string') {
        const validHmac = validateTotemToken(request.uin, token);
        const deviceTokenService = getDeviceTokenService();
        const validDeviceToken = await deviceTokenService.validateToken(request.uin, token, {
          deviceId: request.deviceId || null,
          ipAddress: request.ipAddress || undefined,
          userAgent: request.userAgent || undefined,
        });
        if (!validHmac && !validDeviceToken) {
          return { success: false, data: {}, error: 'Token inválido ou expirado', statusCode: 401, duration: Date.now() - startTime,
           };
        }
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);

      if (!totem) {
        return { success: false, data: {}, error: 'Totem não encontrado', statusCode: 404, duration: Date.now() - startTime,
         };
      }

      const totemId = Number((totem as unknown as Record<string, unknown>).id) || undefined;
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
            status: (totem as unknown as Record<string, unknown>).status != null
              ? String((totem as unknown as Record<string, unknown>).status)
              : undefined,
          },
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      return { success: false, data: {}, error: e.message || 'Erro ao validar totem', statusCode: 500, duration: Date.now() - startTime,
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
        return { success: false, data: {}, error: 'UIN não fornecido', statusCode: 400, duration: Date.now() - startTime,
         };
      }

      // Validar token
      const token = request.query?.token as string;
      if (!token) {
        return { success: false, data: {}, error: 'Token não fornecido', statusCode: 401, duration: Date.now() - startTime,
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
        return { success: false, data: {}, error: 'Token inválido ou expirado', statusCode: 401, duration: Date.now() - startTime,
         };
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);
      if (!totem) {
        return { success: false, data: {}, error: 'Totem não cadastrado no painel (UIN ou identificador desconhecido)', statusCode: 404, duration: Date.now() - startTime,
         };
      }
      if (!totem.active) {
        return { success: false, data: {}, error: 'Totem desativado no painel; reative em Totens para obter plano', statusCode: 404, duration: Date.now() - startTime,
         };
      }

      const totemId = totem.id;
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

      if (!dispatchResponse.success) {
        return {
          success: false,
          data: {},
          error: dispatchResponse.error || 'Não foi possível gerar plano de exibição',
          statusCode: 200, // Mantém 200 para compatibilidade com player
          duration: Date.now() - startTime,
          fromCache: dispatchResponse.fromCache,
        };
      }

      const noPlan = !dispatchResponse.plan;
      const planHasNoItems =
        !!dispatchResponse.plan &&
        (!dispatchResponse.plan.mediaItems || dispatchResponse.plan.mediaItems.length === 0);

      let emptyExplanation: import('../types/dispatcherTotem.types').DispatchEmptyExplanation | undefined;
      if (noPlan || planHasNoItems) {
        try {
          emptyExplanation = await dispatcher.buildEmptyPlanExplanation(totemId, timestamp, timezone);
} catch (ex: unknown) {
          const e = normalizeError(ex);
          await logDebug('[DispatcherRouter] buildEmptyPlanExplanation falhou', {
            totemId,
            error: e.message,
          });
        }
      }

      const defaultMeta = {
        noCandidatesReason:
          emptyExplanation?.summary ??
          'Nenhuma campanha elegível para este totem neste momento. Use o Monitor Dispatcher (abaixo) ou o endpoint de diagnóstico.',
        diagnosticsUrl: `/api/dispatcher-totem/${totemId}/diagnostics`,
        emptyExplanation,
      };

      // Sem plano: resposta vazia compatível com o player; metadata explica o motivo na UI.
      let plan = dispatchResponse.plan;
      if (!plan) {
        plan = {
          totemId,
          timestamp: new Date(),
          playlistId: 0,
          playlistName: '',
          mediaItems: [],
          totalDuration: 0,
          priority: 0,
          source: 'campaign' as const,
          sourceId: 0,
          validityStart: new Date(),
          validityEnd: new Date(),
          metadata: defaultMeta,
        };
      } else if (planHasNoItems && emptyExplanation) {
        // `plan` já estreito (ramo else de !plan); evita plan opcional no spread
        plan = {
          ...plan,
          metadata: {
            ...(plan.metadata || {}),
            ...defaultMeta,
          },
        };
      }

      // Retornar plano em formato consumível pelo player
      const planVersion =
        dispatchResponse.planVersion ||
        (plan ? (await getDispatcherTotemService().rememberPlanVersion(totemId, plan as any)) : null);
      const planState = resolveDispatchPlanState(plan);
      return {
        success: true,
        data: {
          success: true,
          plan,
          planState,
          planVersion,
          fromCache: dispatchResponse.fromCache,
          executionTimeMs: dispatchResponse.executionTimeMs,
        },
        statusCode: 200,
        duration: Date.now() - startTime,
        fromCache: dispatchResponse.fromCache,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      return { success: false, data: {}, error: e.message || 'Erro ao obter dispatch plan', statusCode: 500, duration: Date.now() - startTime,
       };
    }
  }

  /**
   * Handler para /api/player/heartbeat
   */
  async processHeartbeat(
    request: DispatcherRequest,
    authenticatedTotem?: Awaited<ReturnType<TotemService['getTotemByUin']>>
  ): Promise<DispatcherResponse> {
    const startTime = Date.now();
    
    try {
      if (!request.uin) {
        return { success: false, data: {}, error: 'UIN não fornecido', statusCode: 400, duration: Date.now() - startTime,
         };
      }

      const deviceTokenService = getDeviceTokenService();
      if (!authenticatedTotem) {
        // A rota sync fornece um totem já autenticado para não validar o envelope duas vezes.
        const token = request.query?.token as string;
        if (!token) {
          return { success: false, data: {}, error: 'Token não fornecido', statusCode: 401, duration: Date.now() - startTime,
           };
        }

        const validHmac = validateTotemToken(request.uin, token);
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
          return { success: false, data: {}, error: 'Token inválido ou expirado', statusCode: 401, duration: Date.now() - startTime,
           };
        }
      }

      // Buscar totem
      const totemService = new TotemService();
      const totem = authenticatedTotem || (await totemService.getTotemByUin(request.uin));
      if (!totem) {
        return { success: false, data: {}, error: 'Totem não cadastrado no painel (UIN ou identificador desconhecido)', statusCode: 404, duration: Date.now() - startTime,
         };
      }
      if (!totem.active) {
        return { success: false, data: {}, error: 'Totem desativado no painel; reative em Totens para enviar heartbeat', statusCode: 404, duration: Date.now() - startTime,
         };
      }

      const totemId = Number((totem as unknown as Record<string, unknown>).id) || 0;
      request.totemId = totemId;

      // Processar heartbeat
      const bodyHb = request.body && typeof request.body === 'object'
        ? (request.body as unknown as Record<string, unknown>)
        : {};
      const executedCommands = Array.isArray(bodyHb.executedCommands) ? bodyHb.executedCommands : [];
      const metricsRaw = bodyHb.metrics;
      const metrics = metricsRaw && typeof metricsRaw === 'object' && !Array.isArray(metricsRaw)
        ? (metricsRaw as unknown as Record<string, unknown>)
        : undefined;
      const status = bodyHb.status != null ? String(bodyHb.status) : undefined;
      const version = bodyHb.version != null ? String(bodyHb.version) : undefined;
      const firmwareVersion = bodyHb.firmwareVersion != null ? String(bodyHb.firmwareVersion) : undefined;
      const heartbeatIp = bodyHb.ipAddress != null ? String(bodyHb.ipAddress) : undefined;
      const configRaw = bodyHb.config;
      const config = configRaw && typeof configRaw === 'object' && !Array.isArray(configRaw)
        ? (configRaw as Record<string, unknown>)
        : undefined;
      const metricsObj: { cpu?: number; memory?: number; disk?: number; temperature?: number } | undefined = metrics
        ? {
            cpu: metrics.cpu != null ? Number(metrics.cpu) : undefined,
            memory: metrics.memory != null ? Number(metrics.memory) : undefined,
            disk: metrics.disk != null ? Number(metrics.disk) : undefined,
            temperature: metrics.temperature != null ? Number(metrics.temperature) : undefined,
          }
        : undefined;

      await totemService.processHeartbeat({
        totemId,
        status: status || 'online',
        version,
        firmwareVersion,
        ipAddress: heartbeatIp || request.ipAddress || undefined,
        config,
        metrics: metricsObj,
      });

      // Espelho nowPlaying + telemetria do Player-AD (relógio, idle, versão).
      // NÃO sobrescrever displaySchedule / pollAdaptive do cadastro com o espelho do player.
      try {
        const m = metrics && typeof metrics === 'object' ? (metrics as unknown as Record<string, unknown>) : {};
        const nowPlaying = m.nowPlaying ?? m.now_playing ?? null;
        const rawPs =
          m.playerSettings && typeof m.playerSettings === 'object' && !Array.isArray(m.playerSettings)
            ? (m.playerSettings as unknown as Record<string, unknown>)
            : m.player_settings && typeof m.player_settings === 'object' && !Array.isArray(m.player_settings)
              ? (m.player_settings as unknown as Record<string, unknown>)
              : {};
        const deviceClock =
          m.deviceClock ?? m.device_clock ?? rawPs.reportedDeviceClock ?? null;

        const telemetry: Record<string, unknown> = {};
        if (deviceClock != null && typeof deviceClock === 'object' && !Array.isArray(deviceClock)) {
          const serverReceivedAtMs = Date.now();
          const epochMs = Number((deviceClock as unknown as Record<string, unknown>).epochMs || 0);
          telemetry.reportedDeviceClock = {
            ...(deviceClock as unknown as Record<string, unknown>),
            serverReceivedAtMs,
            ...(Number.isFinite(epochMs) && epochMs > 0
              ? { clockDriftMs: epochMs - serverReceivedAtMs }
              : {}),
          };
        }
        if (rawPs.displayIdle !== undefined) telemetry.displayIdle = rawPs.displayIdle;
        else if (m.displayIdle !== undefined) telemetry.displayIdle = m.displayIdle;
        if (rawPs.appVersion != null) telemetry.appVersion = rawPs.appVersion;
        else if (m.appVersion != null) telemetry.appVersion = m.appVersion;
        if (rawPs.displayRotation != null) telemetry.displayRotation = rawPs.displayRotation;
        if (rawPs.screenOrientation != null) telemetry.screenOrientation = rawPs.screenOrientation;
        if (rawPs.kioskMode != null) telemetry.kioskMode = rawPs.kioskMode;
        if (rawPs.batimentoCardiaco != null) telemetry.batimentoCardiaco = rawPs.batimentoCardiaco;
        if (rawPs.maxSecondsWithoutServerCheck != null) {
          telemetry.maxSecondsWithoutServerCheck = rawPs.maxSecondsWithoutServerCheck;
        }

        const hasTelemetry = Object.keys(telemetry).length > 0;
        if (nowPlaying != null || hasTelemetry) {
          const dbHb = (await import('../config/database')).getDatabase();
          await dbHb.executeRaw(
            `
            UPDATE totems
            SET now_playing = COALESCE($2::jsonb, now_playing),
                player_settings = CASE
                  WHEN $3::jsonb IS NULL THEN player_settings
                  ELSE COALESCE(player_settings, '{}'::jsonb) || $3::jsonb
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE totem_id = $1
          `,
            [
              totemId,
              nowPlaying != null ? JSON.stringify(nowPlaying) : null,
              hasTelemetry ? JSON.stringify(telemetry) : null,
            ]
          );
        }
        const displayIdle = telemetry.displayIdle;
        if (displayIdle !== undefined) {
          const currentState = await getPlaybackTelemetryService().getCurrentState(totemId);
          getWebSocketService().broadcastPlaybackState(totemId, {
            ...(currentState || { totemId }),
            displayIdle: displayIdle === true,
            deviceClock: telemetry.reportedDeviceClock ?? null,
          });
        }
 
} catch (eCatch: unknown) {

        const e = normalizeError(eCatch);
        await logDebug('Falha ao gravar now_playing/player_settings (colunas podem faltar até apply schema)', {
          error: e?.message,
          totemId,
        });
      }

      // ACK legado embutido no HB → status canónico `completed` (CHECK remoto; não usar `executed`)
      if (executedCommands && Array.isArray(executedCommands) && executedCommands.length > 0) {
        const { getRemoteCommandService } = await import('./remoteCommandService');
        const remoteAck = getRemoteCommandService();
        for (const cmdId of executedCommands) {
          const id = Number(cmdId);
          if (!Number.isFinite(id) || id <= 0) continue;
          try {
            await remoteAck.markCommandAsCompleted(id, { source: 'heartbeat_executedCommands' });
          } catch {
            /* comando inexistente / já terminal — ignorar */
          }
        }
      }

      // Buscar comandos pendentes e marcar como sent (anti-duplicado)
      const { getRemoteCommandService } = await import('./remoteCommandService');
      const remoteCommandService = getRemoteCommandService();
      const claimed = await remoteCommandService.claimPendingCommands(totemId, 10);
      const pendingCommands = claimed.map((cmd) => ({
        request_id: cmd.id,
        command_type: cmd.commandType,
        command_data: cmd.commandData,
        priority: 1,
      }));

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
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        await logDebug('Falha ao renovar device_token no heartbeat', {
          error: (e.raw as { message?: string })?.message,
          uin: request.uin,
        });
      }

      const { resolveOtaUpdateForHeartbeat } = await import('./otaHeartbeatHelper');
      const otaUpdate = await resolveOtaUpdateForHeartbeat(totemId, request.body as unknown as Record<string, unknown>);
      const telemetryObservation = await getPlaybackTelemetryService().getObservation(totemId);

      let displaySchedule: unknown = null;
      let pollAdaptive: unknown = null;
      try {
        const db = (await import('../config/database')).getDatabase();
        const row = await db.findFirst(
          `SELECT player_settings FROM totems WHERE totem_id = $1`,
          [totemId]
        );
        const settings = row?.player_settings;
        if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
          displaySchedule = (settings as unknown as Record<string, unknown>).displaySchedule ?? null;
          pollAdaptive = (settings as unknown as Record<string, unknown>).pollAdaptive ?? null;
        } else if (typeof settings === 'string') {
          try {
            const parsed = JSON.parse(settings);
            displaySchedule = parsed?.displaySchedule ?? null;
            pollAdaptive = parsed?.pollAdaptive ?? null;
          } catch {
            displaySchedule = null;
            pollAdaptive = null;
          }
        }
      } catch {
        displaySchedule = null;
        pollAdaptive = null;
      }

      // Versão do plano: player só pede GET /dispatch quando muda (ou no boot).
      let planVersion: string | null = null;
      let needsDispatch = true;
      try {
        const metricsObj =
          metrics && typeof metrics === 'object' ? (metrics as unknown as Record<string, unknown>) : {};
        const knownPlanVersion = String(
          metricsObj.knownPlanVersion ||
            metricsObj.known_plan_version ||
            request.body?.knownPlanVersion ||
            ''
        ).trim();
        const peeked = await getDispatcherTotemService().peekPlanVersion(totemId);
        planVersion = peeked.planVersion;
        if (planVersion && knownPlanVersion && planVersion === knownPlanVersion) {
          needsDispatch = false;
        } else if (planVersion && !knownPlanVersion) {
          needsDispatch = true;
        } else if (!planVersion) {
          // Sem versão conhecida no servidor → player deve pedir dispatch (boot / após invalidate).
          needsDispatch = true;
        } else {
          needsDispatch = true;
        }
      } catch {
        planVersion = null;
        needsDispatch = true;
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
          otaUpdate: otaUpdate || null,
          displaySchedule,
          pollAdaptive,
          planVersion,
          needsDispatch,
          telemetryObservation,
        },
        statusCode: 200,
        duration: Date.now() - startTime,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      return { success: false, data: {}, error: e.message || 'Erro ao processar heartbeat', statusCode: 500, duration: Date.now() - startTime,
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
        return { success: false, data: {}, error: 'UIN não fornecido', statusCode: 400, duration: Date.now() - startTime,
         };
      }

      // Validar token se fornecido (HMAC do totem OU device_token — igual a dispatch/heartbeat)
      const token = request.query?.token as string;
      if (token && typeof token === 'string') {
        const validHmac = validateTotemToken(request.uin, token);
        const deviceTokenService = getDeviceTokenService();
        const meta = request.body?.metadata;
        const deviceIdFromMeta =
          meta && typeof meta === 'object' && meta !== null && typeof (meta as unknown as Record<string, unknown>).deviceId === 'string'
            ? normalizeDeviceId((meta as unknown as Record<string, unknown>).deviceId) || null
            : null;
        const effectiveDeviceId = normalizeDeviceId(request.deviceId) || deviceIdFromMeta;
        const validDeviceToken = await deviceTokenService.validateToken(request.uin, token, {
          deviceId: effectiveDeviceId || null,
          ipAddress: request.ipAddress || undefined,
          userAgent: request.userAgent || undefined,
        });

        if (!validHmac && !validDeviceToken) {
          return { success: false, data: {}, error: 'Token inválido ou expirado', statusCode: 401, duration: Date.now() - startTime,
           };
        }
      }

      // Buscar totem (alinhar com heartbeat/dispatch: uin OU identifier; inativo ≠ inexistente)
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(request.uin);
      if (!totem) {
        return { success: false, data: {}, error: 'Totem não cadastrado no painel (UIN ou identificador desconhecido)', statusCode: 404, duration: Date.now() - startTime,
         };
      }
      if (!totem.active) {
        return { success: false, data: {}, error: 'Totem desativado no painel; reative em Totens para registar eventos', statusCode: 404, duration: Date.now() - startTime,
         };
      }

      const totemId = Number(totem.id) || 0;
      request.totemId = totemId;

      // Registrar evento no event_logs (totem_id, entityType, entityId, etc.)
      const bodyEv = request.body && typeof request.body === 'object'
        ? (request.body as unknown as Record<string, unknown>)
        : {};
      const eventType = bodyEv.eventType;
      const rawMediaId = bodyEv.mediaId;
      const rawPlaylistId = bodyEv.playlistId;
      const rawCampaignId = bodyEv.campaignId;
      const rawMetadata = bodyEv.metadata;
      const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
        ? (rawMetadata as Record<string, unknown>)
        : undefined;
      const eventLogService = getEventLogService();

      // mediaId pode ser número ou string de fallback (fb-*); event_logs.media_id é INTEGER
      const isFallbackId = typeof rawMediaId === 'string' && rawMediaId.startsWith('fb-');
      const mediaIdNum = rawMediaId != null && !isFallbackId ? Number(rawMediaId) : null;
      const validMediaId = typeof mediaIdNum === 'number' && !Number.isNaN(mediaIdNum) ? mediaIdNum : null;
      const playlistIdNum = rawPlaylistId != null ? Number(rawPlaylistId) : null;
      const playlistId = typeof playlistIdNum === 'number' && !Number.isNaN(playlistIdNum) ? playlistIdNum : undefined;
      const campaignIdNum = rawCampaignId != null ? Number(rawCampaignId) : null;
      const campaignId = typeof campaignIdNum === 'number' && !Number.isNaN(campaignIdNum) ? campaignIdNum : undefined;
      const effectiveEntityId = validMediaId ?? playlistId ?? totemId;
      const entityType = validMediaId != null ? 'media' : playlistId ? 'playlist' : 'totem';

      const eventId = await eventLogService.logEvent({
        eventType: eventType as EventType,
        entityType,
        entityId: typeof effectiveEntityId === 'number' && !Number.isNaN(effectiveEntityId) ? effectiveEntityId : totemId,
        mediaId: validMediaId ?? undefined,
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
      };} catch (error: unknown) {
      const e = normalizeError(error);
      return { success: false, data: {}, error: e.message || 'Erro ao registrar evento', statusCode: 500, duration: Date.now() - startTime,
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

import express, { Request, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { TotemService } from '../services/totemService';
import { getDatabase } from '../config/database';
import { playerDebugService } from '../services/playerDebugService';
import { dispatcherDebugService } from '../services/dispatcherDebugService';
import { getEventLogService, EventType } from '../services/eventLogService';
import { getRemoteCommandService } from '../services/remoteCommandService';
import { validateRequest } from '../middleware/validation.middleware';
import { logError, logDebug, sanitizeForLogging, logWarn, logInfo } from '../utils/loggerHelper';
import { getDispatcherRouter } from '../services/dispatcherRouter';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { getTotemSecretKey } from '../config/totemSecurity';
import { decryptOpenSslSaltedBase64 } from '../utils/totemEncryption';
import { normalizeTotemUin } from '../utils/normalizeTotemUin';

const execAsync = promisify(exec);

const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function listMediaFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  return files
    .filter((f) => f.isFile() && (VIDEO_EXT.includes(path.extname(f.name).toLowerCase()) || IMAGE_EXT.includes(path.extname(f.name).toLowerCase())))
    .map((f) => f.name)
    .sort((a, b) => path.basename(a, path.extname(a)).localeCompare(path.basename(b, path.extname(b)), undefined, { numeric: true }));
}

const router = express.Router();
const dispatcherRouter = getDispatcherRouter();

/** Alinha UIN em query/body ao formato canónico (igual Player-AD / player-web). */
function normalizePlayerRequestUin(req: express.Request): void {
  const q = req.query.uin;
  const qStr = Array.isArray(q) ? q[0] : q;
  if (typeof qStr === 'string' && qStr.trim()) {
    (req.query as Record<string, unknown>).uin = normalizeTotemUin(qStr);
  }
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const raw = (req.body as { uin?: unknown }).uin;
    if (typeof raw === 'string' && raw.trim()) {
      (req.body as { uin: string }).uin = normalizeTotemUin(raw);
    }
  }
}

router.use((req, _res, next) => {
  try {
    normalizePlayerRequestUin(req);
  } catch {
    /* não bloquear o pipeline */
  }
  next();
});

/**
 * Processa solicitação de aprovação via heartbeat
 * Detecta heartbeat de solicitação de aprovação, coleta informações e vincula hardware
 */
async function handleApprovalRequest(
  req: Request,
  res: Response,
  uin: string,
  hardware: any
): Promise<Response> {
  const requestId = `HB-APPROVAL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();

  try {
    await logDebug(`[${requestId}] Heartbeat de solicitação de aprovação recebido`, { 
      uin, 
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    const db = getDatabase();
    const totemService = new TotemService();
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // VALIDAÇÃO CRÍTICA: UIN deve existir (pré-cadastrado pelo publisher)
    const existingTotem = await totemService.getTotemByUin(uin);
    if (!existingTotem) {
      await logDebug(`[${requestId}] UIN não encontrado - totem deve ser pré-cadastrado`, { uin, requestId });
      return res.status(404).json({ 
        error: 'UIN não cadastrado',
        uin: uin,
        message: 'Este UIN não está cadastrado no sistema. O totem deve ser cadastrado pelo publisher antes de se conectar.',
        suggestion: 'Entre em contato com o administrador para cadastrar este totem.',
        requestId: requestId
      });
    }

    await logDebug(`[${requestId}] UIN encontrado - totem pré-cadastrado`, { 
      totemId: (existingTotem as any).id || (existingTotem as any).totem_id,
      identifier: (existingTotem as any).identifier,
      currentStatus: (existingTotem as any).status,
      requestId 
    });

    // Verificar se hardware já está vinculado a OUTRO totem (prevenção de clonagem)
    const hardwareHash = hardware?.hardwareHash || (hardware?.macAddress || '').toLowerCase();
    const currentTotemId = (existingTotem as any).id || (existingTotem as any).totem_id;
    
    if ((hardwareHash && hardwareHash !== 'unknown' && hardware?.macAddress) || hardware?.deviceId) {
      try {
        const existingHardware = await db.findFirst(`
          SELECT totem_id, uin, identifier
          FROM totems
          WHERE (network_info->'hardware'->>'mac' = ?
             OR network_info->'hardware'->>'hardwareHash' = ?
             OR (? <> '' AND device_id = ?))
            AND totem_id != ?
          LIMIT 1
        `, [hardware?.macAddress || '', hardwareHash, hardware?.deviceId || '', hardware?.deviceId || '', currentTotemId]);
        
        if (existingHardware) {
          await logDebug(`[${requestId}] Hardware já vinculado a outro totem`, { existingHardware, requestId });
          return res.status(409).json({ 
            error: 'Hardware já vinculado',
            message: 'Este hardware já está vinculado a outro totem',
            existingTotem: {
              id: existingHardware.totem_id,
              uin: existingHardware.uin,
              identifier: existingHardware.identifier
            },
            requestId: requestId
          });
        }
      } catch (hardwareCheckError: any) {
        await logError(`[${requestId}] Erro ao verificar hardware duplicado`, hardwareCheckError, { requestId });
      }
    }

    // Obter dados do totem pré-cadastrado
    const totemId = currentTotemId;
    const existingConfig = (existingTotem as any).config || {};
    const existingIdentifier = (existingTotem as any).identifier || hardware?.hostname || `TOTEM-${totemId}`;
    const existingStatus = (existingTotem as any).status || 'pending_activation';

    // Preparar configuração: preservar dados do publisher e adicionar hardware info
    const networkInfo = {
      ...existingConfig,
      hardware: {
        ...(existingConfig.hardware || {}),
        mac: hardware?.macAddress || existingConfig.hardware?.mac || null,
        hostname: hardware?.hostname || existingConfig.hardware?.hostname || null,
        platform: hardware?.platform || existingConfig.hardware?.platform || null,
        arch: hardware?.arch || existingConfig.hardware?.arch || null,
        serial: hardware?.serial || existingConfig.hardware?.serial || null,
        hardwareHash: hardware?.hardwareHash || existingConfig.hardware?.hardwareHash || null,
        registeredAt: existingConfig.hardware?.registeredAt || new Date().toISOString(),
        linkedAt: new Date().toISOString(),
        userAgent: hardware?.userAgent || existingConfig.hardware?.userAgent || req.get('user-agent') || null
      }
    };

    // Determinar novo status: se estava pending_activation, muda para pending_approval
    const newStatus = existingStatus === 'pending_activation' ? 'pending_approval' : existingStatus;
    
    await logDebug(`[${requestId}] Atualizando totem pré-cadastrado com hardware info`, {
      totemId,
      identifier: existingIdentifier,
      status: `${existingStatus} → ${newStatus}`,
      requestId
    });
    
    // ATUALIZAR totem existente (não criar novo)
    await db.executeRaw(`
      UPDATE totems SET
        network_info = ?::jsonb,
        device_id = COALESCE(NULLIF(?, ''), device_id),
        last_heartbeat = CURRENT_TIMESTAMP,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE uin = ?
    `, [
      JSON.stringify({
        ...networkInfo,
        ip: ipAddress,
      }),
      hardware?.deviceId || null,
      newStatus,
      uin
    ]);

    await logDebug(`[${requestId}] Totem atualizado com hardware vinculado`, { totemId, uin, requestId });

    // Buscar totem atualizado
    const updatedTotem = await totemService.getTotemByUin(uin);
    if (!updatedTotem) {
      await logError(`[${requestId}] Totem não encontrado após atualização`, new Error('Totem não encontrado'), { totemId, uin, requestId });
      return res.status(500).json({ 
        error: 'Erro ao vincular hardware',
        message: 'Totem atualizado mas não encontrado após atualização',
        requestId: requestId
      });
    }

    // Gerar token de validação
    const token = generateTotemToken(uin);
    const duration = Date.now() - startTime;
    const finalStatus = (updatedTotem as any).status || newStatus;

    // Tentar gerar config.json.enc se totem estiver aprovado ou se for auto-aprovação
    let configGenerated = false;
    let encryptedConfigPath = null;

    // Se status for 'online' ou se houver flag de auto-aprovação, gerar config
    if (finalStatus === 'online' || req.body?.autoApprove === true) {
      try {
        // Usar variável de ambiente ou padrão
        const playerDir = process.env.PLAYER_DIR || '/opt/smart-signage/player-web';
        const path = require('path');
        const scriptPath = process.env.GENERATE_CONFIG_SCRIPT || 
                         path.join(__dirname, '../../scripts/generate-player-config.sh');
        
        await execAsync(`bash "${scriptPath}" "${uin}" "${playerDir}" "${getTotemSecretKey()}"`, {
          timeout: 10000
        });
        
        encryptedConfigPath = `${playerDir}/config.json.enc`;
        configGenerated = true;
        await logInfo(`[${requestId}] Config.json.enc gerado automaticamente`, { uin, path: encryptedConfigPath });
      } catch (configError: any) {
        await logWarn(`[${requestId}] Erro ao gerar config encriptado (continuando)`, { error: configError.message });
      }
    }

    // Registrar evento
    try {
      const eventLogService = getEventLogService();
      await eventLogService.logEvent({
        eventType: EventType.SYSTEM_EVENT,
        entityType: 'totem',
        entityId: (updatedTotem as any).id || totemId,
        totemId: (updatedTotem as any).id || totemId,
        metadata: {
          action: 'hardware_linked_via_heartbeat',
          previousStatus: existingStatus,
          newStatus: finalStatus,
          ipAddress,
          requestId,
          hardware: {
            mac: hardware?.macAddress,
            hostname: hardware?.hostname,
            platform: hardware?.platform,
            arch: hardware?.arch
          },
          configGenerated
        }
      });
    } catch (eventError: any) {
      await logError(`[${requestId}] Erro ao registrar evento`, eventError, { totemId, requestId });
    }

    const responseData = {
      success: true,
      message: 'Hardware vinculado ao totem pré-cadastrado com sucesso via heartbeat.',
      status: finalStatus,
      uin: uin,
      token: token,
      configGenerated: configGenerated,
      encryptedConfigPath: encryptedConfigPath || undefined,
      totem: {
        id: (updatedTotem as any).id || totemId,
        uin: uin,
        identifier: (updatedTotem as any).identifier || existingIdentifier,
        status: finalStatus,
        active: (updatedTotem as any).active !== false,
        message: finalStatus === 'pending_approval' 
          ? 'Aguardando aprovação do administrador para ativação'
          : finalStatus === 'online'
          ? 'Totem ativo e pronto para uso'
          : 'Hardware vinculado com sucesso'
      },
      requestId: requestId,
      duration: `${duration}ms`
    };

    await logDebug(`[${requestId}] Hardware vinculado via heartbeat com sucesso`, { 
      duration, 
      totemId,
      status: finalStatus,
      configGenerated,
      requestId 
    });

    return res.json(responseData);
  } catch (error: any) {
    await logError(`[${requestId}] Erro ao processar solicitação de aprovação via heartbeat`, error, { uin, requestId });
    return res.status(500).json({ 
      error: 'Erro ao processar solicitação de aprovação',
      message: error.message || 'Erro interno do servidor',
      requestId: requestId
    });
  }
}

// Chave secreta para validação de totem — ver getTotemSecretKey()
export function generateTotemToken(uin: string): string {
  const timestamp = Date.now();
  const data = `${uin}:${timestamp}`;
  const token = crypto
    .createHmac('sha256', getTotemSecretKey())
    .update(data)
    .digest('hex');
  return `${timestamp}:${token}`;
}

/**
 * Validar token de totem
 */
export function validateTotemToken(uin: string, token: string, maxAge: number = 3600000): boolean {
  try {
    const [timestamp, receivedToken] = token.split(':');
    if (!timestamp || !receivedToken) return false;

    const age = Date.now() - parseInt(timestamp);
    if (age > maxAge || age < 0) return false; // Token expirado ou inválido

    const expectedToken = crypto
      .createHmac('sha256', getTotemSecretKey())
      .update(`${uin}:${timestamp}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedToken),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * @route GET /api/player/config
 * @desc Configuração do player (serverUrl, heartbeat, storage externo/interno, etc.)
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const { SystemService } = await import('../services/systemService');
    const systemService = new SystemService();
    const playerConfig = await systemService.getPlayerConfig();
    return res.json(playerConfig);
  } catch (err: any) {
    await logError('Erro ao obter config do player', err);
    return res.status(500).json({ error: err.message || 'Erro ao obter config' });
  }
});

/**
 * @route GET /api/player/fallback-manifest
 * @desc Lista arquivos de propagandas e vinhetas para modo fallback (sem autenticação)
 */
router.get('/fallback-manifest', async (_req: Request, res: Response) => {
  try {
    const playerDir = process.env.PLAYER_DIR || config.player.dir || '/opt/smart-signage/player-web';
    const propagandasDir = path.join(playerDir, 'propagandas');
    const vinhetasDir = path.join(playerDir, 'vinhetas');

    const propagandas = listMediaFiles(propagandasDir);
    const vinhetas = listMediaFiles(vinhetasDir);

    return res.json({ propagandas, vinhetas });
  } catch (err: any) {
    await logError('Erro ao listar manifest de fallback', err);
    return res.status(500).json({ error: err.message || 'Erro ao listar fallback' });
  }
});

/**
 * @route GET /api/player/validate
 * @desc Validar totem por UIN e token, retornar status, comandos pendentes e playlist
 * @access Public (para totens na porta 80)
 * @note Todas as requisições passam pelo DispatcherRouter para monitoramento centralizado
 * @res 404 Totem não encontrado = UIN não está registrado; cadastre o totem no painel (Anunciantes → Publishers → Totens) com o mesmo UIN.
 */
router.get('/validate',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').optional().isString(),
  async (req: Request, res: Response) => {
    // Validação de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
    }
    
    // Delegar para DispatcherRouter (ponto central de roteamento)
    return await dispatcherRouter.route(req, res, '/api/player/validate');
  }
);

/**
 * @route GET /api/player/token

      // Validar token se fornecido
      if (token && typeof token === 'string') {
        if (!validateTotemToken(uin as string, token)) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      // Validar UIN não vazio
      if (!uin || (uin as string).trim() === '') {
        return res.status(400).json({ 
          error: 'UIN não fornecido ou vazio',
          details: 'O parâmetro UIN é obrigatório e não pode estar vazio'
        });
      }

      // Buscar totem por UIN
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(uin as string);

      if (!totem) {
        await logDebug(`[${transactionId}] UIN não encontrado`, { uin, transactionId });
        
        // Logar erro no debug
        dispatcherDebugService.logMessage('outgoing', {
          totemId: undefined,
          uin: uin as string,
          endpoint: '/api/player/validate',
          method: 'GET',
          response: {
            success: false,
            error: 'Totem não encontrado'
          },
          error: `Nenhum totem encontrado com UIN: ${uin}`,
        });
        
        await playerDebugService.logTransaction({
          transactionId,
          uin: uin as string,
          action: 'validate',
          status: 'error',
          requestUrl: req.url,
          requestMethod: req.method,
          requestHeaders: req.headers,
          responseStatus: 404,
          responseBody: { error: 'Totem não encontrado' },
          errorMessage: `Nenhum totem encontrado com UIN: ${uin}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          duration: Date.now() - startTime,
          metadata: { suggestion: 'Cadastre o totem pelo publisher antes de conectar' }
        });
        
        return res.status(404).json({ 
          error: 'Totem não encontrado',
          details: `Nenhum totem encontrado com UIN: ${uin}`,
          suggestion: 'Verifique se o UIN está correto ou se o totem foi registrado no sistema',
          canAutoRegister: true
        });
      }

      // Verificar bloqueios adicionais (campo status pode indicar bloqueio)
      let totemFull = null;
      try {
        totemFull = await db.findFirst(`
          SELECT 
            t.totem_id,
            t.identifier,
            t.status,
            t.is_active as active,
            t.config
          FROM totems t
          WHERE t.identifier = ? OR t.uin = ?
          LIMIT 1
        `, [uin, uin]);
      } catch (queryError: any) {
        await logError(`[${transactionId}] Erro ao buscar totem completo`, queryError, { uin, transactionId });
        // Continuar sem totemFull se houver erro na query
      }

      // Verificar se totem está pendente de aprovação
      if (totemFull && (totemFull as any).status === 'pending_approval') {
        return res.status(403).json({ 
          error: 'Totem aguardando aprovação',
          blocked: true,
          pendingApproval: true,
          reason: 'Este totem vinculou hardware ao pré-cadastro e está aguardando aprovação do administrador',
          message: 'Aguarde aprovação do administrador para ativação',
          totem: {
            id: (totemFull as any).totem_id,
            uin: uin,
            identifier: totemFull.identifier,
            status: 'pending_approval'
          }
        });
      }

      // Verificar se totem está ativo (totem já foi verificado como não-null acima)
      if (!totem) {
        // Este caso não deveria acontecer devido à verificação anterior, mas adicionamos por segurança
        return res.status(404).json({ 
          error: 'Totem não encontrado',
          blocked: true,
          reason: 'Totem não encontrado no sistema'
        });
      }

      // Verificar propriedade active (pode não existir em todos os schemas)
      const isActive = (totem as any)?.active !== false && (totem as any)?.is_active !== false;
      if (!isActive) {
        return res.status(403).json({ 
          error: 'Totem inativo',
          blocked: true,
          reason: 'Totem desativado no sistema'
        });
      }

      // Determinar o ID numérico do totem para consultas relacionadas
      const totemId = (totemFull && (totemFull as any)?.totem_id) || (totem as any)?.id || (totem as any)?.totem_id;
      
      if (!totemId) {
        await logError(`[${transactionId}] Não foi possível determinar totem_id`, new Error('totem_id não encontrado'), { uin, transactionId, totem: !!totem, totemFull: !!totemFull });
        return res.status(500).json({ 
          error: 'Erro interno do servidor',
          details: 'Não foi possível determinar ID do totem'
        });
      }

      // OBS (schema v2): colunas blocked/blocked_until não existem no schema atual.

      // Buscar comandos remotos pendentes e marcar como sent (anti-duplicado)
      let pendingCommands: any[] = [];
      try {
        const remoteCommandService = getRemoteCommandService();
        const claimed = await remoteCommandService.claimPendingCommands(totemId, 10);
        pendingCommands = claimed.map((cmd) => ({
          request_id: cmd.id,
          command_type: cmd.commandType,
          command_data: cmd.commandData,
          created_at: cmd.createdAt,
          status: cmd.status,
        }));
      } catch (cmdError: any) {
        await logError(`[${transactionId}] Erro ao buscar comandos remotos`, cmdError, { totemId, transactionId });
        // Continuar mesmo se houver erro ao buscar comandos
      }

      // Buscar playlist ativa do totem através de campanha (forma 2: campaign_totems).
      let activePlaylist = null;
      try {
        activePlaylist = await db.findFirst(`
          SELECT 
            p.playlist_id,
            p.name,
            p.description,
            p.config,
            ct.campaign_id,
            c.title as campaign_title,
            ct.start_date as schedule_start,
            ct.end_date as schedule_end
          FROM playlists p
          INNER JOIN campaign_playlists cp ON p.playlist_id = cp.playlist_id
          INNER JOIN campaign_totems ct ON cp.campaign_id = ct.campaign_id
          INNER JOIN campaigns c ON ct.campaign_id = c.campaign_id
          WHERE ct.totem_id = ?
            AND c.is_active = true
            AND c.status = 'active'
            AND p.is_active = true
            AND (ct.start_date IS NULL OR ct.start_date <= CURRENT_TIMESTAMP)
            AND (ct.end_date IS NULL OR ct.end_date >= CURRENT_TIMESTAMP)
          ORDER BY c.priority DESC, ct.start_date DESC
          LIMIT 1
        `, [totemId]);
      } catch (playlistError: any) {
        await logError(`[${transactionId}] Erro ao buscar playlist ativa`, playlistError, { totemId, transactionId });
      }

      // Se não tiver playlist via campanha, buscar playlist direta do totem
      let playlist = activePlaylist;
      if (!playlist) {
        playlist = await db.findFirst(`
          SELECT 
            p.playlist_id,
            p.name,
            p.description,
            p.config,
            NULL::INTEGER as campaign_id,
            NULL::TEXT as campaign_title
          FROM playlists p
          WHERE p.totem_id = ?
            AND p.is_active = true
          ORDER BY p.generated_at DESC
          LIMIT 1
        `, [totemId]);
      }

      // Buscar itens da playlist se houver
      let playlistItems: any[] = [];
      if (playlist && playlist.playlist_id) {
        playlistItems = await db.findMany(`
          SELECT 
            pi.item_id,
            pi.playlist_id,
            pi.media_id,
            pi.order_index,
            COALESCE(
              NULLIF(pi.display_seconds, 0),
              CASE
                WHEN LOWER(COALESCE(m.media_type, '')) IN ('video', 'audio')
                  THEN COALESCE(NULLIF(m.duration_seconds, 0), 10)
                ELSE 10
              END
            ) as duration,
            m.name as media_name,
            m.file_path,
            m.media_type,
            m.mime_type,
            m.duration_seconds,
            m.size_bytes as file_size
          FROM playlist_items pi
          LEFT JOIN medias m ON pi.media_id = m.media_id
          WHERE pi.playlist_id = ?
          ORDER BY pi.order_index ASC
        `, [playlist.playlist_id]);
      }

      // Verificar atualização OTA disponível
      let otaUpdate = null;
      if (totemId) {
        try {
          const { getOTAUpdateService } = await import('../services/otaUpdateService');
          const otaService = getOTAUpdateService();
          const currentVersion = (totemFull?.config as any)?.version || '1.0.0';
          const platform = (totemFull?.config as any)?.platform || 'linux';
          otaUpdate = await otaService.getAvailableUpdate(totemId, currentVersion, platform);
          
          // Atualizar status de atualização do totem
          if (otaUpdate) {
            await otaService.updateTotemStatus(totemId, {
              totemId,
              currentVersion,
              availableVersion: otaUpdate.version,
              updateStatus: 'update_available',
              lastCheck: new Date()
            });
          } else {
            await otaService.updateTotemStatus(totemId, {
              totemId,
              currentVersion,
              updateStatus: 'up_to_date',
              lastCheck: new Date()
            });
          }
        } catch (error: any) {
          // Não falhar o heartbeat se OTA falhar
          await logError('Erro ao verificar atualização OTA', error, { totemId });
        }
      }

      // Gerar novo token para resposta
      const newToken = generateTotemToken(uin as string);

      // Atualizar último heartbeat (usando identifier ou uin para encontrar totem_id)
      if (totemId) {
        await db.executeRaw(`
          UPDATE totems 
          SET last_heartbeat = CURRENT_TIMESTAMP, status = 'online'
          WHERE totem_id = ?
        `, [totemId]);
      }

      return res.json({
        valid: true,
        totem: {
          id: totemId,
          uin: uin,
          identifier: totemFull?.identifier || (totem as any).identifier,
          name: (totem as any).name || totemFull?.identifier || uin,
          location: (totem as any).location || totemFull?.description,
          subscriberId: (totem as any).subscriberId || (totem as any).subscriber_id,
          subscriberName: (totem as any).subscriberName || (totem as any).subscriber_name,
          status: totemFull?.status || 'online',
          active: totem.active,
          config: totemFull?.config || {}
        },
        pendingCommands: pendingCommands.map((cmd: any) => ({
          id: cmd.request_id,
          type: cmd.command_type,
          data: cmd.command_data,
          priority: cmd.priority,
          createdAt: cmd.created_at
        })),
        playlist: playlist ? {
          id: playlist.playlist_id,
          name: playlist.name,
          description: playlist.description,
          campaignId: playlist.campaign_id,
          campaignTitle: playlist.campaign_title,
          items: playlistItems.map((item: any) => ({
            id: item.item_id,
            order: item.order_index,
            duration: item.duration,
            media: {
              id: item.media_id,
              name: item.media_name,
              path: item.file_path,
              type: item.media_type,
              mimeType: item.mime_type,
              durationSeconds: item.duration_seconds,
              fileSize: item.file_size
            }
          }))
        } : null,
        otaUpdate: otaUpdate ? {
          id: otaUpdate.id,
          version: otaUpdate.version,
          platform: otaUpdate.platform,
          fileSize: otaUpdate.fileSize,
          checksum: otaUpdate.checksum,
          description: otaUpdate.description,
          changelog: otaUpdate.changelog,
          isMandatory: otaUpdate.isMandatory,
          downloadUrl: `/api/player/ota-download/${otaUpdate.id}`
        } : null,
        token: newToken,
        expiresIn: 3600, // 1 hora
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      const errorStack = error?.stack || '';
      
      await logError(`[${transactionId}] Erro ao validar totem`, error, { 
        uin: req.query.uin as string, 
        transactionId,
        errorMessage,
        errorStack: errorStack.substring(0, 500) // Limitar tamanho do stack
      });
      
      // Logar erro no debug
      dispatcherDebugService.logMessage('outgoing', {
        totemId: undefined,
        uin: (req.query.uin as string) || 'unknown',
        endpoint: '/api/player/validate',
        method: 'GET',
        response: {
          success: false,
          error: 'Erro interno do servidor'
        },
        error: errorMessage,
      });
      
      await playerDebugService.logTransaction({
        transactionId,
        uin: req.query.uin as string,
        action: 'validate',
        status: 'error',
        requestUrl: req.url,
        requestMethod: req.method,
        requestHeaders: req.headers,
        responseStatus: 500,
        errorMessage: errorMessage,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        duration: Date.now() - startTime,
        metadata: {
          errorStack: errorStack.substring(0, 1000) // Limitar tamanho
        }
      });
      
      // Em desenvolvimento, retornar mais detalhes do erro
      const isDevelopment = process.env.NODE_ENV !== 'production';
      return res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: isDevelopment ? errorMessage : 'Erro ao processar requisição',
        requestId: transactionId
      });
    }
  }
);

/**
 * @route GET /api/player/token
 * @desc Gerar token de validação para totem
 * @access Public
 * @note Todas as requisições passam pelo DispatcherRouter para monitoramento centralizado
 */
router.get('/token',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('deviceId').optional().isString().isLength({ min: 1, max: 255 }),
  query('platform').optional().isString().isLength({ min: 1, max: 100 }),
  query('appVersion').optional().isString().isLength({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    // Validação de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'UIN inválido', details: errors.array() });
    }
    
    // Delegar para DispatcherRouter (ponto central de roteamento)
    return await dispatcherRouter.route(req, res, '/api/player/token');
  }
);

/**
 * @route POST /api/player/heartbeat
 * @desc Registrar heartbeat do totem e marcar comandos como executados
 * @access Public (com token)
 * @note Todas as requisições passam pelo DispatcherRouter para monitoramento centralizado
 */
router.post('/heartbeat',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').isString(),
  query('deviceId').optional().isString().isLength({ min: 1, max: 255 }),
  async (req: Request, res: Response) => {
    // Validação de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
    }
    
    // Se for solicitação de aprovação, processar de forma especial (não passa pelo router ainda)
    const { uin, token, requestApproval, hardware } = req.body || {};
    if (requestApproval === true && token === 'REQUEST_APPROVAL') {
      return await handleApprovalRequest(req, res, uin as string, hardware);
    }
    
    // Delegar para DispatcherRouter (ponto central de roteamento)
    return await dispatcherRouter.route(req, res, '/api/player/heartbeat');
  }
);

/**
 * @route GET /api/player/dispatch
 * @desc Obter plano de exibição do Dispatcher-Totem para um totem (player)
 * @access Public (com token)
 * @note Todas as requisições passam pelo DispatcherRouter para monitoramento centralizado
 */
router.get(
  '/dispatch',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').isString(),
  query('timestamp').optional().isString(),
  query('timezone').optional().isString(),
  query('deviceId').optional().isString().isLength({ min: 1, max: 255 }),
  async (req: Request, res: Response) => {
    // Validação de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
    }
    
    // Delegar para DispatcherRouter (ponto central de roteamento)
    return await dispatcherRouter.route(req, res, '/api/player/dispatch');
  }
);

/**
 * @route POST /api/player/decrypt-config
 * @desc Desencriptar e validar configuração do player vinculada ao hardware
 * @access Public (para totens)
 */
router.post('/decrypt-config',
  body('encryptedConfig').isObject(),
  body('encryptedConfig.encrypted').isBoolean(),
  body('encryptedConfig.data').isString(),
  body('encryptedConfig.mac').isString(),
  body('currentMac').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
      }

      const { encryptedConfig, currentMac } = req.body;

      if (!encryptedConfig.encrypted || !encryptedConfig.data) {
        return res.status(400).json({ error: 'Configuração encriptada inválida' });
      }

      // Obter MAC address atual do servidor
      let serverMacAddress = currentMac;
      if (!serverMacAddress) {
        try {
          // Tentar obter MAC address da primeira interface de rede ativa
          const { stdout } = await execAsync('ip link show | grep -A1 "state UP" | grep -oE "([0-9a-f]{2}:){5}[0-9a-f]{2}" | head -1');
          serverMacAddress = stdout.trim();
        } catch {
          // Fallback: usar MAC de eth0
          try {
            const { stdout } = await execAsync('cat /sys/class/net/eth0/address 2>/dev/null || echo ""');
            serverMacAddress = stdout.trim();
          } catch {
            serverMacAddress = null;
          }
        }
      }

      // Validar MAC address (se fornecido)
      if (serverMacAddress && encryptedConfig.mac) {
        const normalizedConfigMac = encryptedConfig.mac.toLowerCase().replace(/[^0-9a-f:]/g, '');
        const normalizedServerMac = serverMacAddress.toLowerCase().replace(/[^0-9a-f:]/g, '');
        
        if (normalizedConfigMac !== normalizedServerMac) {
          await logDebug(`MAC address não corresponde`, { configMac: encryptedConfig.mac, serverMac: serverMacAddress });
          // Por enquanto, apenas avisar mas não bloquear (pode ser servidor diferente)
          // Em produção, você pode querer bloquear aqui
        }
      }

      // Desencriptar via crypto Node (sem shell/openssl)
      try {
        const decrypted = decryptOpenSslSaltedBase64(encryptedConfig.data, getTotemSecretKey());
        const [uin, configMac, timestamp] = decrypted.split(':');
        
        if (!uin || uin.length < 3) {
          return res.status(400).json({ 
            valid: false,
            error: 'UIN desencriptado inválido' 
          });
        }

        // Validar MAC address do payload
        if (configMac && serverMacAddress) {
          const normalizedConfigMac = configMac.toLowerCase().replace(/[^0-9a-f:]/g, '');
          const normalizedServerMac = serverMacAddress.toLowerCase().replace(/[^0-9a-f:]/g, '');
          
          if (normalizedConfigMac !== normalizedServerMac) {
            return res.status(403).json({ 
              valid: false,
              error: 'Configuração vinculada a outro hardware (MAC address não corresponde)' 
            });
          }
        }

        // Verificar se totem existe e está ativo
        const totemService = new TotemService();
        const totem = await totemService.getTotemByUin(uin);
        
        if (!totem || !totem.active) {
          return res.status(404).json({ 
            valid: false,
            error: 'Totem não encontrado ou inativo' 
          });
        }

        return res.json({
          valid: true,
          uin: uin,
          mac: configMac || encryptedConfig.mac,
          timestamp: timestamp ? parseInt(timestamp) : null
        });
      } catch (decryptError: any) {
        await logError('Erro ao desencriptar configuração', decryptError);
        return res.status(400).json({ 
          valid: false,
          error: 'Falha ao desencriptar configuração. Verifique a chave secreta.' 
        });
      }
    } catch (error: any) {
      await logError('Erro ao processar configuração do player', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/player/hardware-info
 * @desc Obter informações de hardware do servidor (MAC address)
 * @access Public (para totens)
 */
router.get('/hardware-info', async (_req: Request, res: Response) => {
  try {
    let macAddress: string | null = null;
    
    try {
      // Tentar obter MAC address da primeira interface de rede ativa
      const { stdout } = await execAsync('ip link show | grep -A1 "state UP" | grep -oE "([0-9a-f]{2}:){5}[0-9a-f]{2}" | head -1', { timeout: 3000 });
      macAddress = stdout.trim();
    } catch {
      // Fallback: usar MAC de eth0
      try {
        const { stdout } = await execAsync('cat /sys/class/net/eth0/address 2>/dev/null || echo ""', { timeout: 2000 });
        macAddress = stdout.trim() || null;
      } catch {
        macAddress = null;
      }
    }

    return res.json({
      macAddress: macAddress,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch()
    });
  } catch (error: any) {
    await logError('Erro ao obter informações de hardware', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @route POST /api/player/register
 * @desc Vincular hardware a totem pré-cadastrado (primeira conexão)
 * @access Public (para players na primeira instalação)
 */
router.post('/register',
  body('uin').isString().isLength({ min: 3, max: 100 }).withMessage('UIN deve ser uma string entre 3 e 100 caracteres'),
  body('hardware').optional({ nullable: true }).isObject().withMessage('hardware deve ser um objeto (opcional)'),
  body('hardware.macAddress').optional({ nullable: true }).isString(),
  body('hardware.hostname').optional({ nullable: true }).isString(),
  body('hardware.platform').optional({ nullable: true }).isString(),
  body('hardware.arch').optional({ nullable: true }).isString(),
  body('hardware.deviceId').optional({ nullable: true }).isString(),
  body('hardware.hardwareHash').optional({ nullable: true }).isString(),
  body('hardware.userAgent').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    // Logar mensagem recebida no debug
    dispatcherDebugService.logMessage('incoming', {
      totemId: undefined,
      uin: req.body?.uin || 'unknown',
      endpoint: '/api/player/register',
      method: 'POST',
      request: {
        uin: req.body?.uin,
        hardware: req.body?.hardware ? {
          macAddress: req.body.hardware.macAddress ? 'PRESENTE' : 'AUSENTE',
          hostname: req.body.hardware.hostname || null,
          platform: req.body.hardware.platform || null,
          hardwareHash: req.body.hardware.hardwareHash ? 'PRESENTE' : 'AUSENTE'
        } : null
      },
    });
    const requestId = `REG-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // Sanitizar dados antes de logar
      const sanitizedBody = sanitizeForLogging(req.body);
      await logDebug(`[${requestId}] Iniciando vinculação de hardware a totem pré-cadastrado`, { requestId, uin: sanitizedBody.uin });
      await logDebug(`[${requestId}] Dados recebidos`, {
        uin: sanitizedBody.uin,
        hardware: {
          ...sanitizedBody.hardware,
          hardwareHash: sanitizedBody.hardware?.hardwareHash ? 'HASH_PRESENTE' : 'AUSENTE'
        },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Registrar transação de início
      await playerDebugService.logTransaction({
        transactionId: requestId,
        uin: req.body.uin,
        action: 'hardware_link',
        status: 'pending',
        requestUrl: req.url,
        requestMethod: req.method,
        requestHeaders: req.headers,
        requestBody: {
          uin: req.body.uin,
          hardware: {
            ...req.body.hardware,
            hardwareHash: req.body.hardware?.hardwareHash ? 'HASH_PRESENTE' : 'AUSENTE'
          }
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorDetails = errors.array();
        await logError(`[${requestId}] Erros de validação`, new Error('Validação falhou'), { 
          errors: errorDetails, 
          requestId,
          body: {
            uin: req.body?.uin,
            hasHardware: !!req.body?.hardware,
            hardwareKeys: req.body?.hardware ? Object.keys(req.body.hardware) : []
          }
        });
        
        // Logar erro no debug
        dispatcherDebugService.logMessage('outgoing', {
          totemId: undefined,
          uin: req.body?.uin || 'unknown',
          endpoint: '/api/player/register',
          method: 'POST',
          response: {
            success: false,
            error: 'Parâmetros inválidos'
          },
          error: `Validação falhou: ${JSON.stringify(errorDetails)}`,
        });
        
        return res.status(400).json({ 
          error: 'Parâmetros inválidos', 
          details: errorDetails.map((e: any) => ({
            field: e.path || e.param,
            message: e.msg,
            value: e.value
          })),
          received: {
            uin: req.body?.uin,
            uinType: typeof req.body?.uin,
            hasHardware: !!req.body?.hardware,
            hardwareType: typeof req.body?.hardware,
            hardwareKeys: req.body?.hardware ? Object.keys(req.body.hardware) : [],
            bodyKeys: Object.keys(req.body || {})
          },
          requestId: requestId
        });
      }

      const { uin, hardware } = req.body;
      await logDebug(`[${requestId}] Validação passou`, { uin, hasHardware: !!hardware, requestId });
      
      const db = getDatabase();
      const totemService = new TotemService();
      
      await logDebug(`[${requestId}] Verificando se UIN foi pré-cadastrado`, { uin, requestId });

      // VALIDAÇÃO CRÍTICA: UIN deve existir (pré-cadastrado pelo publisher)
      const existingTotem = await totemService.getTotemByUin(uin);
      if (!existingTotem) {
        await logDebug(`[${requestId}] UIN não encontrado - totem deve ser pré-cadastrado`, { uin, requestId });
        return res.status(404).json({ 
          error: 'UIN não cadastrado',
          uin: uin,
          message: 'Este UIN não está cadastrado no sistema. O totem deve ser cadastrado pelo publisher antes de se conectar.',
          suggestion: 'Entre em contato com o administrador para cadastrar este totem.',
          requestId: requestId
        });
      }
      await logDebug(`[${requestId}] UIN encontrado - totem pré-cadastrado`, { 
        totemId: (existingTotem as any).id || (existingTotem as any).totem_id,
        identifier: (existingTotem as any).identifier,
        currentStatus: (existingTotem as any).status,
        requestId 
      });

      // Verificar se hardware já está vinculado a OUTRO totem (prevenção de clonagem)
      // hardware pode ser undefined, então precisamos verificar antes de acessar propriedades
      const hardwareHash = hardware?.hardwareHash || (hardware?.macAddress || '').toLowerCase();
      const currentTotemId = (existingTotem as any).id || (existingTotem as any).totem_id;
      
      await logDebug(`[${requestId}] Verificando se hardware está vinculado a outro totem`, { 
        hardwareHash: hardwareHash ? 'PRESENTE' : 'AUSENTE',
        currentTotemId,
        requestId 
      });
      
      if ((hardwareHash && hardwareHash !== 'unknown' && hardware?.macAddress) || hardware?.deviceId) {
        try {
          // Buscar totem que já tem este hardware vinculado (exceto o atual)
          const existingHardware = await db.findFirst(`
            SELECT totem_id, uin, identifier
            FROM totems
            WHERE (network_info->'hardware'->>'mac' = ?
               OR network_info->'hardware'->>'hardwareHash' = ?
               OR (? <> '' AND device_id = ?))
              AND totem_id != ?
            LIMIT 1
          `, [hardware?.macAddress || '', hardwareHash, hardware?.deviceId || '', hardware?.deviceId || '', currentTotemId]);
          
          if (existingHardware) {
            await logDebug(`[${requestId}] Hardware já vinculado a outro totem`, { existingHardware, requestId });
            return res.status(409).json({ 
              error: 'Hardware já vinculado',
              message: 'Este hardware já está vinculado a outro totem',
              existingTotem: {
                id: existingHardware.totem_id,
                uin: existingHardware.uin,
                identifier: existingHardware.identifier
              },
              requestId: requestId
            });
          }
          await logDebug(`[${requestId}] Hardware não está vinculado a outro totem`, { requestId });
        } catch (hardwareCheckError: any) {
          await logError(`[${requestId}] Erro ao verificar hardware duplicado`, hardwareCheckError, { requestId });
          // Continuar mesmo se houver erro na verificação de hardware
        }
      } else {
        await logDebug(`[${requestId}] Hardware hash/MAC ausente, pulando verificação de duplicação`, { requestId });
      }

      // Obter dados do totem pré-cadastrado
      const totemId = currentTotemId;
      const existingConfig = (existingTotem as any).config || {};
      const existingIdentifier = (existingTotem as any).identifier || hardware?.hostname || `TOTEM-${totemId}`;
      const existingStatus = (existingTotem as any).status || 'pending_activation';
      const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
      
      await logDebug(`[${requestId}] Preparando para vincular hardware ao totem pré-cadastrado`, {
        totemId,
        existingIdentifier,
        existingStatus,
        requestId
      });

      // Preparar configuração: preservar dados do publisher e adicionar hardware info
      const networkInfo = {
        ...existingConfig,  // Preservar dados do publisher (resolution, orientation, etc.)
        hardware: {
          ...(existingConfig.hardware || {}),  // Preservar hardware info existente se houver
          mac: hardware?.macAddress || existingConfig.hardware?.mac || null,
          hostname: hardware?.hostname || existingConfig.hardware?.hostname || null,
          platform: hardware?.platform || existingConfig.hardware?.platform || null,
          arch: hardware?.arch || existingConfig.hardware?.arch || null,
          serial: hardware?.serial || existingConfig.hardware?.serial || null,
          hardwareHash: hardware?.hardwareHash || existingConfig.hardware?.hardwareHash || null,
          registeredAt: existingConfig.hardware?.registeredAt || new Date().toISOString(),
          linkedAt: new Date().toISOString(),  // Quando hardware foi vinculado
          userAgent: hardware?.userAgent || existingConfig.hardware?.userAgent || null
        }
      };

      // Determinar novo status: se estava pending_activation, muda para pending_approval
      const newStatus = existingStatus === 'pending_activation' ? 'pending_approval' : existingStatus;
      
      await logDebug(`[${requestId}] Atualizando totem pré-cadastrado com hardware info`, {
        totemId,
        identifier: existingIdentifier,
        status: `${existingStatus} → ${newStatus}`,
        requestId
      });
      
      try {
        // ATUALIZAR totem existente (não criar novo)
        await db.executeRaw(`
          UPDATE totems SET
            network_info = ?::jsonb,
            device_id = COALESCE(NULLIF(?, ''), device_id),
            last_heartbeat = CURRENT_TIMESTAMP,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE uin = ?
        `, [
          JSON.stringify({
            ...networkInfo,
            ip: ipAddress,
          }),
          hardware?.deviceId || null,
          newStatus,
          uin
        ]);
        await logDebug(`[${requestId}] Totem atualizado com hardware vinculado`, { totemId, uin, requestId });
      } catch (updateError: any) {
        await logError(`[${requestId}] Erro ao atualizar totem`, updateError, { totemId, uin, requestId });
        throw updateError;
      }

      // Buscar totem atualizado
      await logDebug(`[${requestId}] Buscando totem atualizado`, { totemId, uin, requestId });
      const updatedTotem = await totemService.getTotemByUin(uin);
      if (!updatedTotem) {
        await logError(`[${requestId}] Totem não encontrado após atualização`, new Error('Totem não encontrado'), { totemId, uin, requestId });
        return res.status(500).json({ 
          error: 'Erro ao vincular hardware',
          message: 'Totem atualizado mas não encontrado após atualização',
          requestId: requestId
        });
      }
      await logDebug(`[${requestId}] Totem encontrado após atualização`, {
        id: (updatedTotem as any).id || totemId,
        uin: updatedTotem.uin,
        identifier: (updatedTotem as any).identifier,
        status: (updatedTotem as any).status
      });

      // Gerar token de validação
      const token = generateTotemToken(uin);
      const duration = Date.now() - startTime;
      const finalStatus = (updatedTotem as any).status || newStatus;
      
      await logDebug(`[${requestId}] Hardware vinculado ao totem pré-cadastrado com sucesso`, { 
        duration, 
        totemId,
        status: finalStatus,
        requestId 
      });
      
      const responseData = {
        success: true,
        message: 'Hardware vinculado ao totem pré-cadastrado com sucesso.',
        status: finalStatus,
        uin: uin,
        token: token,
        totem: {
          id: (updatedTotem as any).id || totemId,
          uin: uin,
          identifier: (updatedTotem as any).identifier || existingIdentifier,
          status: finalStatus,
          active: (updatedTotem as any).active !== false,
          message: finalStatus === 'pending_approval' 
            ? 'Aguardando aprovação do administrador para ativação'
            : finalStatus === 'online'
            ? 'Totem ativo e pronto para uso'
            : 'Hardware vinculado com sucesso'
        },
        nextSteps: finalStatus === 'pending_approval' ? [
          'Aguarde aprovação do administrador',
          'O totem ficará inativo até ser aprovado',
          'Após aprovação, o totem será ativado automaticamente'
        ] : finalStatus === 'online' ? [
          'Totem está ativo e pronto para uso',
          'Playlists serão enviadas automaticamente'
        ] : [
          'Hardware vinculado com sucesso',
          'Aguarde configuração adicional se necessário'
        ],
        requestId: requestId,
        duration: `${duration}ms`
      };
      
      // Registrar evento no EventLogService (não bloqueia o fluxo)
      try {
        const eventLogService = getEventLogService();
        await eventLogService.logEvent({
          eventType: EventType.SYSTEM_EVENT,
          entityType: 'totem',
          entityId: (updatedTotem as any).id || totemId,
          totemId: (updatedTotem as any).id || totemId,
          metadata: {
            action: 'hardware_linked',  // Mudado de 'auto_register' para 'hardware_linked'
            previousStatus: existingStatus,
            newStatus: finalStatus,
            ipAddress,
            requestId,
            hardware: {
              mac: req.body.hardware?.macAddress,
              hostname: req.body.hardware?.hostname,
              platform: req.body.hardware?.platform,
              arch: req.body.hardware?.arch
            }
          }
        });
      } catch (eventError: any) {
        await logError(`[${requestId}] Erro ao registrar evento de vinculação de hardware`, eventError, {
          totemId,
          requestId
        });
      }

      // Registrar transação de sucesso
      await playerDebugService.logTransaction({
        transactionId: requestId,
        uin: uin,
        action: 'hardware_linked',  // Mudado de 'auto_register' para 'hardware_linked'
        status: 'success',
        requestUrl: req.url,
        requestMethod: req.method,
        requestHeaders: req.headers,
        requestBody: {
          uin: req.body.uin,
          hardware: {
            ...req.body.hardware,
            hardwareHash: req.body.hardware?.hardwareHash ? 'HASH_PRESENTE' : 'AUSENTE'
          }
        },
        responseStatus: 200,  // Mudado de 201 (Created) para 200 (OK) - é UPDATE, não INSERT
        responseBody: responseData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        duration: duration,
        metadata: { totemId: (updatedTotem as any).id || totemId }
      });
      
      return res.status(200).json(responseData);  // Mudado de 201 para 200
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await logError(`[${requestId}] Erro ao vincular hardware ao totem`, error, { duration, requestId });
      
      // Registrar transação de erro
      await playerDebugService.logTransaction({
        transactionId: requestId,
        uin: req.body.uin,
        action: 'hardware_link',
        status: 'error',
        requestUrl: req.url,
        requestMethod: req.method,
        requestHeaders: req.headers,
        requestBody: {
          uin: req.body.uin,
          hardware: {
            ...req.body.hardware,
            hardwareHash: req.body.hardware?.hardwareHash ? 'HASH_PRESENTE' : 'AUSENTE'
          }
        },
        responseStatus: 500,
        errorMessage: error.message,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        duration: duration
      });
      
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message,
        requestId: requestId,
        duration: `${duration}ms`,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route POST /api/player/event
 * @desc Registrar evento importante do player (playback, exibição, etc)
 * @access Public (para totens com token válido)
 */
router.post('/event',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').optional().isString(),
  body('eventType').isString().isIn([
    'video_playback_start',
    'video_playback_end',
    'video_playback_error',
    'image_display',
    'audio_playback',
    'ad_display_start',
    'ad_display_end',
    'playlist_start',
    'playlist_end',
    'playlist_item_play'
  ]),
  body('mediaId').optional({ nullable: true }).custom((val) => {
    if (val === undefined || val === null) return true;
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0) return true;
    if (typeof val === 'string' && (/^fb-/.test(val) || /^\d+$/.test(val))) return true;
    return false;
  }).withMessage('mediaId deve ser inteiro ou id de fallback (fb-*)'),
  body('playlistId').optional({ nullable: true }).isInt({ min: 0 }),
  body('campaignId').optional({ nullable: true }).isInt({ min: 0 }),
  body('duration').optional({ nullable: true }).isInt({ min: 0 }),
  body('completed').optional({ nullable: true }).isBoolean(),
  body('metadata').optional({ nullable: true }).isObject(),
  async (req: Request, res: Response) => {
    // Validação de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Dados inválidos', details: errors.array() });
    }
    
    // Delegar para DispatcherRouter (ponto central de roteamento)
    return await dispatcherRouter.route(req, res, '/api/player/event');
  }
);

/**
 * @route POST /api/player/exit-kiosk
 * @desc Sair do modo kiosk e retornar ao ambiente gráfico
 * @access Public (para totens com PIN correto)
 */
router.post('/exit-kiosk',
  body('uin').optional({ nullable: true }).isString(),
  body('token').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const { uin, token } = req.body;

      // Validar token se fornecido
      if (uin && token && typeof token === 'string') {
        if (!validateTotemToken(uin, token)) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      // Executar comando para sair do modo kiosk
      // Tentar várias abordagens para garantir que funcione
      const commands = [
        // Fechar navegador Chromium
        'pkill -f chromium',
        // Fechar navegador Firefox
        'pkill -f firefox',
        // Fechar navegador Chrome
        'pkill -f chrome',
        // Fazer logout do usuário atual (se estiver em sessão gráfica)
        'bash -c "SESSION_ID=$(loginctl list-sessions --no-legend 2>/dev/null | grep "$(whoami)" | head -1 | awk \'{print $1}\'); if [ -n \"$SESSION_ID\" ]; then loginctl terminate-session \"$SESSION_ID\" 2>/dev/null; fi"',
        // Fechar sessão X (se aplicável)
        'pkill -9 X 2>/dev/null || true'
      ];

      let executed = false;
      for (const cmd of commands) {
        try {
          await execAsync(cmd, { timeout: 3000 });
          executed = true;
          await logDebug(`Comando executado para sair do kiosk`, { cmd });
          // Não parar aqui, tentar executar todos os comandos possíveis
        } catch (error: any) {
          // Continuar tentando outros comandos mesmo se este falhar
          continue;
        }
      }

      if (executed) {
        return res.json({
          success: true,
          message: 'Comando de saída do kiosk executado com sucesso'
        });
      } else {
        // Se nenhum comando funcionou, retornar instruções
        return res.json({
          success: false,
          message: 'Não foi possível executar comando de saída automaticamente',
          instructions: 'Você pode fechar o navegador manualmente ou fazer logout do usuário'
        });
      }
    } catch (error: any) {
      await logError('Erro ao executar saída do kiosk', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/player/ota-download/:id
 * @desc Download APK OTA para Player-AD (uin + token na query)
 */
router.get('/ota-download/:id',
  query('uin').isString().notEmpty(),
  query('token').isString().notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const uin = String(req.query.uin);
      const token = String(req.query.token);
      if (!validateTotemToken(uin, token)) {
        const deviceTokenService = (await import('../services/deviceTokenService')).getDeviceTokenService();
        const validDevice = await deviceTokenService.validateToken(uin, token, {});
        if (!validDevice) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      const updateId = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(updateId) || updateId < 1) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const db = getDatabase();
      const update = await db.findFirst(`
        SELECT file_path, version, platform, checksum
        FROM ota_updates
        WHERE id = $1 AND status = 'active' AND platform IN ('android', 'all')
      `, [updateId]);

      if (!update || !fs.existsSync(update.file_path)) {
        return res.status(404).json({ error: 'Atualização não encontrada' });
      }

      const fileName = `update_${update.version}_android${path.extname(update.file_path)}`;
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Update-Checksum', update.checksum);
      fs.createReadStream(update.file_path).pipe(res);
      return;
    } catch (err: any) {
      await logError('Erro no download OTA do player', err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
);

/**
 * @route POST /api/player/ota-status
 * @desc Player-AD reporta progresso de atualização OTA Android
 * @access Public (totem autenticado)
 */
router.post('/ota-status',
  body('uin').isString().notEmpty(),
  body('token').isString().notEmpty(),
  body('currentVersion').isString().notEmpty(),
  body('updateStatus').isIn(['up_to_date', 'update_available', 'downloading', 'installing', 'failed', 'rollback']),
  body('availableVersion').optional({ nullable: true }).isString(),
  body('error').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { uin, token, currentVersion, updateStatus, availableVersion, error } = req.body;
      if (!validateTotemToken(uin, token)) {
        const deviceTokenService = (await import('../services/deviceTokenService')).getDeviceTokenService();
        const validDevice = await deviceTokenService.validateToken(uin, token, {});
        if (!validDevice) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      const db = getDatabase();
      const totem = await db.findFirst(`SELECT totem_id FROM totems WHERE uin = $1`, [uin]);
      if (!totem?.totem_id) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      const { getOTAUpdateService } = await import('../services/otaUpdateService');
      await getOTAUpdateService().updateTotemStatus(totem.totem_id, {
        totemId: totem.totem_id,
        currentVersion,
        availableVersion: availableVersion || undefined,
        updateStatus,
        lastCheck: new Date(),
        lastUpdate: ['installing', 'up_to_date'].includes(updateStatus) ? new Date() : undefined,
        error: error || undefined,
      });

      return res.json({ success: true });
    } catch (err: any) {
      await logError('Erro ao registrar status OTA do player', err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
);

/**
 * @route POST /api/player/command-result
 * @desc Reporta resultado de execução de comando remoto
 * @access Public (para totens autenticados)
 */
router.post('/command-result',
  body('uin').isString().notEmpty().withMessage('UIN é obrigatório'),
  body('token').isString().notEmpty().withMessage('Token é obrigatório'),
  body('requestId').isString().notEmpty().withMessage('requestId é obrigatório'),
  body('status').isIn(['completed', 'failed']).withMessage('status deve ser completed ou failed'),
  body('result').optional({ nullable: true }),
  body('error').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { uin, token, requestId, status, result, error } = req.body;

      // Validar token
      if (!validateTotemToken(uin, token)) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
      }

      // Buscar totem
      const db = getDatabase();
      const totem = await db.findFirst(`
        SELECT totem_id, identifier
        FROM totems
        WHERE uin = $1
      `, [uin]);

      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      // Buscar comando pelo ID (schema: command_id como PK; cliente envia o id retornado no heartbeat)
      const command = await db.findFirst(`
        SELECT command_id as id, totem_id, command_type, status
        FROM remote_commands
        WHERE command_id = $1 AND totem_id = $2
      `, [requestId, totem.totem_id]);

      if (!command) {
        return res.status(404).json({ error: 'Comando não encontrado' });
      }

      // Atualizar status do comando
      const remoteCommandService = getRemoteCommandService();
      
      if (status === 'completed') {
        await remoteCommandService.markCommandAsCompleted(command.id, result);
        
        // Screenshot: preferir imageBase64 (ficheiro no servidor); legacy filePath Android é ignorado para disco
        if (command.command_type === 'screenshot' || command.command_type === 'capture_screen') {
          const { decodeScreenshotPayload, saveRemoteScreenshotFile } = await import(
            '../services/remoteScreenshotStorage'
          );
          const decoded = decodeScreenshotPayload(result);
          if (decoded) {
            const saved = await saveRemoteScreenshotFile({
              totemId: totem.totem_id,
              commandId: command.id,
              buffer: decoded.buffer,
              format: decoded.format,
            });
            await remoteCommandService.saveScreenshot(
              totem.totem_id,
              saved.filePath,
              saved.fileSize,
              decoded.width,
              decoded.height,
              saved.format,
              command.id
            );
          } else if (result?.filePath && !String(result.filePath).includes('/Android/') && !String(result.filePath).startsWith('/data/')) {
            // Só aceitar path se já for path de servidor (não path do device)
            await remoteCommandService.saveScreenshot(
              totem.totem_id,
              result.filePath,
              result.fileSize || 0,
              result.width || 0,
              result.height || 0,
              result.format || 'png',
              command.id
            );
          } else {
            await logWarn('Screenshot completado sem imageBase64 — ficheiro não gravado no servidor', {
              commandId: command.id,
              totemId: totem.totem_id,
              hasFilePath: !!result?.filePath,
            });
          }
        }
      } else {
        await remoteCommandService.markCommandAsFailed(command.id, error || 'Comando falhou');
      }

      // Registrar evento
      const eventLogService = getEventLogService();
      await eventLogService.logEvent({
        eventType: status === 'completed' ? EventType.TOTEM_COMMAND_COMPLETED : EventType.TOTEM_COMMAND_FAILED,
        entityType: 'totem',
        entityId: totem.totem_id,
        totemId: totem.totem_id,
        metadata: {
          commandType: command.command_type,
          requestId,
          result,
          error
        }
      }).catch(e => logWarn('Erro ao registrar evento de comando', { error: e.message }));

      await logInfo('Resultado de comando reportado', {
        requestId,
        totemId: totem.totem_id,
        status
      });

      return res.json({
        success: true,
        message: 'Resultado do comando registrado com sucesso'
      });

    } catch (error: any) {
      await logError('Erro ao processar resultado de comando', error);
      return res.status(500).json({
        error: 'Erro ao processar resultado do comando',
        details: error.message
      });
    }
  }
);

export default router;

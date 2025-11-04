import express, { Request, Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { TotemService } from '../services/totemService';
import { getDatabase } from '../config/database';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const router = express.Router();

// Chave secreta para validação de totem (deve estar no .env em produção)
const TOTEM_SECRET_KEY = process.env.TOTEM_SECRET_KEY || 'smart-signage-totem-secret-key-2025-change-in-production';

/**
 * Gerar token de validação para totem
 */
function generateTotemToken(uin: string): string {
  const timestamp = Date.now();
  const data = `${uin}:${timestamp}`;
  const token = crypto
    .createHmac('sha256', TOTEM_SECRET_KEY)
    .update(data)
    .digest('hex');
  return `${timestamp}:${token}`;
}

/**
 * Validar token de totem
 */
function validateTotemToken(uin: string, token: string, maxAge: number = 3600000): boolean {
  try {
    const [timestamp, receivedToken] = token.split(':');
    if (!timestamp || !receivedToken) return false;

    const age = Date.now() - parseInt(timestamp);
    if (age > maxAge || age < 0) return false; // Token expirado ou inválido

    const expectedToken = crypto
      .createHmac('sha256', TOTEM_SECRET_KEY)
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
 * @route GET /api/player/validate
 * @desc Validar totem por UIN e token, retornar status, comandos pendentes e playlist
 * @access Public (para totens na porta 80)
 */
router.get('/validate',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
      }

      const { uin, token } = req.query;
      const db = getDatabase();

      // Validar token se fornecido
      if (token && typeof token === 'string') {
        if (!validateTotemToken(uin as string, token)) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
      }

      // Buscar totem por UIN
      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(uin as string);

      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      // Verificar se totem está ativo
      if (!totem.active) {
        return res.status(403).json({ 
          error: 'Totem inativo',
          blocked: true,
          reason: 'Totem desativado no sistema'
        });
      }

      // Verificar bloqueios adicionais (campo status pode indicar bloqueio)
      const totemFull = await db.findFirst(`
        SELECT 
          t.totem_id,
          t.identifier,
          t.status,
          t.active,
          t.config,
          t.blocked,
          t.blocked_until
        FROM totems t
        WHERE t.identifier = ? OR t.uin = ?
        LIMIT 1
      `, [uin, uin]);

      // Determinar o ID numérico do totem para consultas relacionadas
      const totemId = (totemFull && (totemFull as any).totem_id) || (totem as any).id;

      if (totemFull && totemFull.blocked) {
        // Verificar se bloqueio expirou
        if (totemFull.blocked_until && new Date(totemFull.blocked_until) > new Date()) {
          return res.status(403).json({ 
            error: 'Totem bloqueado temporariamente',
            blocked: true,
            reason: 'Totem bloqueado até ' + new Date(totemFull.blocked_until).toISOString(),
            blockedUntil: totemFull.blocked_until
          });
        } else if (totemFull.blocked_until && new Date(totemFull.blocked_until) <= new Date()) {
          // Desbloquear automaticamente se expirou
          await db.executeRaw(`
            UPDATE totems 
            SET blocked = false, blocked_until = NULL 
            WHERE totem_id = ?
          `, [totemFull.totem_id]);
        }
      }

      // Buscar comandos remotos pendentes
      const pendingCommands = await db.findMany(`
        SELECT 
          rc.request_id,
          rc.command_type,
          rc.command_data,
          rc.priority,
          rc.created_at,
          rc.status
        FROM remote_commands rc
        WHERE rc.totem_id = ? 
          AND rc.status = 'pending'
        ORDER BY rc.priority DESC, rc.created_at ASC
        LIMIT 10
      `, [totemFull?.totem_id || (totem as any).id]);

      // Buscar playlist ativa do totem através de campanha
      const activePlaylist = await db.findFirst(`
        SELECT 
          p.playlist_id,
          p.name,
          p.description,
          p.config,
          ct.campaign_id,
          c.title as campaign_title,
          ct.scheduled_start as schedule_start,
          ct.scheduled_end as schedule_end
        FROM playlists p
        INNER JOIN campaign_playlists cp ON p.playlist_id = cp.playlist_id
        INNER JOIN campaign_totems ct ON cp.campaign_id = ct.campaign_id
        INNER JOIN campaigns c ON ct.campaign_id = c.campaign_id
        WHERE ct.totem_id = ?
          AND c.is_active = true
          AND c.status = 'active'
          AND p.is_active = true
          AND (ct.scheduled_start IS NULL OR ct.scheduled_start <= CURRENT_TIMESTAMP)
          AND (ct.scheduled_end IS NULL OR ct.scheduled_end >= CURRENT_TIMESTAMP)
        ORDER BY c.priority DESC, ct.scheduled_start DESC
        LIMIT 1
      `, [totemId]);

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
            pi.display_seconds as duration,
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

      // Gerar novo token para resposta
      const newToken = generateTotemToken(uin as string);

      // Atualizar último heartbeat (usando identifier ou uin para encontrar totem_id)
      if (totemId) {
        await db.executeRaw(`
          UPDATE totems 
          SET last_heartbeat = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP, status = 'online'
          WHERE totem_id = ?
        `, [totemId]);
      }

      res.json({
        valid: true,
        totem: {
          id: totemId,
          uin: uin,
          identifier: totemFull?.identifier || (totem as any).identifier,
          name: (totem as any).name || totemFull?.identifier || uin,
          location: (totem as any).location || totemFull?.description,
          clientId: (totem as any).clientId,
          clientName: (totem as any).clientName,
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
        token: newToken,
        expiresIn: 3600, // 1 hora
      });
    } catch (error: any) {
      console.error('❌ Erro ao validar totem:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/player/token
 * @desc Gerar token de validação para totem
 * @access Public
 */
router.get('/token',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'UIN inválido', details: errors.array() });
      }

      const { uin } = req.query;
      const token = generateTotemToken(uin as string);

      res.json({
        token,
        expiresIn: 3600, // 1 hora
      });
    } catch (error: any) {
      console.error('❌ Erro ao gerar token:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/player/heartbeat
 * @desc Registrar heartbeat do totem e marcar comandos como executados
 * @access Public (com token)
 */
router.post('/heartbeat',
  query('uin').isString().isLength({ min: 1, max: 100 }),
  query('token').isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Parâmetros inválidos', details: errors.array() });
      }

      const { uin, token } = req.query;
      const { executedCommands, metrics } = req.body;

      // Validar token
      if (!validateTotemToken(uin as string, token as string)) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
      }

      const totemService = new TotemService();
      const totem = await totemService.getTotemByUin(uin as string);

      if (!totem || !totem.active) {
        return res.status(404).json({ error: 'Totem não encontrado ou inativo' });
      }

      const db = getDatabase();
      const totemId = (totem as any).id;

      // Atualizar heartbeat
      await db.executeRaw(`
        UPDATE totems 
        SET last_heartbeat = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP
        WHERE totem_id = ?
      `, [totemId]);

            // Marcar comandos como executados
            if (executedCommands && Array.isArray(executedCommands) && executedCommands.length > 0) {
                for (const cmdId of executedCommands) {
                    await db.executeRaw(`
                        UPDATE remote_commands 
                        SET status = 'executed', executed_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND totem_id = ?
                    `, [cmdId, totemId]);
                }
            }

      // Retornar novo token e comandos pendentes
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

      const newToken = generateTotemToken(uin as string);

      res.json({
        success: true,
        token: newToken,
        pendingCommands: pendingCommands.map((cmd: any) => ({
          id: cmd.request_id,
          type: cmd.command_type,
          data: cmd.command_data,
          priority: cmd.priority
        }))
      });
    } catch (error: any) {
      console.error('❌ Erro ao processar heartbeat:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
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
  body('currentMac').optional().isString(),
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
          console.warn(`⚠️ MAC address não corresponde: config=${encryptedConfig.mac}, server=${serverMacAddress}`);
          // Por enquanto, apenas avisar mas não bloquear (pode ser servidor diferente)
          // Em produção, você pode querer bloquear aqui
        }
      }

      // Desencriptar usando OpenSSL (via child_process)
      try {
        const { stdout } = await execAsync(
          `echo -n "${encryptedConfig.data}" | openssl enc -aes-256-cbc -d -base64 -salt -pbkdf2 -iter 10000 -k "${TOTEM_SECRET_KEY}"`,
          { timeout: 5000 }
        );
        
        const decrypted = stdout.trim();
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
        console.error('❌ Erro ao desencriptar configuração:', decryptError.message);
        return res.status(400).json({ 
          valid: false,
          error: 'Falha ao desencriptar configuração. Verifique a chave secreta.' 
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar configuração do player:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/player/hardware-info
 * @desc Obter informações de hardware do servidor (MAC address)
 * @access Public (para totens)
 */
router.get('/hardware-info', async (req: Request, res: Response) => {
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

    res.json({
      macAddress: macAddress,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch()
    });
  } catch (error: any) {
    console.error('❌ Erro ao obter informações de hardware:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @route POST /api/player/exit-kiosk
 * @desc Sair do modo kiosk e retornar ao ambiente gráfico
 * @access Public (para totens com PIN correto)
 */
router.post('/exit-kiosk',
  body('uin').optional().isString(),
  body('token').optional().isString(),
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
          console.log(`✅ Comando executado para sair do kiosk: ${cmd}`);
          // Não parar aqui, tentar executar todos os comandos possíveis
        } catch (error: any) {
          // Continuar tentando outros comandos mesmo se este falhar
          continue;
        }
      }

      if (executed) {
        res.json({
          success: true,
          message: 'Comando de saída do kiosk executado com sucesso'
        });
      } else {
        // Se nenhum comando funcionou, retornar instruções
        res.json({
          success: false,
          message: 'Não foi possível executar comando de saída automaticamente',
          instructions: 'Você pode fechar o navegador manualmente ou fazer logout do usuário'
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao executar saída do kiosk:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;

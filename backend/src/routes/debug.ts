import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import fs from 'fs';
import path from 'path';
import { logError, logWarn } from '../utils/loggerHelper';

const router = Router();

/**
 * @route GET /api/debug/player-registration-logs
 * @desc Obter logs de registro de totens
 * @access Private (Admin) ou Public para debug
 */
router.get('/player-registration-logs', async (req: Request, res: Response) => {
  try {
    const { limit = 50, since } = req.query;
    
    // Buscar totens registrados recentemente
    const db = getDatabase();
    const query = since 
      ? `SELECT totem_id, identifier, uin, status, created_at, network_info 
         FROM totems 
         WHERE created_at >= ? 
         ORDER BY created_at DESC 
         LIMIT ?`
      : `SELECT totem_id, identifier, uin, status, created_at, network_info 
         FROM totems 
         ORDER BY created_at DESC 
         LIMIT ?`;
    
    const params = since ? [since, parseInt(limit as string)] : [parseInt(limit as string)];
    const totems = await db.findMany(query, params);
    
    // Buscar logs do sistema (se disponíveis)
    const logsDir = path.join(__dirname, '../../logs');
    let systemLogs: string[] = [];
    
    try {
      if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir)
          .filter(f => f.endsWith('.log'))
          .sort()
          .reverse()
          .slice(0, 5);
        
        for (const logFile of logFiles) {
          const logPath = path.join(logsDir, logFile);
          const logContent = fs.readFileSync(logPath, 'utf-8');
          const lines = logContent.split('\n')
            .filter(line => line.includes('REG-') || line.includes('register') || line.includes('auto-registro'))
            .slice(-100);
          systemLogs.push(...lines);
        }
      }
    } catch (logErr: any) {
      await logWarn('Erro ao ler logs do sistema', { route: '/api/debug/player-registration-logs', error: logErr });
    }
    
    return res.json({
      success: true,
      totems: totems.map((t: any) => ({
        id: t.totem_id,
        identifier: t.identifier,
        uin: t.uin,
        status: t.status,
        createdAt: t.created_at,
        // IP não existe como coluna. Vem do JSONB network_info (ex.: {"ip":"192.168.1.10"}).
        ipAddress: (() => {
          const ni = t.network_info ? (typeof t.network_info === 'string' ? JSON.parse(t.network_info) : t.network_info) : null;
          return ni?.ip || ni?.ip_address || ni?.ipAddress || null;
        })(),
        hardware: t.network_info ? (typeof t.network_info === 'string' ? JSON.parse(t.network_info) : t.network_info)?.hardware : null
      })),
      systemLogs: systemLogs.slice(-200),
      count: totems.length
    });
  } catch (error: any) {
    await logError('Erro ao obter logs de registro', error, { route: '/api/debug/player-registration-logs' });
    return res.status(500).json({ 
      error: 'Erro ao obter logs',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/debug/totem/:id
 * @desc Obter informações detalhadas de um totem
 * @access Private (Admin) ou Public para debug
 */
router.get('/totem/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const totem = await db.findFirst(`
      SELECT *
      FROM totems
      WHERE totem_id = ? OR uin = ?
      LIMIT 1
    `, [parseInt(id), id]);
    
    if (!totem) {
      return res.status(404).json({ error: 'Totem não encontrado' });
    }
    
    return res.json({
      success: true,
      totem: {
        ...totem,
        config: typeof totem.network_info === 'string' ? JSON.parse(totem.network_info) : totem.network_info
      }
    });
  } catch (error: any) {
    await logError('Erro ao obter totem', error, { route: '/api/debug/totem/:id', totemId: req.params.id });
    return res.status(500).json({ 
      error: 'Erro ao obter totem',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/debug/system-info
 * @desc Obter informações do sistema
 * @access Private (Admin) ou Public para debug
 */
router.get('/system-info', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Estatísticas de totens
    const totemStats = await db.findFirst(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as registered_last_24h
      FROM totems
    `);
    
    // Últimos registros
    const recentRegistrations = await db.findMany(`
      SELECT totem_id, identifier, uin, status, created_at, ip_address
      FROM totems
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    return res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV
      },
      totems: {
        stats: totemStats,
        recentRegistrations: recentRegistrations
      }
    });
  } catch (error: any) {
    await logError('Erro ao obter informações do sistema', error, { route: '/api/debug/system-info' });
    return res.status(500).json({ 
      error: 'Erro ao obter informações',
      message: error.message 
    });
  }
});

export default router;


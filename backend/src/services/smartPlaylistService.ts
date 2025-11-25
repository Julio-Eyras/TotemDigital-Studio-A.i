/**
 * Smart Playlist Service - Smart Signage v2.0
 * Serviço de playlist inteligente com IA
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { AIService } from './aiService';
import { logError } from '../utils/loggerHelper';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface SmartPlaylistRequest {
  clientId: number;
  campaignId?: number;
  totemId?: number;
  name: string;
  description?: string;
  targetAudience?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  season?: string;
  weather?: string;
  location?: string;
  contentType?: string;
  duration?: number;
  maxItems?: number;
  aiEnabled?: boolean;
  rules?: SmartPlaylistRule[];
}

export interface SmartPlaylistRule {
  id: string;
  type: 'time' | 'weather' | 'audience' | 'content' | 'performance' | 'custom';
  condition: string;
  action: 'include' | 'exclude' | 'prioritize' | 'deprioritize';
  value: any;
  weight?: number;
}

export interface SmartPlaylistResponse {
  id: number;
  clientId: number;
  campaignId?: number;
  totemId?: number;
  name: string;
  description?: string;
  targetAudience?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  season?: string;
  weather?: string;
  location?: string;
  contentType?: string;
  duration?: number;
  maxItems?: number;
  aiEnabled: boolean;
  rules: SmartPlaylistRule[];
  status: 'active' | 'inactive' | 'generating' | 'error';
  lastGenerated?: string;
  nextGeneration?: string;
  generatedItems: number;
  totalDuration: number;
  effectiveness: number;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  campaignTitle?: string;
  totemName?: string;
}

export interface SmartPlaylistStats {
  total: number;
  active: number;
  inactive: number;
  generating: number;
  error: number;
  byClient: { clientId: number; clientName: string; count: number }[];
  byCampaign: { campaignId: number; title: string; count: number }[];
  averageEffectiveness: number;
  totalGeneratedItems: number;
  recentActivity: {
    newPlaylists: number;
    generated: number;
    activated: number;
    deactivated: number;
  };
}

export interface PlaylistGenerationResult {
  playlistId: number;
  generatedItems: number;
  totalDuration: number;
  effectiveness: number;
  items: {
    mediaId: number;
    title: string;
    duration: number;
    score: number;
    reason: string;
  }[];
  metadata: {
    generationTime: number;
    rulesApplied: number;
    aiSuggestions: number;
    pythonScriptUsed: boolean;
  };
}

export class SmartPlaylistService {
  private get db() {
    return getDatabase();
  }

  /**
   * Busca o primeiro cliente ativo (para uso quando clientId não é fornecido)
   */
  async getFirstActiveClient(): Promise<{ client_id: number } | null> {
    try {
      const client = await this.db.findFirst(`
        SELECT client_id 
        FROM clients 
        WHERE COALESCE(is_active, true) = true 
        ORDER BY client_id ASC 
        LIMIT 1
      `);
      return client;
    } catch (error: any) {
      await logError('Erro ao buscar primeiro cliente', error, { service: 'SmartPlaylistService' });
      return null;
    }
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }
  
  private getAIService(): AIService {
    if (!(global as any).aiServiceInstance) {
      (global as any).aiServiceInstance = new AIService();
    }
    return (global as any).aiServiceInstance;
  }

  /**
   * Lista smart playlists com paginação e filtros
   */
  async getSmartPlaylists(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number;
      campaignId?: number;
      totemId?: number;
      status?: string;
      aiEnabled?: boolean;
      search?: string;
    } = {}
  ): Promise<{ playlists: SmartPlaylistResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.clientId) {
        whereClause += ' AND sp.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.campaignId) {
        whereClause += ' AND sp.campaign_id = ?';
        params.push(filters.campaignId);
      }

      if (filters.totemId) {
        whereClause += ' AND sp.totem_id = ?';
        params.push(filters.totemId);
      }

      if (filters.status) {
        whereClause += ' AND sp.status = ?';
        params.push(filters.status);
      }

      if (filters.aiEnabled !== undefined) {
        whereClause += ' AND sp.ai_enabled = ?';
        params.push(filters.aiEnabled);
      }

      if (filters.search) {
        whereClause += ' AND (sp.name LIKE ? OR sp.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar smart playlists
      const playlists = await this.db.findMany(`
        SELECT 
          sp.smart_playlist_id,
          sp.smart_playlist_id as id,
          sp.client_id as clientId,
          sp.campaign_id as campaignId,
          sp.totem_id as totemId,
          sp.name,
          sp.description,
          sp.target_audience as targetAudience,
          sp.time_of_day as timeOfDay,
          sp.day_of_week as dayOfWeek,
          sp.season,
          sp.weather,
          sp.location,
          sp.content_type as contentType,
          sp.duration,
          sp.max_items as maxItems,
          sp.ai_enabled as aiEnabled,
          sp.rules,
          sp.status,
          sp.last_generated as lastGenerated,
          sp.next_generation as nextGeneration,
          sp.generated_items as generatedItems,
          sp.total_duration as totalDuration,
          sp.effectiveness,
          sp.created_at as createdAt,
          sp.updated_at as updatedAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM smart_playlists sp
        LEFT JOIN clients cl ON sp.client_id = cl.client_id
        LEFT JOIN campaigns c ON sp.campaign_id = c.campaign_id
        LEFT JOIN totems t ON sp.totem_id = t.totem_id
        ${whereClause}
        ORDER BY sp.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM smart_playlists sp
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar playlists
      const playlistsWithRules = playlists.map(playlist => {
        // Processar rules - pode ser string JSON, null, ou já ser um objeto
        let parsedRules = [];
        if (playlist.rules) {
          if (typeof playlist.rules === 'string') {
            try {
              const trimmed = playlist.rules.trim();
              if (trimmed && trimmed !== 'null' && trimmed !== '') {
                parsedRules = JSON.parse(trimmed);
              }
            } catch (parseError: any) {
              await logError('Erro ao fazer parse de rules', parseError, { playlistId: playlist.id || playlist.smart_playlist_id });
              parsedRules = [];
            }
          } else if (Array.isArray(playlist.rules)) {
            parsedRules = playlist.rules;
          }
        }
        return {
          ...playlist,
          smart_playlist_id: playlist.smart_playlist_id || playlist.id,
          id: playlist.id || playlist.smart_playlist_id,
          rules: parsedRules
        };
      });

      return {
        playlists: playlistsWithRules,
        total,
        page,
        limit
      };

    } catch (error: any) {
      await logError('Erro ao buscar smart playlists', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca smart playlist por ID
   */
  async getSmartPlaylistById(playlistId: number): Promise<SmartPlaylistResponse | null> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT 
          sp.smart_playlist_id,
          sp.smart_playlist_id as id,
          sp.client_id as clientId,
          sp.campaign_id as campaignId,
          sp.totem_id as totemId,
          sp.name,
          sp.description,
          sp.target_audience as targetAudience,
          sp.time_of_day as timeOfDay,
          sp.day_of_week as dayOfWeek,
          sp.season,
          sp.weather,
          sp.location,
          sp.content_type as contentType,
          sp.duration,
          sp.max_items as maxItems,
          sp.ai_enabled as aiEnabled,
          sp.rules,
          sp.status,
          sp.last_generated as lastGenerated,
          sp.next_generation as nextGeneration,
          sp.generated_items as generatedItems,
          sp.total_duration as totalDuration,
          sp.effectiveness,
          sp.created_at as createdAt,
          sp.updated_at as updatedAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM smart_playlists sp
        LEFT JOIN clients cl ON sp.client_id = cl.client_id
        LEFT JOIN campaigns c ON sp.campaign_id = c.campaign_id
        LEFT JOIN totems t ON sp.totem_id = t.totem_id
        WHERE sp.smart_playlist_id = ?
      `, [playlistId]);

      if (!playlist) {
        return null;
      }

      // Processar rules - pode ser string JSON, null, ou já ser um objeto
      let parsedRules = [];
      if (playlist.rules) {
        if (typeof playlist.rules === 'string') {
          try {
            // Tentar fazer parse se for string
            const trimmed = playlist.rules.trim();
            if (trimmed && trimmed !== 'null' && trimmed !== '') {
              parsedRules = JSON.parse(trimmed);
            }
          } catch (parseError: any) {
            await logError('Erro ao fazer parse de rules', parseError, { playlistId, rulesValue: playlist.rules });
            parsedRules = [];
          }
        } else if (Array.isArray(playlist.rules)) {
          // Se já for array, usar diretamente
          parsedRules = playlist.rules;
        }
      }

      return {
        ...playlist,
        smart_playlist_id: playlist.smart_playlist_id || playlist.id,
        id: playlist.id || playlist.smart_playlist_id,
        rules: parsedRules
      };

    } catch (error: any) {
      await logError('Erro ao buscar smart playlist', error, { playlistId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova smart playlist
   */
  async createSmartPlaylist(data: SmartPlaylistRequest, createdBy: number): Promise<SmartPlaylistResponse> {
    try {
      const {
        clientId,
        campaignId,
        totemId,
        name,
        description,
        targetAudience,
        timeOfDay,
        dayOfWeek,
        season,
        weather,
        location,
        contentType,
        duration,
        maxItems,
        aiEnabled = true,
        rules = []
      } = data;

      // Validar campos obrigatórios
      if (!clientId || (typeof clientId === 'number' && clientId <= 0)) {
        throw new Error('clientId é obrigatório e deve ser um número válido');
      }

      if (!name || (typeof name === 'string' && name.trim() === '')) {
        throw new Error('name é obrigatório e não pode estar vazio');
      }

      // Verificar se cliente existe
      const client = await this.db.findFirst(`
        SELECT client_id FROM clients WHERE client_id = ? AND COALESCE(is_active, true) = true
      `, [clientId]);

      if (!client) {
        throw new Error('Cliente não encontrado ou inativo');
      }

      // Verificar se campanha existe (se fornecida)
      if (campaignId) {
        const campaign = await this.db.findFirst(`
          SELECT campaign_id FROM campaigns WHERE campaign_id = ?
        `, [campaignId]);

        if (!campaign) {
          throw new Error('Campanha não encontrada');
        }
      }

      // Verificar se totem existe (se fornecido)
      if (totemId) {
        const totem = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE totem_id = ?
        `, [totemId]);

        if (!totem) {
          throw new Error('Totem não encontrado');
        }
      }

      // Criar smart playlist
      const result = await this.db.executeRaw(`
        INSERT INTO smart_playlists (
          client_id, campaign_id, totem_id, name, description, target_audience,
          time_of_day, day_of_week, season, weather, location, content_type,
          duration, max_items, ai_enabled, rules, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING smart_playlist_id
      `, [
        clientId,
        campaignId,
        totemId,
        name,
        description,
        targetAudience,
        timeOfDay,
        dayOfWeek,
        season,
        weather,
        location,
        contentType,
        duration,
        maxItems,
        aiEnabled,
        JSON.stringify(rules),
        'inactive'
      ]);

      const playlistRow = result?.rows?.[0];
      if (!playlistRow?.smart_playlist_id) {
        throw new Error('Erro ao criar smart playlist');
      }

      // Buscar smart playlist criada
      const newPlaylist = await this.getSmartPlaylistById(playlistRow.smart_playlist_id);
      if (!newPlaylist) {
        throw new Error('Erro ao buscar smart playlist criada');
      }

      // Log de auditoria
      await this.getAuditService().log('smart_playlist', 'created', createdBy, {
        playlistId: newPlaylist.id,
        name: newPlaylist.name,
        clientId: newPlaylist.clientId,
        aiEnabled: newPlaylist.aiEnabled
      });

      return newPlaylist;

    } catch (error: any) {
      await logError('Erro ao criar smart playlist', error, { data });
      throw error;
    }
  }

  /**
   * Atualiza smart playlist
   */
  async updateSmartPlaylist(playlistId: number, data: Partial<SmartPlaylistRequest>, updatedBy: number): Promise<SmartPlaylistResponse> {
    try {
      // Verificar se smart playlist existe
      const existingPlaylist = await this.getSmartPlaylistById(playlistId);
      if (!existingPlaylist) {
        throw new Error('Smart playlist não encontrada');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.targetAudience !== undefined) {
        updates.push('target_audience = ?');
        params.push(data.targetAudience);
      }

      if (data.timeOfDay !== undefined) {
        updates.push('time_of_day = ?');
        params.push(data.timeOfDay);
      }

      if (data.dayOfWeek !== undefined) {
        updates.push('day_of_week = ?');
        params.push(data.dayOfWeek);
      }

      if (data.season !== undefined) {
        updates.push('season = ?');
        params.push(data.season);
      }

      if (data.weather !== undefined) {
        updates.push('weather = ?');
        params.push(data.weather);
      }

      if (data.location !== undefined) {
        updates.push('location = ?');
        params.push(data.location);
      }

      if (data.contentType !== undefined) {
        updates.push('content_type = ?');
        params.push(data.contentType);
      }

      if (data.duration !== undefined) {
        updates.push('duration = ?');
        params.push(data.duration);
      }

      if (data.maxItems !== undefined) {
        updates.push('max_items = ?');
        params.push(data.maxItems);
      }

      if (data.aiEnabled !== undefined) {
        updates.push('ai_enabled = ?');
        params.push(data.aiEnabled);
      }

      if (data.rules !== undefined) {
        updates.push('rules = ?');
        params.push(JSON.stringify(data.rules));
      }

      if (updates.length === 0) {
        return existingPlaylist;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(playlistId);

      // Atualizar smart playlist
      await this.db.executeRaw(`
        UPDATE smart_playlists 
        SET ${updates.join(', ')}
        WHERE smart_playlist_id = ?
      `, params);

      // Buscar smart playlist atualizada
      const updatedPlaylist = await this.getSmartPlaylistById(playlistId);
      if (!updatedPlaylist) {
        throw new Error('Erro ao buscar smart playlist atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('smart_playlist', 'updated', updatedBy, {
        playlistId,
        changes: data
      });

      return updatedPlaylist;

    } catch (error: any) {
      await logError('Erro ao atualizar smart playlist', error, { playlistId, data });
      throw error;
    }
  }

  /**
   * Remove smart playlist
   */
  async deleteSmartPlaylist(playlistId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se smart playlist existe
      const playlist = await this.getSmartPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Smart playlist não encontrada');
      }

      // Remover smart playlist
      await this.db.executeRaw(`
        DELETE FROM smart_playlists WHERE smart_playlist_id = ?
      `, [playlistId]);

      // Log de auditoria
      await this.getAuditService().log('smart_playlist', 'deleted', deletedBy, {
        playlistId,
        name: playlist.name,
        clientId: playlist.clientId
      });

    } catch (error: any) {
      await logError('Erro ao remover smart playlist', error, { playlistId });
      throw error;
    }
  }

  /**
   * Gera playlist inteligente
   */
  async generateSmartPlaylist(playlistId: number, generatedBy: number): Promise<PlaylistGenerationResult> {
    try {
      const startTime = Date.now();

      // Verificar se smart playlist existe
      const playlist = await this.getSmartPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Smart playlist não encontrada');
      }

      // Atualizar status para gerando
      await this.db.executeRaw(`
        UPDATE smart_playlists 
        SET status = 'generating', updated_at = CURRENT_TIMESTAMP
        WHERE smart_playlist_id = ?
      `, [playlistId]);

      try {
        let result: PlaylistGenerationResult;

        if (playlist.aiEnabled) {
          // Usar IA para gerar playlist
          result = await this.generateWithAI(playlist);
        } else {
          // Usar regras tradicionais
          result = await this.generateWithRules(playlist);
        }

        // Atualizar smart playlist com resultados
        await this.db.executeRaw(`
          UPDATE smart_playlists 
          SET 
            status = 'active',
            last_generated = CURRENT_TIMESTAMP,
            next_generation = NOW() + INTERVAL '1 day',
            generated_items = ?,
            total_duration = ?,
            effectiveness = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE smart_playlist_id = ?
        `, [
          result.generatedItems,
          result.totalDuration,
          result.effectiveness,
          playlistId
        ]);

        // Log de auditoria
        await this.getAuditService().log('smart_playlist', 'generated', generatedBy, {
          playlistId,
          generatedItems: result.generatedItems,
          totalDuration: result.totalDuration,
          effectiveness: result.effectiveness
        });

        return result;

      } catch (error: any) {
        // Atualizar status para erro
        await this.db.executeRaw(`
          UPDATE smart_playlists 
          SET status = 'error', updated_at = CURRENT_TIMESTAMP
          WHERE smart_playlist_id = ?
        `, [playlistId]);

        throw error;
      }

    } catch (error: any) {
      await logError('Erro ao gerar smart playlist', error, { playlistId });
      throw error;
    }
  }

  /**
   * Gera playlist usando IA
   */
  private async generateWithAI(playlist: SmartPlaylistResponse): Promise<PlaylistGenerationResult> {
    try {
      // Buscar mídia disponível
      const availableMedia = await this.db.findMany(`
        SELECT 
          m.media_id,
          COALESCE(m.title, m.name) AS title,
          COALESCE(m.duration_seconds, 0) AS duration_seconds,
          COALESCE(m.view_count, 0) AS view_count,
          COALESCE(m.media_type, 'unknown') AS media_type,
          COALESCE(m.tags, '[]') AS tags,
          m.metadata
        FROM medias m
        WHERE COALESCE(m.is_active, true) = true AND m.client_id = ?
        ORDER BY COALESCE(m.view_count, 0) DESC
      `, [playlist.clientId]);

      // Construir prompt para IA
      const prompt = this.buildAIPrompt(playlist, availableMedia);

      // Processar com IA
      const aiResponse = await this.getAIService().processRequest({
        prompt,
        maxTokens: 2000,
        temperature: 0.7
      }, 1); // Usar ID do sistema

      // Processar resposta da IA
      const result = this.parseAIResponse(aiResponse.response, availableMedia);

      return {
        playlistId: playlist.id,
        generatedItems: result.items.length,
        totalDuration: result.items.reduce((sum, item) => sum + item.duration, 0),
        effectiveness: result.effectiveness,
        items: result.items,
        metadata: {
          generationTime: Date.now() - Date.now(),
          rulesApplied: playlist.rules.length,
          aiSuggestions: result.items.length,
          pythonScriptUsed: false
        }
      };

    } catch (error: any) {
      await logError('Erro ao gerar playlist com IA', error, { playlistId, request });
      throw new Error('Erro ao gerar playlist com IA');
    }
  }

  /**
   * Gera playlist usando regras tradicionais
   */
  private async generateWithRules(playlist: SmartPlaylistResponse): Promise<PlaylistGenerationResult> {
    try {
      // Executar script Python se disponível
      const pythonResult = await this.runPythonScript(playlist);
      
      if (pythonResult.success) {
        return pythonResult.result;
      }

      // Fallback para regras simples
      return await this.generateWithSimpleRules(playlist);

    } catch (error: any) {
      await logError('Erro ao gerar playlist com regras', error, { playlistId, rules });
      throw new Error('Erro ao gerar playlist com regras');
    }
  }

  /**
   * Executa script Python para geração de playlist
   */
  private async runPythonScript(playlist: SmartPlaylistResponse): Promise<{
    success: boolean;
    result?: PlaylistGenerationResult;
    error?: string;
  }> {
    try {
      const scriptPath = path.join(__dirname, '../../python/smart_playlist_generator.py');
      
      if (!fs.existsSync(scriptPath)) {
        return { success: false, error: 'Script Python não encontrado' };
      }

      const playlistData = JSON.stringify(playlist);
      
      return new Promise((resolve) => {
        const python = spawn('python3', [scriptPath, playlistData]);
        
        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
          output += data.toString();
        });

        python.stderr.on('data', (data) => {
          error += data.toString();
        });

        python.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(output);
              resolve({ success: true, result });
            } catch (parseError) {
              resolve({ success: false, error: 'Erro ao processar resultado do Python' });
            }
          } else {
            resolve({ success: false, error: error || 'Erro na execução do script Python' });
          }
        });

        python.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      });

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Gera playlist com regras simples
   */
  private async generateWithSimpleRules(playlist: SmartPlaylistResponse): Promise<PlaylistGenerationResult> {
    try {
      // Buscar mídia baseada em regras simples
      let query = `
        SELECT 
          m.media_id,
          COALESCE(m.title, m.name) AS title,
          COALESCE(m.duration_seconds, 0) AS duration_seconds,
          COALESCE(m.view_count, 0) AS view_count,
          COALESCE(m.media_type, 'unknown') AS media_type,
          COALESCE(m.tags, '[]') AS tags,
          m.metadata
        FROM medias m
        WHERE COALESCE(m.is_active, true) = true AND m.client_id = ?
      `;

      const params = [playlist.clientId];

      // Aplicar filtros básicos
      if (playlist.contentType) {
        query += ' AND m.media_type = ?';
        params.push(playlist.contentType as any);
      }

      if (playlist.duration) {
        query += ' AND m.duration_seconds <= ?';
        params.push(playlist.duration);
      }

      query += ' ORDER BY COALESCE(m.view_count, 0) DESC';

      if (playlist.maxItems) {
        query += ' LIMIT ?';
        params.push(playlist.maxItems);
      }

      const media = await this.db.findMany(query, params);

      // Calcular scores e selecionar itens
      const items = media.map((item, index) => ({
        mediaId: item.media_id,
        title: item.title,
        duration: item.duration_seconds,
        score: this.calculateScore(item, playlist, index),
        reason: this.getSelectionReason(item, playlist)
      }));

      // Ordenar por score
      items.sort((a, b) => b.score - a.score);

      // Limitar duração se especificada
      let selectedItems = items;
      if (playlist.duration) {
        selectedItems = [];
        let totalDuration = 0;
        
        for (const item of items) {
          if (totalDuration + item.duration <= playlist.duration) {
            selectedItems.push(item);
            totalDuration += item.duration;
          }
        }
      }

      return {
        playlistId: playlist.id,
        generatedItems: selectedItems.length,
        totalDuration: selectedItems.reduce((sum, item) => sum + item.duration, 0),
        effectiveness: this.calculateEffectiveness(selectedItems),
        items: selectedItems,
        metadata: {
          generationTime: 0,
          rulesApplied: playlist.rules.length,
          aiSuggestions: 0,
          pythonScriptUsed: false
        }
      };

    } catch (error: any) {
      await logError('Erro ao gerar playlist com regras simples', error, { playlistId });
      throw new Error('Erro ao gerar playlist com regras simples');
    }
  }

  /**
   * Constrói prompt para IA
   */
  private buildAIPrompt(playlist: SmartPlaylistResponse, media: any[]): string {
    return `
    Gere uma playlist inteligente para digital signage com base nos seguintes critérios:
    
    Contexto da Playlist:
    - Nome: ${playlist.name}
    - Descrição: ${playlist.description || 'N/A'}
    - Público-alvo: ${playlist.targetAudience || 'Geral'}
    - Horário: ${playlist.timeOfDay || 'Qualquer'}
    - Dia da semana: ${playlist.dayOfWeek || 'Qualquer'}
    - Estação: ${playlist.season || 'Qualquer'}
    - Clima: ${playlist.weather || 'Qualquer'}
    - Localização: ${playlist.location || 'N/A'}
    - Tipo de conteúdo: ${playlist.contentType || 'Qualquer'}
    - Duração máxima: ${playlist.duration || 'Sem limite'} segundos
    - Máximo de itens: ${playlist.maxItems || 'Sem limite'}
    
    Mídia Disponível:
    ${media.map(m => `- ${m.title} (${m.duration_seconds}s, ${m.view_count} views, ${m.media_type})`).join('\n')}
    
    Regras:
    ${playlist.rules.map(r => `- ${r.type}: ${r.condition} -> ${r.action}`).join('\n')}
    
    Retorne uma lista JSON com os itens selecionados, incluindo:
    - mediaId
    - title
    - duration
    - score (0-100)
    - reason (explicação da seleção)
    `;
  }

  /**
   * Processa resposta da IA
   */
  private parseAIResponse(response: string, availableMedia: any[]): {
    items: any[];
    effectiveness: number;
  } {
    try {
      // Extrair JSON da resposta
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Resposta da IA não contém JSON válido');
      }

      const items = JSON.parse(jsonMatch[0]);
      
      // Validar e filtrar itens
      const validItems = items.filter((item: any) => {
        return availableMedia.some(media => media.media_id === item.mediaId);
      });

      // Calcular efetividade
      const effectiveness = validItems.length > 0 
        ? validItems.reduce((sum: number, item: any) => sum + item.score, 0) / validItems.length
        : 0;

      return {
        items: validItems,
        effectiveness
      };

    } catch (error: any) {
      await logError('Erro ao processar resposta da IA', error, { aiResponse });
      return {
        items: [],
        effectiveness: 0
      };
    }
  }

  /**
   * Calcula score para item de mídia
   */
  private calculateScore(item: any, playlist: SmartPlaylistResponse, index: number): number {
    let score = 100 - index; // Score baseado na posição

    // Ajustar baseado no tipo de conteúdo
    if (playlist.contentType && item.media_type === playlist.contentType) {
      score += 20;
    }

    // Ajustar baseado na duração
    if (playlist.duration && item.duration_seconds <= playlist.duration) {
      score += 10;
    }

    // Ajustar baseado nas visualizações
    score += Math.min(item.view_count / 100, 20);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Obtém razão da seleção
   */
  private getSelectionReason(item: any, playlist: SmartPlaylistResponse): string {
    const reasons = [];

    if (playlist.contentType && item.media_type === playlist.contentType) {
      reasons.push('Tipo de conteúdo adequado');
    }

    if (playlist.duration && item.duration_seconds <= playlist.duration) {
      reasons.push('Duração adequada');
    }

    if (item.view_count > 100) {
      reasons.push('Alto engajamento');
    }

    return reasons.join(', ') || 'Seleção baseada em regras gerais';
  }

  /**
   * Calcula efetividade da playlist
   */
  private calculateEffectiveness(items: any[]): number {
    if (items.length === 0) return 0;
    
    const avgScore = items.reduce((sum, item) => sum + item.score, 0) / items.length;
    const diversity = new Set(items.map(item => item.media_type)).size;
    
    return Math.min(100, avgScore + (diversity * 5));
  }

  /**
   * Busca estatísticas de smart playlists
   */
  async getSmartPlaylistStats(): Promise<SmartPlaylistStats> {
    try {
      // Total de smart playlists
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM smart_playlists
      `);

      // Por status
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists WHERE status = 'active'
      `);

      const inactiveResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists WHERE status = 'inactive'
      `);

      const generatingResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists WHERE status = 'generating'
      `);

      const errorResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists WHERE status = 'error'
      `);

      // Por cliente
      const byClient = await this.db.findMany(`
        SELECT 
          sp.client_id as clientId,
          cl.name as clientName,
          COUNT(*) as count
        FROM smart_playlists sp
        LEFT JOIN clients cl ON sp.client_id = cl.client_id
        GROUP BY sp.client_id, cl.name
        ORDER BY count DESC
        LIMIT 10
      `);

      // Por campanha
      const byCampaign = await this.db.findMany(`
        SELECT 
          sp.campaign_id as campaignId,
          c.title,
          COUNT(*) as count
        FROM smart_playlists sp
        LEFT JOIN campaigns c ON sp.campaign_id = c.campaign_id
        WHERE sp.campaign_id IS NOT NULL
        GROUP BY sp.campaign_id, c.title
        ORDER BY count DESC
        LIMIT 10
      `);

      // Efetividade média
      const avgEffectivenessResult = await this.db.findFirst(`
        SELECT AVG(effectiveness) as avg FROM smart_playlists WHERE effectiveness > 0
      `);

      // Total de itens gerados
      const totalGeneratedResult = await this.db.findFirst(`
        SELECT SUM(generated_items) as total FROM smart_playlists
      `);

      // Atividade recente (últimos 7 dias)
      const newPlaylistsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists WHERE created_at >= NOW() - INTERVAL '7 days'
      `);

      const generatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists 
        WHERE last_generated >= NOW() - INTERVAL '7 days'
      `);

      const activatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists 
        WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      const deactivatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM smart_playlists 
        WHERE status = 'inactive' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.count || 0,
        inactive: inactiveResult?.count || 0,
        generating: generatingResult?.count || 0,
        error: errorResult?.count || 0,
        byClient: byClient.map(c => ({ clientId: c.clientId, clientName: c.clientName, count: c.count })),
        byCampaign: byCampaign.map(c => ({ campaignId: c.campaignId, title: c.title, count: c.count })),
        averageEffectiveness: avgEffectivenessResult?.avg || 0,
        totalGeneratedItems: totalGeneratedResult?.total || 0,
        recentActivity: {
          newPlaylists: newPlaylistsResult?.count || 0,
          generated: generatedResult?.count || 0,
          activated: activatedResult?.count || 0,
          deactivated: deactivatedResult?.count || 0
        }
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de smart playlists', error);
      throw new Error('Erro interno do servidor');
    }
  }
}


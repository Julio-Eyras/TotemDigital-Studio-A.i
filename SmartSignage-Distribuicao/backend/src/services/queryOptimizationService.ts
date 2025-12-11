/**
 * Query Optimization Service - Smart Signage Pro v3.1
 * Serviço para identificar e otimizar queries N+1
 */

import { getDatabase } from '../config/database';
import { logWarn, logInfo } from '../utils/loggerHelper';
import { batchLoadRelations } from '../utils/queryOptimizer';

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowCount: number;
  isNPlusOne: boolean;
  suggestions: string[];
}

export class QueryOptimizationService {
  private get db() {
    return getDatabase();
  }

  /**
   * Analisa queries e identifica possíveis problemas N+1
   */
  async analyzeQueries(): Promise<QueryAnalysis[]> {
    try {
      // Buscar queries lentas do pg_stat_statements (se disponível)
      const slowQueries = await this.db.query(`
        SELECT 
          query,
          mean_exec_time,
          calls,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      const analyses: QueryAnalysis[] = [];

      for (const row of slowQueries.rows) {
        const analysis: QueryAnalysis = {
          query: row.query,
          executionTime: row.mean_exec_time,
          rowCount: row.rows,
          isNPlusOne: this.detectNPlusOne(row.query),
          suggestions: this.generateSuggestions(row.query)
        };
        analyses.push(analysis);
      }

      return analyses;
    } catch (error: unknown) {
      await logWarn('Erro ao analisar queries', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Detecta se uma query pode ser N+1
   */
  private detectNPlusOne(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Padrões que indicam possível N+1
    const patterns = [
      /select.*from.*where.*=.*\$/i, // Query com WHERE simples
      /select.*from.*where.*in\s*\(/i, // Query com IN
    ];
    
    // Se não tem JOIN e tem WHERE, pode ser N+1
    const hasJoin = normalizedQuery.includes('join');
    const hasWhere = normalizedQuery.includes('where');
    const hasIn = normalizedQuery.includes(' in ');
    
    return !hasJoin && hasWhere && (hasIn || patterns.some(p => p.test(query)));
  }

  /**
   * Gera sugestões de otimização
   */
  private generateSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const normalizedQuery = query.toLowerCase();
    
    if (!normalizedQuery.includes('join')) {
      suggestions.push('Considere usar JOIN para buscar relacionamentos em uma única query');
    }
    
    if (normalizedQuery.includes('select *')) {
      suggestions.push('Especifique colunas ao invés de SELECT *');
    }
    
    if (!normalizedQuery.includes('limit')) {
      suggestions.push('Adicione LIMIT para evitar buscar muitos registros');
    }
    
    if (normalizedQuery.includes('order by') && !normalizedQuery.includes('index')) {
      suggestions.push('Verifique se há índices nas colunas de ORDER BY');
    }
    
    return suggestions;
  }

  /**
   * Otimiza busca de campanhas com totens (exemplo de otimização N+1)
   */
  async getCampaignsWithTotemsOptimized(
    page: number = 1,
    limit: number = 20
  ): Promise<Array<Record<string, unknown> & { totems: unknown[] }>> {
    try {
      // Buscar campanhas
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.title,
          c.description,
          c.status,
          c.client_id as clientId
        FROM campaigns c
        WHERE c.is_active = true
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, (page - 1) * limit]);

      if (campaigns.length === 0) {
        return [];
      }

      // Buscar totens em batch (prevenir N+1)
      const campaignIds = campaigns.map((c: Record<string, unknown>) => c.id);
      const totemsMap = await batchLoadRelations(
        campaigns as Array<Record<string, unknown>>,
        'totems',
        'campaign_totems',
        'campaign_id',
        'id'
      );

      // Combinar resultados
      return campaigns.map((campaign: Record<string, unknown>) => ({
        ...campaign,
        totems: totemsMap.get(campaign.id as number) || []
      })) as Array<Record<string, unknown> & { totems: unknown[] }>;
    } catch (error: unknown) {
      await logWarn('Erro ao buscar campanhas otimizadas', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Singleton
let queryOptimizationServiceInstance: QueryOptimizationService | null = null;

export function getQueryOptimizationService(): QueryOptimizationService {
  if (!queryOptimizationServiceInstance) {
    queryOptimizationServiceInstance = new QueryOptimizationService();
  }
  return queryOptimizationServiceInstance;
}


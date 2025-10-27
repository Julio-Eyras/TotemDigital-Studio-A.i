/**
 * AI Service - Smart Signage v2.0
 * Serviço de integração com IA (Ollama, OpenAI, Anthropic)
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import axios from 'axios';

export interface AIRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
}

export interface AIResponse {
  id: string;
  prompt: string;
  response: string;
  model: string;
  provider: string;
  tokensUsed: number;
  cost: number;
  processingTime: number;
  timestamp: string;
  metadata?: any;
}

export interface AIConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  baseUrl?: string;
  apiKey?: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byProvider: {
    provider: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
  byModel: {
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
  recentActivity: {
    requests: number;
    tokens: number;
    cost: number;
  };
}

export class AIService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }
  
  private config: AIConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Carrega configuração de IA
   */
  private loadConfig(): AIConfig {
    const provider = (process.env.AI_PROVIDER || 'ollama') as 'ollama' | 'openai' | 'anthropic';
    
    return {
      provider,
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      defaultModel: this.getDefaultModel(provider),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      enabled: process.env.AI_ENABLED !== 'false'
    };
  }

  /**
   * Obtém modelo padrão baseado no provider
   */
  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'llama2';
      case 'openai':
        return process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      case 'anthropic':
        return process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';
      default:
        return 'llama2';
    }
  }

  /**
   * Processa requisição de IA
   */
  async processRequest(request: AIRequest, userId: number): Promise<AIResponse> {
    try {
      if (!this.config.enabled) {
        throw new Error('Serviço de IA desabilitado');
      }

      const startTime = Date.now();
      const model = request.model || this.config.defaultModel;
      
      let response: any;
      let tokensUsed = 0;
      let cost = 0;

      // Processar baseado no provider
      switch (this.config.provider) {
        case 'ollama':
          response = await this.processOllamaRequest(request, model);
          tokensUsed = this.estimateTokens(request.prompt + response.response);
          cost = this.calculateCost('ollama', tokensUsed);
          break;

        case 'openai':
          response = await this.processOpenAIRequest(request, model);
          tokensUsed = response.usage?.total_tokens || 0;
          cost = this.calculateCost('openai', tokensUsed, model);
          break;

        case 'anthropic':
          response = await this.processAnthropicRequest(request, model);
          tokensUsed = response.usage?.input_tokens + response.usage?.output_tokens || 0;
          cost = this.calculateCost('anthropic', tokensUsed, model);
          break;

        default:
          throw new Error(`Provider de IA não suportado: ${this.config.provider}`);
      }

      const processingTime = Date.now() - startTime;
      const aiResponse: AIResponse = {
        id: this.generateId(),
        prompt: request.prompt,
        response: response.response || response.content || response.message,
        model,
        provider: this.config.provider,
        tokensUsed,
        cost,
        processingTime,
        timestamp: new Date().toISOString(),
        metadata: response.metadata
      };

      // Salvar no banco de dados
      await this.saveAIRequest(aiResponse, userId);

      return aiResponse;

    } catch (error: any) {
      console.error('❌ Erro ao processar requisição de IA:', error.message);
      throw error;
    }
  }

  /**
   * Processa requisição via Ollama
   */
  private async processOllamaRequest(request: AIRequest, model: string): Promise<any> {
    try {
      const response = await axios.post(`${this.config.baseUrl}/api/generate`, {
        model,
        prompt: request.prompt,
        context: request.context,
        stream: false,
        options: {
          temperature: request.temperature || this.config.temperature,
          num_predict: request.maxTokens || this.config.maxTokens
        }
      });

      return {
        response: response.data.response,
        metadata: {
          model: response.data.model,
          created_at: response.data.created_at,
          done: response.data.done
        }
      };

    } catch (error: any) {
      console.error('❌ Erro na requisição Ollama:', error.message);
      throw new Error('Erro ao processar requisição via Ollama');
    }
  }

  /**
   * Processa requisição via OpenAI
   */
  private async processOpenAIRequest(request: AIRequest, model: string): Promise<any> {
    try {
      if (!this.config.apiKey) {
        throw new Error('API Key do OpenAI não configurada');
      }

      const messages = [];
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      messages.push({ role: 'user', content: request.prompt });

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model,
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        response: response.data.choices[0].message.content,
        usage: response.data.usage,
        metadata: {
          model: response.data.model,
          created: response.data.created,
          finish_reason: response.data.choices[0].finish_reason
        }
      };

    } catch (error: any) {
      console.error('❌ Erro na requisição OpenAI:', error.message);
      throw new Error('Erro ao processar requisição via OpenAI');
    }
  }

  /**
   * Processa requisição via Anthropic
   */
  private async processAnthropicRequest(request: AIRequest, model: string): Promise<any> {
    try {
      if (!this.config.apiKey) {
        throw new Error('API Key do Anthropic não configurada');
      }

      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        system: request.systemPrompt,
        messages: [
          { role: 'user', content: request.prompt }
        ]
      }, {
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });

      return {
        response: response.data.content[0].text,
        usage: response.data.usage,
        metadata: {
          model: response.data.model,
          id: response.data.id,
          type: response.data.type
        }
      };

    } catch (error: any) {
      console.error('❌ Erro na requisição Anthropic:', error.message);
      throw new Error('Erro ao processar requisição via Anthropic');
    }
  }

  /**
   * Salva requisição de IA no banco
   */
  private async saveAIRequest(aiResponse: AIResponse, userId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO ai_requests (
          request_id, user_id, prompt, response, model, provider,
          tokens_used, cost, processing_time, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        aiResponse.id,
        userId,
        aiResponse.prompt,
        aiResponse.response,
        aiResponse.model,
        aiResponse.provider,
        aiResponse.tokensUsed,
        aiResponse.cost,
        aiResponse.processingTime,
        aiResponse.metadata ? JSON.stringify(aiResponse.metadata) : null
      ]);

    } catch (error: any) {
      console.error('❌ Erro ao salvar requisição de IA:', error.message);
      // Não falhar a requisição por erro de salvamento
    }
  }

  /**
   * Busca histórico de requisições de IA
   */
  async getAIRequests(
    page: number = 1,
    limit: number = 20,
    filters: {
      userId?: number;
      provider?: string;
      model?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ requests: AIResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.userId) {
        whereClause += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.provider) {
        whereClause += ' AND provider = ?';
        params.push(filters.provider);
      }

      if (filters.model) {
        whereClause += ' AND model = ?';
        params.push(filters.model);
      }

      if (filters.startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(filters.endDate);
      }

      // Buscar requisições
      const requests = await this.db.findMany(`
        SELECT 
          request_id as id,
          prompt,
          response,
          model,
          provider,
          tokens_used as tokensUsed,
          cost,
          processing_time as processingTime,
          created_at as timestamp,
          metadata
        FROM ai_requests
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM ai_requests ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      return {
        requests,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar requisições de IA:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas de uso de IA
   */
  async getAIUsageStats(): Promise<AIUsageStats> {
    try {
      // Total de requisições
      const totalRequestsResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM ai_requests
      `);

      // Total de tokens
      const totalTokensResult = await this.db.findFirst(`
        SELECT SUM(tokens_used) as total FROM ai_requests
      `);

      // Total de custo
      const totalCostResult = await this.db.findFirst(`
        SELECT SUM(cost) as total FROM ai_requests
      `);

      // Por provider
      const byProvider = await this.db.findMany(`
        SELECT 
          provider,
          COUNT(*) as requests,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost
        FROM ai_requests
        GROUP BY provider
        ORDER BY requests DESC
      `);

      // Por modelo
      const byModel = await this.db.findMany(`
        SELECT 
          model,
          COUNT(*) as requests,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost
        FROM ai_requests
        GROUP BY model
        ORDER BY requests DESC
      `);

      // Atividade recente (últimos 7 dias)
      const recentActivity = await this.db.findFirst(`
        SELECT 
          COUNT(*) as requests,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost
        FROM ai_requests
        WHERE created_at >= datetime('now', '-7 days')
      `);

      return {
        totalRequests: totalRequestsResult?.total || 0,
        totalTokens: totalTokensResult?.total || 0,
        totalCost: totalCostResult?.total || 0,
        byProvider: byProvider.map(p => ({
          provider: p.provider,
          requests: p.requests,
          tokens: p.tokens,
          cost: p.cost
        })),
        byModel: byModel.map(m => ({
          model: m.model,
          requests: m.requests,
          tokens: m.tokens,
          cost: m.cost
        })),
        recentActivity: {
          requests: recentActivity?.requests || 0,
          tokens: recentActivity?.tokens || 0,
          cost: recentActivity?.cost || 0
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de IA:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera sugestões de conteúdo
   */
  async generateContentSuggestions(context: string, userId: number): Promise<string[]> {
    try {
      const prompt = `Com base no contexto: "${context}", gere 5 sugestões de conteúdo para digital signage. Seja criativo e relevante.`;

      const response = await this.processRequest({
        prompt,
        maxTokens: 500,
        temperature: 0.8
      }, userId);

      // Processar resposta para extrair sugestões
      const suggestions = response.response
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 5);

      return suggestions;

    } catch (error: any) {
      console.error('❌ Erro ao gerar sugestões de conteúdo:', error.message);
      throw new Error('Erro ao gerar sugestões de conteúdo');
    }
  }

  /**
   * Analisa performance de campanha
   */
  async analyzeCampaignPerformance(campaignData: any, userId: number): Promise<string> {
    try {
      const prompt = `Analise os seguintes dados de campanha e forneça insights sobre performance:
      
      Título: ${campaignData.title}
      Visualizações: ${campaignData.views}
      Duração: ${campaignData.duration}
      Efetividade: ${campaignData.effectiveness}
      
      Forneça uma análise detalhada com recomendações para melhorar a performance.`;

      const response = await this.processRequest({
        prompt,
        maxTokens: 800,
        temperature: 0.7
      }, userId);

      return response.response;

    } catch (error: any) {
      console.error('❌ Erro ao analisar performance da campanha:', error.message);
      throw new Error('Erro ao analisar performance da campanha');
    }
  }

  /**
   * Gera relatório inteligente
   */
  async generateIntelligentReport(data: any, userId: number): Promise<string> {
    try {
      const prompt = `Com base nos seguintes dados de analytics, gere um relatório inteligente com insights e recomendações:
      
      ${JSON.stringify(data, null, 2)}
      
      O relatório deve incluir:
      1. Resumo executivo
      2. Principais insights
      3. Tendências identificadas
      4. Recomendações de ação
      5. Próximos passos`;

      const response = await this.processRequest({
        prompt,
        maxTokens: 1500,
        temperature: 0.6
      }, userId);

      return response.response;

    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório inteligente:', error.message);
      throw new Error('Erro ao gerar relatório inteligente');
    }
  }

  /**
   * Estima número de tokens (aproximação)
   */
  private estimateTokens(text: string): number {
    // Aproximação simples: 1 token ≈ 4 caracteres
    return Math.ceil(text.length / 4);
  }

  /**
   * Calcula custo baseado no provider e tokens
   */
  private calculateCost(provider: string, tokens: number, model?: string): number {
    // Preços aproximados por 1K tokens
    const prices: { [key: string]: { [key: string]: number } } = {
      ollama: { default: 0 }, // Gratuito
      openai: {
        'gpt-3.5-turbo': 0.002,
        'gpt-4': 0.03,
        'gpt-4-turbo': 0.01
      },
      anthropic: {
        'claude-3-sonnet-20240229': 0.015,
        'claude-3-opus-20240229': 0.075
      }
    };

    const modelKey = model || 'default';
    const pricePer1K = prices[provider]?.[modelKey] || 0;
    
    return (tokens / 1000) * pricePer1K;
  }

  /**
   * Gera ID único
   */
  private generateId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verifica status do serviço de IA
   */
  async checkAIStatus(): Promise<{
    enabled: boolean;
    provider: string;
    status: 'online' | 'offline' | 'error';
    message: string;
  }> {
    try {
      if (!this.config.enabled) {
        return {
          enabled: false,
          provider: this.config.provider,
          status: 'offline',
          message: 'Serviço de IA desabilitado'
        };
      }

      // Testar conexão baseada no provider
      switch (this.config.provider) {
        case 'ollama':
          await axios.get(`${this.config.baseUrl}/api/tags`);
          break;

        case 'openai':
          if (!this.config.apiKey) {
            throw new Error('API Key não configurada');
          }
          break;

        case 'anthropic':
          if (!this.config.apiKey) {
            throw new Error('API Key não configurada');
          }
          break;
      }

      return {
        enabled: true,
        provider: this.config.provider,
        status: 'online',
        message: 'Serviço de IA funcionando normalmente'
      };

    } catch (error: any) {
      return {
        enabled: this.config.enabled,
        provider: this.config.provider,
        status: 'error',
        message: error.message
      };
    }
  }
}

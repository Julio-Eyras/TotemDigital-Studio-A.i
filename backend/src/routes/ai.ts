/**
 * AI Routes - Smart Signage v2.0
 * Rotas para integração com IA
 */

import { Router } from 'express';
import { AIService } from '../services/aiService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization - só criar quando necessário
function getAIService(): AIService {
  if (!(global as any).aiServiceInstance) {
    (global as any).aiServiceInstance = new AIService();
  }
  return (global as any).aiServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken as any);

/**
 * @route GET /api/ai/status
 * @desc Verifica status do serviço de IA
 * @access Private (Admin, Manager)
 */
router.get('/status', authorizeRole(['admin', 'gerente_marketing']) as any, async (_req, res) => {
  try {
    const status = await getAIService().checkAIStatus();

    return res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    await logError('Erro ao verificar status da IA', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/process
 * @desc Processa requisição de IA
 * @access Private (Admin, Manager, Client)
 */
router.post('/process', async (req: any, res) => {
  try {
    const { prompt, context, maxTokens, temperature, model, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt é obrigatório'
      });
    }

    const response = await getAIService().processRequest({
      prompt,
      context,
      maxTokens,
      temperature,
      model,
      systemPrompt
    }, req.user.id);

    return res.json({
      success: true,
      data: response
    });

  } catch (error: any) {
    await logError('Erro ao processar requisição de IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao processar requisição de IA',
      error: error.message
    });
  }
});

/** Alias FE: POST /api/ai/generate → processRequest (mesmo contrato de /process) */
router.post('/generate', async (req: any, res) => {
  try {
    const { prompt, context, maxTokens, temperature, model, systemPrompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt é obrigatório' });
    }
    const response = await getAIService().processRequest(
      { prompt, context, maxTokens, temperature, model, systemPrompt },
      req.user.id
    );
    return res.json({ success: true, data: response });
  } catch (error: any) {
    await logError('Erro ao processar requisição de IA (generate)', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao processar requisição de IA',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai/requests
 * @desc Lista requisições de IA
 * @access Private (Admin, Manager)
 * @note Persistência ai_requests adiada (FEATURE_DEFERRED) até DDL no schema v2
 */
router.get('/requests', authorizeRole(['admin', 'gerente_marketing']) as any, async (_req, res) => {
  return res.status(501).json({
    error: 'Feature adiada',
    code: 'FEATURE_DEFERRED',
    feature: 'ai_request_history',
    reason: 'Tabela ai_requests ausente no schema v2 definitivo.',
    deferredUntil: 'v6.x+',
  });
});

/**
 * @route GET /api/ai/stats
 * @desc Busca estatísticas de uso de IA
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'gerente_marketing']) as any, async (_req, res) => {
  return res.status(501).json({
    error: 'Feature adiada',
    code: 'FEATURE_DEFERRED',
    feature: 'ai_request_history',
    reason: 'Estatísticas dependem de ai_requests (DDL ausente no schema v2).',
    deferredUntil: 'v6.x+',
  });
});

/**
 * @route POST /api/ai/suggestions
 * @desc Gera sugestões de conteúdo
 * @access Private (Admin, Manager, Client)
 */
router.post('/suggestions', async (req: any, res) => {
  try {
    const { context } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: 'Contexto é obrigatório'
      });
    }

    const suggestions = await getAIService().generateContentSuggestions(context, req.user.userId);

    return res.json({
      success: true,
      data: suggestions
    });

  } catch (error: any) {
    await logError('Erro ao gerar sugestões com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao gerar sugestões',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/analyze-campaign
 * @desc Analisa performance de campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/analyze-campaign', async (req: any, res) => {
  try {
    const { campaignData } = req.body;

    if (!campaignData) {
      return res.status(400).json({
        success: false,
        message: 'Dados da campanha são obrigatórios'
      });
    }

    const analysis = await getAIService().analyzeCampaignPerformance(campaignData, req.user.userId);

    return res.json({
      success: true,
      data: { analysis }
    });

  } catch (error: any) {
    await logError('Erro ao analisar campanha com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao analisar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/generate-report
 * @desc Gera relatório inteligente
 * @access Private (Admin, Manager, Client)
 */
router.post('/generate-report', async (req: any, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Dados são obrigatórios'
      });
    }

    const report = await getAIService().generateIntelligentReport(data, req.user.userId);

    return res.json({
      success: true,
      data: { report }
    });

  } catch (error: any) {
    await logError('Erro ao gerar relatório com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao gerar relatório',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/chat
 * @desc Chat com IA para suporte
 * @access Private (Admin, Manager, Client)
 */
router.post('/chat', async (req: any, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem é obrigatória'
      });
    }

    // Construir contexto da conversa
    const context = conversationHistory
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `Você é um assistente especializado em digital signage. 
    Ajude o usuário com dúvidas sobre campanhas, totems, mídia, analytics e funcionalidades do sistema.
    Seja útil, preciso e amigável.`;

    const response = await getAIService().processRequest({
      prompt: message,
      context,
      systemPrompt,
      maxTokens: 500,
      temperature: 0.7
    }, req.user.id);

    return res.json({
      success: true,
      data: {
        response: response.response,
        conversationId: response.id
      }
    });

  } catch (error: any) {
    await logError('Erro no chat com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro no chat com IA',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/optimize-content
 * @desc Otimiza conteúdo para digital signage
 * @access Private (Admin, Manager, Client)
 */
router.post('/optimize-content', async (req: any, res) => {
  try {
    const { content, contentType, targetAudience, duration } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Conteúdo é obrigatório'
      });
    }

    const prompt = `Otimize o seguinte conteúdo para digital signage:
    
    Conteúdo: ${content}
    Tipo: ${contentType || 'geral'}
    Público-alvo: ${targetAudience || 'geral'}
    Duração: ${duration || '15 segundos'}
    
    Forneça sugestões de otimização considerando:
    1. Clareza e legibilidade
    2. Impacto visual
    3. Engajamento do público
    4. Duração adequada
    5. Call-to-action eficaz`;

    const response = await getAIService().processRequest({
      prompt,
      maxTokens: 800,
      temperature: 0.7
    }, req.user.id);

    return res.json({
      success: true,
      data: { optimization: response.response }
    });

  } catch (error: any) {
    await logError('Erro ao otimizar conteúdo com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao otimizar conteúdo',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/analyze-audience
 * @desc Analisa dados de audiência
 * @access Private (Admin, Manager, Client)
 */
router.post('/analyze-audience', async (req: any, res) => {
  try {
    const { audienceData } = req.body;

    if (!audienceData) {
      return res.status(400).json({
        success: false,
        message: 'Dados de audiência são obrigatórios'
      });
    }

    const prompt = `Analise os seguintes dados de audiência e forneça insights:
    
    ${JSON.stringify(audienceData, null, 2)}
    
    Forneça análise sobre:
    1. Perfil demográfico
    2. Padrões de comportamento
    3. Horários de maior engajamento
    4. Preferências de conteúdo
    5. Recomendações de segmentação`;

    const response = await getAIService().processRequest({
      prompt,
      maxTokens: 1000,
      temperature: 0.6
    }, req.user.id);

    return res.json({
      success: true,
      data: { analysis: response.response }
    });

  } catch (error: any) {
    await logError('Erro ao analisar audiência com IA', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao analisar audiência',
      error: error.message
    });
  }
});

/**
 * @route GET /api/ai/models
 * @desc Lista modelos disponíveis
 * @access Private (Admin, Manager)
 */
router.get('/models', authorizeRole(['admin', 'gerente_marketing']) as any, async (_req, res) => {
  try {
    const models = {
      ollama: [
        'llama2',
        'llama2:13b',
        'llama2:70b',
        'codellama',
        'mistral',
        'neural-chat',
        'starling-lm',
        'orca-mini'
      ],
      openai: [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4-turbo-preview'
      ],
      anthropic: [
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
      ]
    };

    return res.json({
      success: true,
      data: models
    });

  } catch (error: any) {
    await logError('Erro ao listar modelos de IA', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/ai/test
 * @desc Testa conexão com IA
 * @access Private (Admin, Manager)
 */
router.post('/test', authorizeRole(['admin', 'gerente_marketing']) as any, async (req: any, res) => {
  try {
    const testPrompt = 'Responda apenas "OK" se você está funcionando corretamente.';

    const response = await getAIService().processRequest({
      prompt: testPrompt,
      maxTokens: 10,
      temperature: 0
    }, req.user?.id || 0);

    res.json({
      success: true,
      message: 'Teste de IA realizado com sucesso',
      data: {
        response: response.response,
        processingTime: response.processingTime,
        tokensUsed: response.tokensUsed,
        cost: response.cost
      }
    });

  } catch (error: any) {
    await logError('Erro no teste de IA', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro no teste de IA',
      error: error.message
    });
  }
});

export default router;

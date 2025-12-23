/**
 * Swagger Enhanced Documentation - Smart Signage Pro v3.1
 * Documentação completa da API usando OpenAPI 3.0
 */

export const swaggerDocumentation = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Signage Pro v3.1 - API',
    version: '3.1.0',
    description: `
      API REST completa do Smart Signage Pro v3.1
      
      ## Autenticação
      Todas as rotas (exceto /api/auth/login) requerem autenticação via Bearer Token JWT.
      
      ## Permissões
      - **admin**: Acesso total ao sistema
      - **admin_sql**: Acesso administrativo com permissões SQL
      - **gerente_marketing**: Gerenciamento de campanhas e conteúdo
      - **editoracao**: Edição de conteúdo e playlists
      - **visualizador**: Apenas visualização de dados
      
      ## Rate Limiting
      - 100 requisições por minuto por IP
      - 1000 requisições por hora por usuário autenticado
    `,
    contact: {
      name: 'Smart Signage Solutions',
      email: 'support@smartsignage.pro'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'API Base'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Servidor de Desenvolvimento'
    }
  ],
  tags: [
    { name: 'Auth', description: 'Autenticação e autorização' },
    { name: 'Users', description: 'Gerenciamento de usuários' },
    { name: 'Clients', description: 'Gerenciamento de clientes' },
    { name: 'Media', description: 'Upload e gerenciamento de mídia' },
    { name: 'Playlists', description: 'Gerenciamento de playlists' },
    { name: 'Campaigns', description: 'Gerenciamento de campanhas' },
    { name: 'Totems', description: 'Gerenciamento de totens' },
    { name: 'Analytics', description: 'Analytics e relatórios' },
    { name: 'SmartDisplayFX', description: 'Sistema SmartDisplayFX avançado' },
    { name: 'Dashboard', description: 'Dashboards customizáveis' },
    { name: 'Webhooks', description: 'Webhooks configuráveis' },
    { name: 'Billing', description: 'Faturamento e assinaturas' },
    { name: 'Reports', description: 'Geração de relatórios' },
    { name: 'PlaylistMix', description: 'Mixagem inteligente de playlists para totens' }
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login de usuário',
        description: 'Autentica um usuário e retorna token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', format: 'password', example: 'password123' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login bem-sucedido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        name: { type: 'string' },
                        role: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Credenciais inválidas' }
        }
      }
    },
    '/smartdisplayfx/analytics/overview': {
      get: {
        tags: ['SmartDisplayFX', 'Analytics'],
        summary: 'Obter overview de analytics FX',
        description: 'Retorna visão geral completa de analytics do SmartDisplayFX',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'site_id',
            in: 'query',
            schema: { type: 'string' },
            description: 'ID do site (opcional)'
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Data inicial (ISO 8601)'
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Data final (ISO 8601)'
          }
        ],
        responses: {
          '200': {
            description: 'Overview de analytics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FxAnalyticsOverview'
                }
              }
            }
          }
        }
      }
    },
    '/smartdisplayfx/analytics/compare': {
      get: {
        tags: ['SmartDisplayFX', 'Analytics'],
        summary: 'Comparar períodos de analytics',
        description: 'Compara analytics entre dois períodos diferentes',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'site_id',
            in: 'query',
            schema: { type: 'string' },
            description: 'ID do site (opcional)'
          },
          {
            name: 'currentStartDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'currentEndDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'previousStartDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'previousEndDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          '200': {
            description: 'Comparação de períodos',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FxPeriodComparison'
                }
              }
            }
          }
        }
      }
    },
    '/dashboard-layouts': {
      get: {
        tags: ['Dashboard'],
        summary: 'Listar layouts de dashboard',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de layouts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DashboardLayout' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Dashboard'],
        summary: 'Criar layout de dashboard',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'layoutData'],
                properties: {
                  name: { type: 'string' },
                  layoutData: { type: 'object' },
                  isDefault: { type: 'boolean' },
                  isShared: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Layout criado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/DashboardLayout' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'Listar webhooks',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Webhook' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Criar webhook',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'url', 'event_type'],
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  event_type: { type: 'string' },
                  secret: { type: 'string' },
                  is_active: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Webhook criado'
          }
        }
      }
    },
    '/playlist-mix/rules': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Listar regras de mixagem',
        description: 'Retorna todas as regras de mixagem de playlists',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'totemId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'ID do totem para filtrar regras'
          }
        ],
        responses: {
          '200': {
            description: 'Lista de regras',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MixRule' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['PlaylistMix'],
        summary: 'Criar regra de mixagem',
        description: 'Cria uma nova regra de mixagem de playlists',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateMixRuleRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Regra criada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/MixRule' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/playlist-mix/rules/{id}': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Obter regra de mixagem por ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Regra encontrada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/MixRule' }
                  }
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['PlaylistMix'],
        summary: 'Atualizar regra de mixagem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateMixRuleRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Regra atualizada'
          }
        }
      },
      delete: {
        tags: ['PlaylistMix'],
        summary: 'Excluir regra de mixagem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Regra excluída'
          }
        }
      }
    },
    '/playlist-mix/context/{totemId}': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Obter contexto de IA do totem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'totemId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Contexto de IA',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/AIContext' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['PlaylistMix'],
        summary: 'Atualizar contexto de IA do totem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'totemId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateAIContextRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Contexto atualizado'
          }
        }
      }
    },
    '/playlist-mix/history': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Obter histórico de mixagens',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'totemId',
            in: 'query',
            schema: { type: 'integer' }
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 }
          },
          {
            name: 'strategy',
            in: 'query',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Histórico de mixagens',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MixHistory' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/playlist-mix/overview': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Obter overview de mixagens por grupo',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'publisherId',
            in: 'query',
            schema: { type: 'integer' }
          },
          {
            name: 'localId',
            in: 'query',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Overview de mixagens',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/MixGroupOverview' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/playlist-mix/analytics': {
      get: {
        tags: ['PlaylistMix'],
        summary: 'Obter analytics de mixagens',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'totemId',
            in: 'query',
            schema: { type: 'integer' }
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          '200': {
            description: 'Analytics de mixagens',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/MixAnalytics' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/totems/{id}/playlist/mix': {
      get: {
        tags: ['Totems', 'PlaylistMix'],
        summary: 'Obter mixagem atual do totem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Mixagem atual',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/TotemPlaylistMix' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/totems/{id}/playlist/mix/generate': {
      post: {
        tags: ['Totems', 'PlaylistMix'],
        summary: 'Gerar nova mixagem para o totem',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Mixagem gerada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/TotemPlaylistMix' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtido no endpoint /api/auth/login'
      }
    },
    schemas: {
      FxAnalyticsOverview: {
        type: 'object',
        properties: {
          totalExecutions: { type: 'integer' },
          successful: { type: 'integer' },
          failed: { type: 'integer' },
          successRate: { type: 'number' },
          avgFps: { type: 'number' },
          avgDuration: { type: 'number' },
          topEffects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                effect_id: { type: 'string' },
                executions: { type: 'integer' },
                avg_fps: { type: 'number' },
                avg_duration: { type: 'number' },
                success_rate: { type: 'number' }
              }
            }
          },
          topTotems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                totem_id: { type: 'integer' },
                name: { type: 'string' },
                executions: { type: 'integer' },
                avg_fps: { type: 'number' },
                success_rate: { type: 'number' }
              }
            }
          },
          trends: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                executions: { type: 'integer' },
                avg_fps: { type: 'number' },
                success_rate: { type: 'number' }
              }
            }
          }
        }
      },
      FxPeriodComparison: {
        type: 'object',
        properties: {
          current: { $ref: '#/components/schemas/FxAnalyticsOverview' },
          previous: { $ref: '#/components/schemas/FxAnalyticsOverview' },
          changes: {
            type: 'object',
            properties: {
              totalExecutions: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              successful: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              failed: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              successRate: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              avgFps: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              },
              avgDuration: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  percentage: { type: 'number' }
                }
              }
            }
          }
        }
      },
      DashboardLayout: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          name: { type: 'string' },
          layoutData: {
            type: 'object',
            properties: {
              widgets: {
                type: 'array',
                items: { type: 'object' }
              },
              gridColumns: { type: 'integer' },
              gridRows: { type: 'integer' }
            }
          },
          isDefault: { type: 'boolean' },
          isShared: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          event_type: { type: 'string' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      CreateUser: {
        type: 'object',
        required: ['username', 'password', 'name', 'role'],
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
          name: { type: 'string' },
          role: {
            type: 'string',
            enum: ['admin', 'admin_sql', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client']
          },
          clientId: { type: 'integer' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      },
      MixRule: {
        type: 'object',
        properties: {
          rule_id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          totem_id: { type: 'integer', nullable: true },
          rule_type: { type: 'string', enum: ['systematic', 'ai', 'hybrid'] },
          priority_weight: { type: 'number' },
          time_weight: { type: 'number' },
          tag_weight: { type: 'number' },
          subscriber_weight: { type: 'number' },
          ai_enabled: { type: 'boolean' },
          ai_provider: { type: 'string' },
          ai_model: { type: 'string' },
          use_pedestrian_detection: { type: 'boolean' },
          use_sentiment_analysis: { type: 'boolean' },
          use_context_awareness: { type: 'boolean' },
          use_historical_optimization: { type: 'boolean' },
          max_items_per_playlist: { type: 'integer' },
          rotation_strategy: { type: 'string', enum: ['round_robin', 'priority', 'weighted', 'ai_optimized'] },
          shuffle_enabled: { type: 'boolean' },
          is_active: { type: 'boolean' },
          is_default: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      CreateMixRuleRequest: {
        type: 'object',
        required: ['name', 'rule_type'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          totem_id: { type: 'integer', nullable: true },
          rule_type: { type: 'string', enum: ['systematic', 'ai', 'hybrid'] },
          priority_weight: { type: 'number', default: 1.0 },
          time_weight: { type: 'number', default: 1.0 },
          tag_weight: { type: 'number', default: 0.5 },
          subscriber_weight: { type: 'number', default: 0.5 },
          ai_enabled: { type: 'boolean', default: false },
          ai_provider: { type: 'string' },
          ai_model: { type: 'string' },
          use_pedestrian_detection: { type: 'boolean', default: false },
          use_sentiment_analysis: { type: 'boolean', default: false },
          use_context_awareness: { type: 'boolean', default: false },
          use_historical_optimization: { type: 'boolean', default: false },
          max_items_per_playlist: { type: 'integer', default: 50 },
          rotation_strategy: { type: 'string', enum: ['round_robin', 'priority', 'weighted', 'ai_optimized'] },
          shuffle_enabled: { type: 'boolean', default: false },
          is_active: { type: 'boolean', default: true },
          is_default: { type: 'boolean', default: false }
        }
      },
      UpdateMixRuleRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          totem_id: { type: 'integer', nullable: true },
          rule_type: { type: 'string', enum: ['systematic', 'ai', 'hybrid'] },
          priority_weight: { type: 'number' },
          time_weight: { type: 'number' },
          tag_weight: { type: 'number' },
          subscriber_weight: { type: 'number' },
          ai_enabled: { type: 'boolean' },
          ai_provider: { type: 'string' },
          ai_model: { type: 'string' },
          use_pedestrian_detection: { type: 'boolean' },
          use_sentiment_analysis: { type: 'boolean' },
          use_context_awareness: { type: 'boolean' },
          use_historical_optimization: { type: 'boolean' },
          max_items_per_playlist: { type: 'integer' },
          rotation_strategy: { type: 'string', enum: ['round_robin', 'priority', 'weighted', 'ai_optimized'] },
          shuffle_enabled: { type: 'boolean' },
          is_active: { type: 'boolean' },
          is_default: { type: 'boolean' }
        }
      },
      AIContext: {
        type: 'object',
        properties: {
          context_id: { type: 'integer' },
          totem_id: { type: 'integer' },
          pedestrian_count: { type: 'integer' },
          pedestrian_density: { type: 'string', enum: ['low', 'medium', 'high'] },
          pedestrian_demographics: { type: 'object' },
          sentiment_score: { type: 'number' },
          sentiment_label: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          emotion_tags: {
            type: 'array',
            items: { type: 'string' }
          },
          time_of_day: { type: 'string' },
          day_type: { type: 'string' },
          weather_context: { type: 'object' },
          event_context: { type: 'object' },
          performance_metrics: { type: 'object' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      UpdateAIContextRequest: {
        type: 'object',
        properties: {
          pedestrian_count: { type: 'integer' },
          pedestrian_density: { type: 'string', enum: ['low', 'medium', 'high'] },
          pedestrian_demographics: { type: 'object' },
          sentiment_score: { type: 'number' },
          sentiment_label: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          emotion_tags: {
            type: 'array',
            items: { type: 'string' }
          },
          time_of_day: { type: 'string' },
          day_type: { type: 'string' },
          weather_context: { type: 'object' },
          event_context: { type: 'object' },
          performance_metrics: { type: 'object' }
        }
      },
      MixItem: {
        type: 'object',
        properties: {
          media_id: { type: 'integer' },
          playlist_id: { type: 'integer' },
          campaign_id: { type: 'integer' },
          subscriber_id: { type: 'integer' },
          order_index: { type: 'integer' },
          weight: { type: 'number' },
          source: { type: 'string', enum: ['campaign', 'playlist'] },
          priority: { type: 'integer' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          duration: { type: 'number' }
        }
      },
      TotemPlaylistMix: {
        type: 'object',
        properties: {
          mix_id: { type: 'integer' },
          totem_id: { type: 'integer' },
          rule_id: { type: 'integer', nullable: true },
          mix_version: { type: 'integer' },
          mix_items: {
            type: 'array',
            items: { $ref: '#/components/schemas/MixItem' }
          },
          total_items: { type: 'integer' },
          total_duration: { type: 'number' },
          mix_strategy: { type: 'string' },
          context_snapshot: { type: 'object' },
          is_active: { type: 'boolean' },
          is_current: { type: 'boolean' },
          generated_at: { type: 'string', format: 'date-time' },
          applied_at: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      MixHistory: {
        type: 'object',
        properties: {
          history_id: { type: 'integer' },
          mix_id: { type: 'integer' },
          totem_id: { type: 'integer' },
          rule_id: { type: 'integer', nullable: true },
          mix_version: { type: 'integer' },
          mix_strategy: { type: 'string' },
          total_items: { type: 'integer' },
          total_duration: { type: 'number' },
          engagement_score: { type: 'number' },
          executions: { type: 'integer' },
          generated_at: { type: 'string', format: 'date-time' },
          applied_at: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      MixGroupOverview: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              totalGroups: { type: 'integer' },
              totalTotems: { type: 'integer' },
              totalTvs: { type: 'integer' }
            }
          },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                publisher_id: { type: 'integer' },
                publisher_name: { type: 'string' },
                local_id: { type: 'integer', nullable: true },
                local_name: { type: 'string', nullable: true },
                totem_count: { type: 'integer' },
                tv_count: { type: 'integer' },
                campaigns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      campaign_id: { type: 'integer' },
                      campaign_name: { type: 'string' },
                      time_share_percent: { type: 'number' },
                      total_items: { type: 'integer' },
                      total_duration: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      MixAnalytics: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              totalMixes: { type: 'integer' },
              averageEngagement: { type: 'number' },
              totalExecutions: { type: 'integer' }
            }
          },
          byStrategy: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                strategy: { type: 'string' },
                count: { type: 'integer' },
                avgEngagement: { type: 'number' },
                totalExecutions: { type: 'integer' }
              }
            }
          },
          trends: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                executions: { type: 'integer' },
                avgEngagement: { type: 'number' }
              }
            }
          },
          topMixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mix_id: { type: 'integer' },
                totem_id: { type: 'integer' },
                strategy: { type: 'string' },
                engagement_score: { type: 'number' },
                executions: { type: 'integer' }
              }
            }
          },
          totemPerformance: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                totem_id: { type: 'integer' },
                totem_name: { type: 'string' },
                avgEngagement: { type: 'number' },
                totalExecutions: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }]
};


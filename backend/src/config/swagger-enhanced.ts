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
    { name: 'Reports', description: 'Geração de relatórios' }
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
      }
    }
  },
  security: [{ bearerAuth: [] }]
};


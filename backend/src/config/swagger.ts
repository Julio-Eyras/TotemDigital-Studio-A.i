export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Signage Pro v2.0 - API',
    version: '2.0.0',
    description: 'API REST do Smart Signage Pro v2.0',
  },
  servers: [{ url: '/api', description: 'API Base' }],
  paths: {
    '/health': { get: { summary: 'Health check', responses: { '200': { description: 'OK' } } } },

    // Users
    '/users': {
      get: {
        summary: 'Listar usuários',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'role', schema: { type: 'string', enum: ['admin','user','client'] } },
          { in: 'query', name: 'clientId', schema: { type: 'integer', minimum: 1 } },
        ],
        responses: { '200': { description: 'OK' } },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar usuário',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUser' } } }
        },
        responses: { '201': { description: 'Criado' }, '400': { description: 'Erro de validação' } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/users/{id}': {
      get: {
        summary: 'Obter usuário',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Não encontrado' } },
        security: [{ bearerAuth: [] }]
      },
      put: {
        summary: 'Atualizar usuário',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUser' } } } },
        responses: { '200': { description: 'OK' }, '400': { description: 'Erro de validação' } },
        security: [{ bearerAuth: [] }]
      },
      delete: {
        summary: 'Excluir usuário',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { '204': { description: 'Sem conteúdo' } },
        security: [{ bearerAuth: [] }]
      }
    },

    // Media
    '/media': {
      get: {
        summary: 'Listar mídias',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'limit', schema: { type: 'integer' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'type', schema: { type: 'string', enum: ['image','video','audio'] } },
          { in: 'query', name: 'clientId', schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'OK' } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/media/upload': {
      post: {
        summary: 'Upload de mídia',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, name: { type: 'string' }, description: { type: 'string' }, tags: { type: 'string' }, clientId: { type: 'integer' } }, required: ['file'] }, examples: { imagemJpg: { summary: 'Imagem JPG', value: { name: 'banner_loja', description: 'Banner promocional', tags: 'promo,blackfriday', clientId: 1 } }, videoMp4: { summary: 'Vídeo MP4', value: { name: 'video_oferta', clientId: 2 } } } } }
        },
        responses: {
          '201': {
            description: 'Criado',
            content: {
              'application/json': {
                examples: {
                  sucesso: {
                    summary: 'Upload bem-sucedido',
                    value: { id: 101, name: 'banner_loja', mediaType: 'image', filePath: '/assets/uploads/c1/banner_loja.jpg', sizeBytes: 345678, status: 'draft', createdAt: '2025-10-29T12:00:00Z' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Erro na validação/arquivo',
            content: { 'application/json': { examples: { tipoNaoPermitido: { value: { error: 'Tipo de arquivo não permitido' } }, semArquivo: { value: { error: 'Nenhum arquivo enviado' } } } } }
          }
        },
        security: [{ bearerAuth: [] }]
      }
    },
    '/media/{id}': {
      get: { summary: 'Obter mídia', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      put: { summary: 'Atualizar mídia', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateMedia' } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir mídia', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] }
    },

    // Playlists
    '/playlists': {
      get: {
        summary: 'Listar playlists',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'limit', schema: { type: 'integer' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'clientId', schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'OK' } },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar playlist',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePlaylist' } } } },
        responses: { '201': { description: 'Criado' } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/playlists/{id}': {
      get: { summary: 'Obter playlist', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      put: { summary: 'Atualizar playlist', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePlaylist' } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir playlist', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '204': { description: 'Sem conteúdo' } }, security: [{ bearerAuth: [] }] }
    },

    // Campaigns
    '/campaigns': {
      get: {
        summary: 'Listar campanhas',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'limit', schema: { type: 'integer' } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['draft','active','paused','finished'] } },
          { in: 'query', name: 'clientId', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                examples: {
                  lista: { value: { page: 1, limit: 20, total: 2, campaigns: [ { id: 10, title: 'Campanha Natal', clientId: 1, status: 'active', isActive: true }, { id: 11, title: 'Liquidação', clientId: 1, status: 'draft', isActive: false } ] } }
                }
              }
            }
          }
        },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar campanha',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCampaign' },
              examples: {
                simples: {
                  value: { clientId: 1, title: 'Campanha Verão', description: 'Promoções de verão', campaignType: 'general', startDate: '2025-12-01', endDate: '2026-01-15', isActive: true }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Criado', content: { 'application/json': { examples: { criado: { value: { id: 12, title: 'Campanha Verão', status: 'draft', isActive: true } } } } } },
          '400': { description: 'Erro de validação', content: { 'application/json': { examples: { clienteInvalido: { value: { success: false, message: 'Cliente não encontrado ou inativo' } } } } } }
        },
        security: [{ bearerAuth: [] }]
      }
    },
    '/campaigns/{id}': {
      get: {
        summary: 'Obter campanha',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { id: 10, title: 'Campanha Natal', clientId: 1, status: 'active' } } } } } },
          '404': { description: 'Não encontrado', content: { 'application/json': { examples: { naoEncontrado: { value: { success: false, message: 'Campanha não encontrada' } } } } } },
          '403': { description: 'Acesso negado', content: { 'application/json': { examples: { proibido: { value: { success: false, message: 'Acesso negado: Você só pode ver suas próprias campanhas' } } } } } }
        },
        security: [{ bearerAuth: [] }]
      },
      put: {
        summary: 'Atualizar campanha',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCampaign' }, examples: { alterarStatus: { value: { status: 'active' } } } } } },
        responses: { '200': { description: 'OK' }, '400': { description: 'Erro de validação' }, '404': { description: 'Não encontrado' } },
        security: [{ bearerAuth: [] }]
      },
      delete: { summary: 'Excluir campanha', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '400': { description: 'Não permitido com vínculos' } }, security: [{ bearerAuth: [] }] }
    },

    // QR Codes
    '/qrcodes': {
      get: {
        summary: 'Listar QR Codes',
        parameters: [ { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }, { in: 'query', name: 'qrType', schema: { type: 'string', enum: ['url','text','wifi'] } }, { in: 'query', name: 'clientId', schema: { type: 'integer' } } ],
        responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: { page: 1, limit: 20, total: 1, qrcodes: [ { id: 301, clientId: 1, qrType: 'url', content: 'https://exemplo.com/promo', isActive: true, scans: 27 } ] } } } } } } },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar QR Code',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateQRCode' }, examples: { url: { value: { clientId: 1, qrType: 'url', content: 'https://minha.loja/promo' } }, texto: { value: { clientId: 1, qrType: 'text', content: 'APRESENTE ESTE QR NA LOJA' } } } } } },
        responses: { '201': { description: 'Criado', content: { 'application/json': { examples: { criado: { value: { id: 302, clientId: 1, qrType: 'url', content: 'https://minha.loja/promo', isActive: true } } } } } }, '400': { description: 'Erro de validação' } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/qrcodes/{id}': {
      get: { summary: 'Obter QR Code', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { id: 301, clientId: 1, qrType: 'url', content: 'https://exemplo.com/promo', isActive: true } } } } } }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      put: { summary: 'Atualizar QR Code', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateQRCode' }, examples: { desativar: { value: { isActive: false } } } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir QR Code', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '400': { description: 'Não permitido' } }, security: [{ bearerAuth: [] }] }
    },
    '/qrcodes/{id}/scan': {
      post: {
        summary: 'Registrar scan (público)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { location: { type: 'string' }, deviceInfo: { type: 'object' } } } } } },
        responses: { '200': { description: 'Scan registrado', content: { 'application/json': { examples: { redirect: { value: { success: true, redirectUrl: 'https://exemplo.com/promo' } }, conteudo: { value: { success: true, content: 'APRESENTE NA LOJA', qrType: 'text' } } } } } }, '404': { description: 'QR Code não encontrado' } }
      }
    },

    // Billing
    '/billing': {
      get: {
        summary: 'Listar faturas',
        parameters: [ { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }, { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending','paid','cancelled','overdue'] } } ],
        responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: { page: 1, limit: 20, total: 1, billings: [ { id: 501, clientId: 1, amount: 1200.5, status: 'pending', dueDate: '2025-11-10' } ] } } } } } } },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar fatura',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBilling' }, examples: { nova: { value: { clientId: 1, amount: 899.9, dueDate: '2025-12-05', description: 'Plano anual' } } } } } },
        responses: { '201': { description: 'Criado', content: { 'application/json': { examples: { criado: { value: { id: 502, clientId: 1, amount: 899.9, status: 'pending' } } } } } }, '400': { description: 'Erro de validação' } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/billing/{id}': {
      get: { summary: 'Obter fatura', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { id: 501, clientId: 1, amount: 1200.5, status: 'pending', dueDate: '2025-11-10' } } } } } }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      put: { summary: 'Atualizar fatura', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateBilling' }, examples: { marcarPago: { value: { status: 'paid', notes: 'PIX confirmado' } } } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir fatura', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] }
    },
    '/billing/{id}/payment': {
      post: {
        summary: 'Registrar pagamento',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number' }, method: { type: 'string', enum: ['pix','credit_card','boleto'] }, paidAt: { type: 'string', format: 'date-time' }, transactionId: { type: 'string' } }, required: ['amount','method'] }, examples: { pix: { value: { amount: 1200.5, method: 'pix', transactionId: 'TX123', paidAt: '2025-11-02T12:34:00Z' } } } } } },
        responses: { '201': { description: 'Pagamento registrado', content: { 'application/json': { examples: { ok: { value: { id: 9001, billingId: 501, amount: 1200.5, method: 'pix', status: 'confirmed' } } } } } }, '400': { description: 'Erro de validação' }, '403': { description: 'Acesso negado' }, '404': { description: 'Fatura não encontrada' } },
        security: [{ bearerAuth: [] }]
      }
    },

    // Reports
    '/reports': {
      get: { summary: 'Listar relatórios', parameters: [{ in: 'query', name: 'page', schema: { type: 'integer' } },{ in: 'query', name: 'limit', schema: { type: 'integer' } }, { in: 'query', name: 'type', schema: { type: 'string', enum: ['client','totem','media','campaign','custom','billing','analytics'] } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: { page: 1, limit: 20, total: 1, reports: [ { id: 700, type: 'analytics', title: 'Relatório Semanal', status: 'completed', format: 'pdf' } ] } } } } } } }, security: [{ bearerAuth: [] }] },
      post: { summary: 'Gerar relatório', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReport' }, examples: { analytics: { value: { type: 'analytics', title: 'Relatório Mensal', filters: { clientId: 1, startDate: '2025-10-01', endDate: '2025-10-31' }, format: 'pdf' } } } } } }, responses: { '201': { description: 'Criado', content: { 'application/json': { examples: { criado: { value: { id: 701, type: 'analytics', title: 'Relatório Mensal', status: 'processing', format: 'pdf' } } } } } }, '400': { description: 'Erro de validação' } }, security: [{ bearerAuth: [] }] }
    },
    '/reports/{id}': {
      get: { summary: 'Obter relatório', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { id: 700, type: 'analytics', title: 'Relatório Semanal', status: 'completed', filePath: '/assets/reports/700.pdf', format: 'pdf' } } } } } }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir relatório', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] }
    },
    '/reports/download/{id}': {
      get: { summary: 'Download do relatório', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Arquivo' }, '400': { description: 'Ainda processando' }, '404': { description: 'Arquivo não encontrado' }, '410': { description: 'Relatório expirado' } }, security: [{ bearerAuth: [] }] }
    },

    // Analytics
    '/analytics/overview': { get: { summary: 'Analytics geral', responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },
    '/analytics/report': { get: { summary: 'Relatório de analytics', responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },

    // Settings
    '/settings': { get: { summary: 'Listar configurações', responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] }, put: { summary: 'Atualizar configurações', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },

    // Totems/Players
    '/players': {
      get: {
        summary: 'Listar players',
        parameters: [ { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }, { in: 'query', name: 'status', schema: { type: 'string', enum: ['online','offline','error'] } }, { in: 'query', name: 'clientId', schema: { type: 'integer' } } ],
        responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: { page: 1, limit: 10, total: 1, data: [ { totem_id: 1001, name: 'Totem Entrada', location: 'Loja 1', client_id: 1, status: 'online' } ] } } } } } },
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar player',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePlayer' }, examples: { basico: { value: { name: 'Totem Caixa', location: 'Loja 2', clientId: 1 } } } } } },
        responses: { '201': { description: 'Criado', content: { 'application/json': { examples: { criado: { value: { totem_id: 1002, name: 'Totem Caixa', location: 'Loja 2', status: 'offline' } } } } } } },
        security: [{ bearerAuth: [] }]
      }
    },
    '/players/{id}': {
      get: { summary: 'Obter player', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { totem_id: 1001, name: 'Totem Entrada', status: 'online', current_playlist_id: 55 } } } } } }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] },
      put: { summary: 'Atualizar player', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePlayer' }, examples: { ativar: { value: { isActive: true } } } } } }, responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] },
      delete: { summary: 'Excluir player', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '204': { description: 'Sem conteúdo' }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] }
    },
    '/players/{id}/playlist': {
      post: { summary: 'Atribuir playlist ao player', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { playlistId: { type: 'integer' } }, required: ['playlistId'] }, examples: { atribuir: { value: { playlistId: 55 } } } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { message: 'Playlist atribuída com sucesso' } } } } } }, '404': { description: 'Player/Playlist não encontrado' } }, security: [{ bearerAuth: [] }] }
    },
    '/players/{id}/status': {
      get: { summary: 'Status do player', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { ok: { value: { status: 'online', lastHeartbeat: '2025-10-29T12:00:00Z', currentPlaylist: { playlist_id: 55, name: 'Playlist Vitrine' } } } } } } }, '404': { description: 'Não encontrado' } }, security: [{ bearerAuth: [] }] }
    },
    '/totems': { get: { summary: 'Listar totems', parameters: [ { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } } ], responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: { page: 1, limit: 20, total: 1, totems: [ { id: 2001, identifier: 'TOTEM-XYZ', status: 'offline' } ] } } } } } } }, security: [{ bearerAuth: [] }] },
    '/totems/{id}/heartbeat': {
      post: {
        summary: 'Registrar heartbeat do totem',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['online','offline','error'] }, uptime: { type: 'integer' }, memoryUsage: { type: 'number' }, cpuUsage: { type: 'number' }, diskUsage: { type: 'number' }, temperature: { type: 'number' }, lastPlaylistUpdate: { type: 'string', format: 'date-time' } }, required: ['status'] }, examples: { ok: { value: { status: 'online', uptime: 86400, memoryUsage: 42.5, cpuUsage: 12.3 } } } } } },
        responses: { '200': { description: 'Registrado', content: { 'application/json': { examples: { ok: { value: { success: true, timestamp: '2025-10-29T12:00:00Z' } } } } } }, '400': { description: 'Erro de validação' }, '404': { description: 'Totem não encontrado' } },
        security: [{ bearerAuth: [] }]
      },
      get: {
        summary: 'Histórico de heartbeats',
        parameters: [ { in: 'path', name: 'id', required: true, schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 100 } } ],
        responses: { '200': { description: 'OK', content: { 'application/json': { examples: { lista: { value: [ { id: 1, status: 'online', ipAddress: '10.0.0.5', timestamp: '2025-10-29T11:59:00Z' }, { id: 2, status: 'online', ipAddress: '10.0.0.5', timestamp: '2025-10-29T11:58:00Z' } ] } } } } }, '404': { description: 'Totem não encontrado' } },
        security: [{ bearerAuth: [] }]
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      CreateUser: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin','user','client'] },
          clientId: { type: 'integer' }
        },
        required: ['username','password','name','role']
      },
      UpdateUser: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin','user','client'] },
          clientId: { type: 'integer' },
          isActive: { type: 'boolean' }
        }
      },
      UpdateMedia: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string' }
        }
      },
      CreatePlaylist: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          clientId: { type: 'integer' }
        },
        required: ['name']
      },
      UpdatePlaylist: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          clientId: { type: 'integer' },
          isActive: { type: 'boolean' }
        }
      },
      CreateCampaign: { type: 'object', properties: { clientId: { type: 'integer' }, title: { type: 'string' } }, required: ['clientId','title'] },
      UpdateCampaign: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string' }, isActive: { type: 'boolean' } } },
      CreateQRCode: { type: 'object', properties: { clientId: { type: 'integer' }, content: { type: 'string' }, qrType: { type: 'string' } }, required: ['clientId','content'] },
      UpdateQRCode: { type: 'object', properties: { content: { type: 'string' }, isActive: { type: 'boolean' } } },
      CreateBilling: { type: 'object', properties: { clientId: { type: 'integer' }, amount: { type: 'number' }, dueDate: { type: 'string', format: 'date-time' } }, required: ['clientId','amount','dueDate'] },
      UpdateBilling: { type: 'object', properties: { status: { type: 'string' }, notes: { type: 'string' } } },
      CreateReport: { type: 'object', properties: { type: { type: 'string' }, title: { type: 'string' }, filters: { type: 'object' }, format: { type: 'string' } }, required: ['type','title'] },
      CreatePlayer: { type: 'object', properties: { name: { type: 'string' }, location: { type: 'string' }, clientId: { type: 'integer' } }, required: ['name'] },
      UpdatePlayer: { type: 'object', properties: { name: { type: 'string' }, location: { type: 'string' }, clientId: { type: 'integer' }, isActive: { type: 'boolean' } } }
    }
  },
  security: [{ bearerAuth: [] }]
};



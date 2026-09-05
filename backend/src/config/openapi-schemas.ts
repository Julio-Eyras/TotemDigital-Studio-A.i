// OpenAPI 3.0 schemas canônicos — gerados a partir de TypeScript
// Usados por swagger.ts para ampliar a coleção de componentes/schemas
// 4 grupos: (1) Base/Shared, (2) Entities, (3) Requests/Responses Canônicos
//          (4) Específicos (Billing, Installation, FX/ACE, Dispatcher)

export const canonicalSchemas: Record<string, unknown> = {
  // ---------------- (1) Base / Shared ----------------
  BaseEntity: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'createdAt', 'updatedAt']
  },
  ClientEntity: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: { clientId: { type: 'integer' } },
        required: ['clientId']
      }
    ]
  },
  ActivatableEntity: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: { isActive: { type: 'boolean' } },
        required: ['isActive']
      }
    ]
  },
  FullEntity: {
    allOf: [
      { $ref: '#/components/schemas/ClientEntity' },
      { $ref: '#/components/schemas/ActivatableEntity' }
    ]
  },
  ApiResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {},
      error: { $ref: '#/components/schemas/ApiError' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['success']
  },
  ApiError: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      code: { type: 'string' },
      statusCode: { type: 'integer' },
      details: { type: 'object', additionalProperties: true },
      stack: { type: 'string' }
    },
    required: ['message']
  },
  PaginationParams: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 }
    }
  },
  CommonFilters: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      sortBy: { type: 'string' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' }
    }
  },
  QueryParams: {
    allOf: [
      { $ref: '#/components/schemas/PaginationParams' },
      { $ref: '#/components/schemas/CommonFilters' },
      {
        type: 'object',
        properties: {
          clientId: { type: 'integer' },
          userId: { type: 'integer' },
          status: { type: 'string' },
          type: { type: 'string' }
        }
      }
    ]
  },
  PaginatedResponse: {
    type: 'object',
    properties: {
      data: { type: 'array', items: {} },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' }
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
      }
    },
    required: ['data', 'pagination']
  },
  CreateResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {}
    },
    required: ['success', 'message', 'data']
  },
  UpdateResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {}
    },
    required: ['success', 'message', 'data']
  },
  DeleteResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' }
    },
    required: ['success', 'message']
  },
  ServiceResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {},
      error: { type: 'string' },
      message: { type: 'string' }
    },
    required: ['success']
  },
  DatabaseResult: {
    type: 'object',
    properties: {
      rows: { type: 'array', items: {} },
      rowCount: { type: 'integer' }
    },
    required: ['rows', 'rowCount']
  },

  // ---------------- (2) Entities ----------------
  User: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'admin_sql', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client'] },
          clientId: { type: 'integer' },
          isActive: { type: 'boolean' },
          lastLogin: { type: 'string', format: 'date-time' }
        },
        required: ['username', 'email', 'role', 'isActive']
      }
    ]
  },
  Client: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          contactName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { type: 'string' },
          isActive: { type: 'boolean' }
        },
        required: ['name', 'isActive']
      }
    ]
  },
  Totem: {
    allOf: [
      { $ref: '#/components/schemas/FullEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          identifier: { type: 'string' },
          deviceId: { type: 'string' },
          localId: { type: 'string' },
          location: { type: 'string' },
          status: { type: 'string', enum: ['online', 'offline', 'error', 'maintenance'] },
          lastHeartbeat: { type: 'string', format: 'date-time' }
        },
        required: ['identifier', 'status']
      }
    ]
  },
  Media: {
    allOf: [
      { $ref: '#/components/schemas/FullEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['image', 'video', 'audio', 'html', 'web', 'document'] },
          url: { type: 'string', format: 'uri' },
          thumbnailUrl: { type: 'string', format: 'uri' },
          duration: { type: 'number', minimum: 0 },
          size: { type: 'integer', minimum: 0 },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['name', 'type', 'url', 'size']
      }
    ]
  },
  PlaylistItem: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: {
          playlistId: { type: 'integer' },
          mediaId: { type: 'integer' },
          orderIndex: { type: 'integer', minimum: 0 },
          duration: { type: 'number', minimum: 0 }
        },
        required: ['playlistId', 'mediaId', 'orderIndex']
      }
    ]
  },
  Playlist: {
    allOf: [
      { $ref: '#/components/schemas/FullEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          totemId: { type: 'integer' },
          campaignId: { type: 'integer' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/PlaylistItem' }
          }
        },
        required: ['name']
      }
    ]
  },
  Campaign: {
    allOf: [
      { $ref: '#/components/schemas/FullEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed', 'cancelled'] },
          priority: { type: 'integer', minimum: 0, maximum: 100 },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['name', 'startDate', 'endDate', 'status']
      }
    ]
  },
  Report: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['playback', 'analytics', 'billing', 'system', 'custom'] },
          format: { type: 'string', enum: ['pdf', 'csv', 'excel', 'json'] },
          status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
          filePath: { type: 'string' },
          generatedAt: { type: 'string', format: 'date-time' },
          createdBy: { type: 'integer' },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['name', 'type', 'format', 'status', 'createdBy']
      }
    ]
  },
  AnalyticsData: {
    type: 'object',
    properties: {
      totalViews: { type: 'integer', minimum: 0 },
      totalPlays: { type: 'integer', minimum: 0 },
      averageDuration: { type: 'number', minimum: 0 },
      uniqueViewers: { type: 'integer', minimum: 0 },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' }
        },
        required: ['start', 'end']
      }
    },
    required: ['totalViews', 'totalPlays', 'averageDuration', 'uniqueViewers', 'dateRange']
  },

  // ---------------- (3) Requests / Responses Canônicos ----------------
  // Auth
  LoginRequest: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string' },
      password: { type: 'string', format: 'password' }
    }
  },
  RegisterRequest: {
    type: 'object',
    required: ['username', 'email', 'password', 'name', 'clientId'],
    properties: {
      username: { type: 'string' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password', minLength: 6 },
      name: { type: 'string' },
      clientId: { type: 'integer' }
    }
  },
  AuthResponseUser: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      username: { type: 'string' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { type: 'string' },
      clientId: { type: 'integer' },
      permissions: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  },
  AuthResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      token: { type: 'string' },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'integer', example: 86400 },
      user: { $ref: '#/components/schemas/AuthResponseUser' },
      refreshToken: { type: 'string' }
    },
    required: ['success', 'token', 'user']
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', format: 'password' },
      newPassword: { type: 'string', format: 'password', minLength: 6 }
    }
  },

  // Media
  CreateMediaRequest: {
    type: 'object',
    required: ['name', 'type', 'url', 'size'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['image', 'video', 'audio', 'html', 'web', 'document'] },
      url: { type: 'string', format: 'uri' },
      thumbnailUrl: { type: 'string', format: 'uri' },
      duration: { type: 'number', minimum: 0 },
      size: { type: 'integer', minimum: 0 },
      clientId: { type: 'integer' },
      tags: { type: 'array', items: { type: 'string' } },
      metadata: { type: 'object', additionalProperties: true }
    }
  },
  UpdateMediaRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      thumbnailUrl: { type: 'string', format: 'uri' },
      duration: { type: 'number', minimum: 0 },
      isActive: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      metadata: { type: 'object', additionalProperties: true }
    }
  },
  MediaResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/Media' },
      message: { type: 'string' }
    }
  },

  // Totem
  CreateTotemRequest: {
    type: 'object',
    required: ['identifier', 'clientId'],
    properties: {
      name: { type: 'string' },
      identifier: { type: 'string' },
      deviceId: { type: 'string' },
      localId: { type: 'string' },
      location: { type: 'string' },
      clientId: { type: 'integer' },
      status: { type: 'string', enum: ['online', 'offline', 'error', 'maintenance'], default: 'offline' }
    }
  },
  UpdateTotemRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      location: { type: 'string' },
      localId: { type: 'string' },
      isActive: { type: 'boolean' },
      status: { type: 'string', enum: ['online', 'offline', 'error', 'maintenance'] }
    }
  },
  TotemResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/Totem' },
      message: { type: 'string' }
    }
  },
  HeartbeatData: {
    type: 'object',
    properties: {
      totemId: { type: 'integer' },
      timestamp: { type: 'string', format: 'date-time' },
      status: { type: 'string', enum: ['online', 'error', 'maintenance'] },
      currentPlaylistId: { type: 'integer' },
      storageUsed: { type: 'number' },
      storageTotal: { type: 'number' },
      memoryUsed: { type: 'number' },
      memoryTotal: { type: 'number' },
      cpuUsage: { type: 'number', minimum: 0, maximum: 100 },
      temperature: { type: 'number' },
      networkLatency: { type: 'integer' }
    },
    required: ['totemId', 'timestamp', 'status']
  },

  // Playlist
  CreatePlaylistRequest: {
    type: 'object',
    required: ['name', 'clientId'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      clientId: { type: 'integer' },
      totemId: { type: 'integer' },
      campaignId: { type: 'integer' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['mediaId', 'orderIndex'],
          properties: {
            mediaId: { type: 'integer' },
            orderIndex: { type: 'integer', minimum: 0 },
            duration: { type: 'number', minimum: 0 }
          }
        }
      }
    }
  },
  UpdatePlaylistRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mediaId: { type: 'integer' },
            orderIndex: { type: 'integer', minimum: 0 },
            duration: { type: 'number', minimum: 0 }
          }
        }
      }
    }
  },
  PlaylistListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Playlist' }
          }
        },
        required: ['success']
      }
    ]
  },

  // Campaign
  CreateCampaignRequest: {
    type: 'object',
    required: ['name', 'startDate', 'endDate', 'clientId'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      clientId: { type: 'integer' },
      priority: { type: 'integer', minimum: 0, maximum: 100, default: 50 },
      totemIds: { type: 'array', items: { type: 'integer' } },
      playlistIds: { type: 'array', items: { type: 'integer' } }
    }
  },
  UpdateCampaignRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed', 'cancelled'] },
      priority: { type: 'integer', minimum: 0, maximum: 100 },
      isActive: { type: 'boolean' },
      totemIds: { type: 'array', items: { type: 'integer' } },
      playlistIds: { type: 'array', items: { type: 'integer' } }
    }
  },
  CampaignResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/Campaign' },
      message: { type: 'string' }
    }
  },

  // User
  CreateUserRequest: {
    type: 'object',
    required: ['username', 'email', 'password', 'name', 'role', 'clientId'],
    properties: {
      username: { type: 'string' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password', minLength: 6 },
      name: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'admin_sql', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client'] },
      clientId: { type: 'integer' }
    }
  },
  UpdateUserRequest: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'admin_sql', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client'] },
      isActive: { type: 'boolean' }
    }
  },
  UserListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' }
          }
        },
        required: ['success']
      }
    ]
  },

  // Billing
  CreateBillingRequest: {
    type: 'object',
    required: ['clientId', 'amount', 'billingType', 'dueDate'],
    properties: {
      clientId: { type: 'integer' },
      subscriberId: { type: 'integer' },
      publisherId: { type: 'integer' },
      amount: { type: 'number', minimum: 0 },
      billingType: { type: 'string', enum: ['subscription', 'revenue_share', 'one_time', 'overage'] },
      dueDate: { type: 'string', format: 'date' },
      description: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['description', 'amount'],
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number', default: 1 },
            unitPrice: { type: 'number' },
            amount: { type: 'number' }
          }
        }
      }
    }
  },
  UpdateBillingRequest: {
    type: 'object',
    properties: {
      amount: { type: 'number', minimum: 0 },
      dueDate: { type: 'string', format: 'date' },
      status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'cancelled', 'refunded'] },
      description: { type: 'string' }
    }
  },
  BillingResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          clientId: { type: 'integer' },
          subscriberId: { type: 'integer' },
          publisherId: { type: 'integer' },
          amount: { type: 'number' },
          billingType: { type: 'string' },
          status: { type: 'string' },
          dueDate: { type: 'string', format: 'date' },
          paidAt: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      message: { type: 'string' }
    }
  },
  PaymentRequest: {
    type: 'object',
    required: ['billingId', 'paymentMethod'],
    properties: {
      billingId: { type: 'integer' },
      paymentMethod: { type: 'string', enum: ['pix', 'credit_card', 'bank_slip', 'bank_transfer', 'stripe'] },
      amountPaid: { type: 'number', minimum: 0 },
      paidAt: { type: 'string', format: 'date-time' },
      transactionRef: { type: 'string' }
    }
  },
  PaymentResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          billingId: { type: 'integer' },
          paymentId: { type: 'string' },
          paymentMethod: { type: 'string' },
          amountPaid: { type: 'number' },
          paidAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['success', 'pending', 'failed'] },
          pixQrCode: { type: 'string' },
          pixCopyPaste: { type: 'string' },
          transactionRef: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  },

  // Publisher (direto do serviço)
  CreatePublisherRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      contactName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      whatsapp: { type: 'string' },
      categorySegment: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdatePublisherRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      contactName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      whatsapp: { type: 'string' },
      categorySegment: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },
  PublisherListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                contactName: { type: 'string' },
                email: { type: 'string', format: 'email' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // Subscriber
  CreateSubscriberRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      contactName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      whatsapp: { type: 'string' },
      address: { type: 'string' },
      categorySegment: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean', default: true },
      publisherId: { type: 'integer' }
    }
  },
  UpdateSubscriberRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      contactName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      whatsapp: { type: 'string' },
      address: { type: 'string' },
      categorySegment: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean' },
      publisherId: { type: 'integer' }
    }
  },
  SubscriberListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                publisherId: { type: 'integer' },
                name: { type: 'string' },
                contactName: { type: 'string' },
                email: { type: 'string', format: 'email' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // Player
  CreatePlayerRequest: {
    type: 'object',
    required: ['name', 'platform', 'totemId'],
    properties: {
      name: { type: 'string' },
      platform: { type: 'string', enum: ['android', 'linux', 'webos', 'electron', 'ios'] },
      version: { type: 'string' },
      totemId: { type: 'integer' },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdatePlayerRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },
  PlayerListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                platform: { type: 'string' },
                version: { type: 'string' },
                totemId: { type: 'integer' },
                lastSync: { type: 'string', format: 'date-time' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // Analytics / Reports
  AnalyticsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          totalViews: { type: 'integer' },
          totalPlays: { type: 'integer' },
          averageDuration: { type: 'number' },
          uniqueViewers: { type: 'integer' },
          byTotem: { type: 'array', items: {} },
          byMedia: { type: 'array', items: {} },
          byPeriod: { type: 'array', items: {} },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  },
  ReportRequest: {
    type: 'object',
    required: ['name', 'type', 'format'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['playback', 'analytics', 'billing', 'system', 'custom'] },
      format: { type: 'string', enum: ['pdf', 'csv', 'excel', 'json'] },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      filters: { type: 'object', additionalProperties: true }
    }
  },
  ReportResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/Report' },
      message: { type: 'string' }
    }
  },

  // Local
  CreateLocalRequest: {
    type: 'object',
    required: ['name', 'clientId'],
    properties: {
      name: { type: 'string' },
      clientId: { type: 'integer' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zipCode: { type: 'string' },
      country: { type: 'string', default: 'Brasil' },
      timezone: { type: 'string', default: 'America/Sao_Paulo' },
      isActive: { type: 'boolean', default: true },
      publisherId: { type: 'integer' }
    }
  },
  UpdateLocalRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zipCode: { type: 'string' },
      timezone: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },
  LocalListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                timezone: { type: 'string' },
                publisherId: { type: 'integer' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // Contracts (Publisher / Subscriber)
  CreateContractRequest: {
    type: 'object',
    required: ['title', 'startDate', 'endDate'],
    properties: {
      title: { type: 'string' },
      publisherId: { type: 'integer' },
      subscriberId: { type: 'integer' },
      clientId: { type: 'integer' },
      contractType: { type: 'string', enum: ['revenue_share', 'subscription', 'partnership', 'hybrid', 'advertising'] },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      totalAmount: { type: 'number', minimum: 0 },
      currency: { type: 'string', default: 'BRL' },
      planId: { type: 'integer' },
      revenueSharePercent: { type: 'number', minimum: 0, maximum: 100 },
      status: { type: 'string', enum: ['draft', 'active', 'expired', 'cancelled'] }
    }
  },
  UpdateContractRequest: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      endDate: { type: 'string', format: 'date' },
      totalAmount: { type: 'number', minimum: 0 },
      revenueSharePercent: { type: 'number', minimum: 0, maximum: 100 },
      status: { type: 'string', enum: ['draft', 'active', 'expired', 'cancelled'] }
    }
  },
  ContractListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                contractNumber: { type: 'string' },
                title: { type: 'string' },
                publisherId: { type: 'integer' },
                subscriberId: { type: 'integer' },
                contractType: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                totalAmount: { type: 'number' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // Plans / Subscriptions
  CreatePlanRequest: {
    type: 'object',
    required: ['name', 'price', 'billingCycle'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', default: 'BRL' },
      billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'semiannual', 'annual', 'weekly'] },
      trialDays: { type: 'integer', minimum: 0, default: 0 },
      maxTotems: { type: 'integer' },
      maxMediaGB: { type: 'integer' },
      features: {
        type: 'array',
        items: { type: 'string' }
      },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdatePlanRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      trialDays: { type: 'integer', minimum: 0 },
      maxTotems: { type: 'integer' },
      maxMediaGB: { type: 'integer' },
      features: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' }
    }
  },
  CreateSubscriptionRequest: {
    type: 'object',
    required: ['subscriberId', 'planId'],
    properties: {
      subscriberId: { type: 'integer' },
      planId: { type: 'integer' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      trialStart: { type: 'string', format: 'date' },
      trialEnd: { type: 'string', format: 'date' }
    }
  },
  UpdateSubscriptionRequest: {
    type: 'object',
    properties: {
      planId: { type: 'integer' },
      status: { type: 'string', enum: ['active', 'paused', 'cancelled', 'expired', 'trial'] },
      endDate: { type: 'string', format: 'date' }
    }
  },

  // Permissions / Roles
  CreatePermissionRequest: {
    type: 'object',
    required: ['name', 'resource'],
    properties: {
      name: { type: 'string' },
      resource: { type: 'string' },
      action: { type: 'string', enum: ['create', 'read', 'update', 'delete', 'manage', 'export'] },
      description: { type: 'string' }
    }
  },
  UpdatePermissionRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' }
    }
  },
  PermissionListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                resource: { type: 'string' },
                action: { type: 'string' },
                description: { type: 'string' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },
  CreateRoleRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateRoleRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' }
    }
  },
  RoleListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string' },
                permissionsCount: { type: 'integer' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // QR Code
  CreateQRCodeRequest: {
    type: 'object',
    required: ['name', 'content', 'clientId'],
    properties: {
      name: { type: 'string' },
      content: { type: 'string' },
      clientId: { type: 'integer' },
      totemId: { type: 'integer' },
      type: { type: 'string', enum: ['url', 'wifi', 'text', 'vcard', 'payment'], default: 'url' },
      size: { type: 'integer', default: 256 },
      foreground: { type: 'string', default: '#000000' },
      background: { type: 'string', default: '#FFFFFF' },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateQRCodeRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      content: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },
  QRCodeResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string' },
          imageUrl: { type: 'string', format: 'uri' },
          scans: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      message: { type: 'string' }
    }
  },

  // Settings
  UpdateSettingsRequest: {
    type: 'object',
    properties: {
      settings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['key', 'value'],
          properties: {
            key: { type: 'string' },
            value: { type: ['string', 'number', 'boolean', 'object'] },
            group: { type: 'string' }
          }
        }
      }
    }
  },
  SettingsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: true,
            description: { type: 'string' },
            group: { type: 'string' },
            type: { type: 'string' }
          }
        }
      }
    }
  },

  // SmartPlaylist
  SmartPlaylistRequest: {
    type: 'object',
    required: ['name', 'clientId'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      clientId: { type: 'integer' },
      strategy: { type: 'string', enum: ['age_gender', 'sentiment', 'time_window', 'weather', 'manual_rules', 'hybrid'], default: 'hybrid' },
      tagsRule: { type: 'array', items: { type: 'string' } },
      minAge: { type: 'integer' },
      maxAge: { type: 'integer' },
      genders: { type: 'array', items: { type: 'string', enum: ['male', 'female', 'other'] } },
      minSentiment: { type: 'number', minimum: -1, maximum: 1 },
      validDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
      startHour: { type: 'string', description: 'HH:MM' },
      endHour: { type: 'string', description: 'HH:MM' },
      isActive: { type: 'boolean', default: true }
    }
  },
  SmartPlaylistResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          strategy: { type: 'string' },
          matches: { type: 'integer' },
          playlistSnapshot: { type: 'array', items: { type: 'integer' } },
          lastEvaluatedAt: { type: 'string', format: 'date-time' }
        }
      },
      message: { type: 'string' }
    }
  },

  // AI / Facial Recognition
  AIRequest: {
    type: 'object',
    required: ['prompt', 'provider'],
    properties: {
      prompt: { type: 'string' },
      provider: { type: 'string', enum: ['openai', 'anthropic', 'gemini', 'ollama', 'local'] },
      model: { type: 'string' },
      context: { type: 'object', additionalProperties: true },
      maxTokens: { type: 'integer', default: 1024 },
      temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 }
    }
  },
  AIResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          usage: {
            type: 'object',
            properties: {
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' }
            }
          },
          provider: { type: 'string' },
          model: { type: 'string' }
        }
      },
      message: { type: 'string' }
    }
  },
  AIConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      defaultProvider: { type: 'string' },
      providers: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', format: 'uri' },
            defaultModel: { type: 'string' }
          }
        }
      }
    }
  },
  FacialMatchRequest: {
    type: 'object',
    required: ['referenceImage', 'probeImage'],
    properties: {
      referenceImage: { type: 'string', format: 'uri' },
      probeImage: { type: 'string', format: 'uri' },
      threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.6 },
      detectFaces: { type: 'boolean', default: true }
    }
  },
  FacialMatchResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          match: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          facesDetected: { type: 'integer' },
          landmarks: { type: 'array', items: {} },
          embedding: { type: 'array', items: { type: 'number' } }
        }
      },
      message: { type: 'string' }
    }
  },

  // Publisher Billing + Subscriber Billing (específicos)
  CreatePublisherBillingRequest: {
    type: 'object',
    required: ['publisherId', 'periodStart', 'periodEnd', 'grossRevenue'],
    properties: {
      publisherId: { type: 'integer' },
      periodStart: { type: 'string', format: 'date' },
      periodEnd: { type: 'string', format: 'date' },
      grossRevenue: { type: 'number', minimum: 0 },
      platformFeePercent: { type: 'number', minimum: 0, maximum: 100, default: 20 },
      taxRatePercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
      deductions: { type: 'array', items: { type: 'object' } },
      notes: { type: 'string' }
    }
  },
  UpdatePublisherBillingRequest: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'issued', 'paid', 'overdue', 'cancelled'] },
      paidAt: { type: 'string', format: 'date-time' },
      notes: { type: 'string' }
    }
  },
  PublisherBillingResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          publisherId: { type: 'integer' },
          periodStart: { type: 'string', format: 'date' },
          periodEnd: { type: 'string', format: 'date' },
          grossRevenue: { type: 'number' },
          platformFee: { type: 'number' },
          taxes: { type: 'number' },
          netAmount: { type: 'number' },
          status: { type: 'string' },
          invoiceNumber: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  CreateSubscriberBillingRequest: {
    type: 'object',
    required: ['subscriberId', 'planSnapshot', 'billingPeriodStart', 'billingPeriodEnd'],
    properties: {
      subscriberId: { type: 'integer' },
      subscriptionId: { type: 'integer' },
      planSnapshot: { type: 'object', additionalProperties: true },
      billingPeriodStart: { type: 'string', format: 'date' },
      billingPeriodEnd: { type: 'string', format: 'date' },
      baseAmount: { type: 'number', minimum: 0 },
      overageTotems: { type: 'integer', default: 0 },
      overageAmount: { type: 'number', default: 0 },
      taxRatePercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
      dueDate: { type: 'string', format: 'date' },
      notes: { type: 'string' }
    }
  },
  UpdateSubscriberBillingRequest: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'cancelled', 'refunded'] },
      paidAt: { type: 'string', format: 'date-time' },
      paymentMethod: { type: 'string' }
    }
  },
  SubscriberBillingResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          subscriberId: { type: 'integer' },
          subscriptionId: { type: 'integer' },
          invoiceNumber: { type: 'string' },
          billingPeriodStart: { type: 'string', format: 'date' },
          billingPeriodEnd: { type: 'string', format: 'date' },
          baseAmount: { type: 'number' },
          overageAmount: { type: 'number' },
          taxAmount: { type: 'number' },
          totalAmount: { type: 'number' },
          status: { type: 'string' },
          dueDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },

  // AdvancedSchedule
  CreateAdvancedScheduleRequest: {
    type: 'object',
    required: ['name', 'clientId', 'scheduleType', 'startAt'],
    properties: {
      name: { type: 'string' },
      clientId: { type: 'integer' },
      scheduleType: { type: 'string', enum: ['campaign_start', 'campaign_end', 'totem_reboot', 'media_publish', 'export_run', 'webhook_trigger'] },
      targetId: { type: 'integer' },
      startAt: { type: 'string', format: 'date-time' },
      endAt: { type: 'string', format: 'date-time' },
      timezone: { type: 'string', default: 'America/Sao_Paulo' },
      cron: { type: 'string' },
      payload: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateAdvancedScheduleRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      startAt: { type: 'string', format: 'date-time' },
      endAt: { type: 'string', format: 'date-time' },
      cron: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },

  // Export (Query/Schedule/Execution)
  CreateExportQueryRequest: {
    type: 'object',
    required: ['name', 'sql', 'clientId'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      sql: { type: 'string' },
      clientId: { type: 'integer' },
      parameters: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateExportQueryRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      sql: { type: 'string' },
      parameters: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean' }
    }
  },
  CreateExportScheduleRequest: {
    type: 'object',
    required: ['name', 'exportQueryId', 'cron'],
    properties: {
      name: { type: 'string' },
      exportQueryId: { type: 'integer' },
      cron: { type: 'string' },
      timezone: { type: 'string', default: 'America/Sao_Paulo' },
      format: { type: 'string', enum: ['csv', 'xlsx', 'parquet', 'json'], default: 'csv' },
      destinations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: ['email', 's3', 'sftp', 'http_webhook'] },
            config: { type: 'object', additionalProperties: true }
          }
        }
      },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateExportScheduleRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      cron: { type: 'string' },
      format: { type: 'string', enum: ['csv', 'xlsx', 'parquet', 'json'] },
      isActive: { type: 'boolean' }
    }
  },

  // FX (SmartDisplayFX)
  CreateFxSiteRequest: {
    type: 'object',
    required: ['name', 'clientId'],
    properties: {
      name: { type: 'string' },
      clientId: { type: 'integer' },
      publisherId: { type: 'integer' },
      address: { type: 'string' },
      timezone: { type: 'string', default: 'America/Sao_Paulo' },
      totems: { type: 'array', items: { type: 'integer' } },
      layout: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateFxSiteRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      timezone: { type: 'string' },
      layout: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean' }
    }
  },
  FxSiteListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                totemCount: { type: 'integer' },
                timezone: { type: 'string' },
                isActive: { type: 'boolean' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },
  CreateFxEffectRequest: {
    type: 'object',
    required: ['name', 'effectType'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      effectType: { type: 'string', enum: ['transition', 'overlay', 'particle', 'shader', 'multiscreen_synced', 'audio_reactive', 'ace_triggered'] },
      config: { type: 'object', additionalProperties: true },
      assets: { type: 'array', items: { type: 'string', format: 'uri' } },
      tags: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateFxEffectRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
      tags: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' }
    }
  },
  FxEffectListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                effectType: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                isActive: { type: 'boolean' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },
  CreateFxTimelineRequest: {
    type: 'object',
    required: ['name', 'siteId'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      siteId: { type: 'integer' },
      triggers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            when: { type: 'string', enum: ['absolute', 'scheduled', 'event', 'ace_signal', 'manual'] },
            at: { type: 'string' },
            effectId: { type: 'integer' },
            targets: { type: 'array', items: { type: 'integer' } },
            params: { type: 'object', additionalProperties: true }
          }
        }
      },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateFxTimelineRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      triggers: { type: 'array', items: { type: 'object' } },
      isActive: { type: 'boolean' }
    }
  },
  FxTimelineListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                siteId: { type: 'integer' },
                triggersCount: { type: 'integer' },
                isActive: { type: 'boolean' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },
  CreateFxRuleRequest: {
    type: 'object',
    required: ['name', 'siteId', 'when', 'then'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      siteId: { type: 'integer' },
      when: { type: 'object', additionalProperties: true },
      then: {
        type: 'array',
        items: {
          type: 'object',
          required: ['effectId'],
          properties: { effectId: { type: 'integer' }, targets: { type: 'array', items: { type: 'integer' } }, params: { type: 'object' } }
        }
      },
      priority: { type: 'integer', default: 50 },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateFxRuleRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      when: { type: 'object' },
      then: { type: 'array', items: { type: 'object' } },
      priority: { type: 'integer' },
      isActive: { type: 'boolean' }
    }
  },
  FxRuleListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                siteId: { type: 'integer' },
                priority: { type: 'integer' },
                isActive: { type: 'boolean' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },
  CreateFxTelemetryRequest: {
    type: 'object',
    required: ['siteId', 'totemId', 'effectId'],
    properties: {
      siteId: { type: 'integer' },
      totemId: { type: 'integer' },
      effectId: { type: 'integer' },
      timelineId: { type: 'integer' },
      startedAt: { type: 'string', format: 'date-time' },
      endedAt: { type: 'string', format: 'date-time' },
      fps: { type: 'number', minimum: 0 },
      success: { type: 'boolean' },
      errorMessage: { type: 'string' },
      measurements: { type: 'object', additionalProperties: true }
    }
  },
  FxTelemetryListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                siteId: { type: 'integer' },
                totemId: { type: 'integer' },
                effectId: { type: 'integer' },
                durationMs: { type: 'integer' },
                fps: { type: 'number' },
                success: { type: 'boolean' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // ACE (reconhecimento facial, contexto de audiência)
  AceAudienceDemographics: {
    type: 'object',
    properties: {
      totalFaces: { type: 'integer', minimum: 0 },
      byGender: {
        type: 'object',
        properties: {
          male: { type: 'integer' },
          female: { type: 'integer' },
          other: { type: 'integer' }
        }
      },
      byAgeBucket: {
        type: 'object',
        patternProperties: {
          "^[0-9]+-[0-9]+$": { type: 'integer' }
        },
        additionalProperties: false
      },
      attentionSeconds: { type: 'number', minimum: 0 },
      avgDwellSeconds: { type: 'number', minimum: 0 }
    }
  },
  AceSentimentBreakdown: {
    type: 'object',
    properties: {
      positive: { type: 'number', minimum: 0, maximum: 1 },
      neutral: { type: 'number', minimum: 0, maximum: 1 },
      negative: { type: 'number', minimum: 0, maximum: 1 },
      avgScore: { type: 'number', minimum: -1, maximum: 1 }
    }
  },
  AceAudienceSnapshot: {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      totemId: { type: 'integer' },
      demographics: { $ref: '#/components/schemas/AceAudienceDemographics' },
      sentiment: { $ref: '#/components/schemas/AceSentimentBreakdown' },
      contentId: { type: 'integer' },
      weather: { type: 'string' },
      hourBucket: { type: 'string' },
      dwellHistogram: { type: 'array', items: { type: 'integer' } }
    }
  },
  AceContentPerformance: {
    type: 'object',
    properties: {
      mediaId: { type: 'integer' },
      mediaName: { type: 'string' },
      impressions: { type: 'integer' },
      totalAttentionSec: { type: 'number' },
      avgAttentionSec: { type: 'number' },
      recallIndex: { type: 'number', minimum: 0, maximum: 100 },
      sentimentAvg: { type: 'number', minimum: -1, maximum: 1 },
      topDemographic: { type: 'string' }
    }
  },

  // Dispatcher (distribuição de conteúdo para totens)
  DispatcherRequest: {
    type: 'object',
    required: ['totemIds'],
    properties: {
      totemIds: { type: 'array', items: { type: 'integer' }, minItems: 1 },
      playlistIds: { type: 'array', items: { type: 'integer' } },
      campaignIds: { type: 'array', items: { type: 'integer' } },
      mediaIds: { type: 'array', items: { type: 'integer' } },
      priority: { type: 'integer', minimum: 0, maximum: 10, default: 5 },
      force: { type: 'boolean', default: false },
      ttlSeconds: { type: 'integer', default: 3600 },
      reason: { type: 'string' }
    }
  },
  DispatcherResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          dispatchId: { type: 'string', format: 'uuid' },
          totalItems: { type: 'integer' },
          targetTotems: { type: 'integer' },
          scheduledAt: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                totemId: { type: 'integer' },
                mediaId: { type: 'integer' },
                status: { type: 'string', enum: ['queued', 'sending', 'delivered', 'failed', 'cancelled'] },
                retryCount: { type: 'integer' }
              }
            }
          }
        }
      },
      message: { type: 'string' }
    }
  },
  DispatcherTotemRow: {
    type: 'object',
    properties: {
      totem_id: { type: 'integer' },
      totem_name: { type: 'string' },
      publisher_id: { type: 'integer' },
      local_id: { type: 'integer' },
      scope_public_token: { type: 'string' },
      scope_private_token: { type: 'string' },
      current_playlist_id: { type: 'integer' },
      current_dispatch_id: { type: 'string' },
      last_sync_at: { type: 'string', format: 'date-time' }
    }
  },

  // OTA
  OTAUpdateRequest: {
    type: 'object',
    required: ['version', 'packageUrl', 'platform'],
    properties: {
      version: { type: 'string' },
      packageUrl: { type: 'string', format: 'uri' },
      checksum: { type: 'string' },
      platform: { type: 'string', enum: ['android', 'linux', 'webos', 'electron', 'ios'] },
      minVersion: { type: 'string' },
      rolloutPercent: { type: 'integer', minimum: 0, maximum: 100, default: 100 },
      force: { type: 'boolean', default: false },
      releaseNotes: { type: 'string' },
      isActive: { type: 'boolean', default: true }
    }
  },
  HeartbeatOtaPayload: {
    type: 'object',
    properties: {
      totemId: { type: 'integer' },
      currentVersion: { type: 'string' },
      availableUpdate: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          packageUrl: { type: 'string', format: 'uri' },
          checksum: { type: 'string' },
          force: { type: 'boolean' }
        }
      },
      rolloutGroup: { type: 'string' },
      nextCheckAt: { type: 'string', format: 'date-time' }
    }
  },

  // SmartTV
  CreateSmartTvRequest: {
    type: 'object',
    required: ['name', 'model', 'localId', 'totemId'],
    properties: {
      name: { type: 'string' },
      model: { type: 'string' },
      serialNumber: { type: 'string' },
      brand: { type: 'string', enum: ['samsung', 'lg', 'philips', 'sony', 'xiaomi', 'tcl', 'other'], default: 'other' },
      localId: { type: 'integer' },
      totemId: { type: 'integer' },
      macAddress: { type: 'string' },
      ipAddress: { type: 'string' },
      isActive: { type: 'boolean', default: true }
    }
  },
  UpdateSmartTvRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      ipAddress: { type: 'string' },
      totemId: { type: 'integer' },
      isActive: { type: 'boolean' }
    }
  },
  SmartTvListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                brand: { type: 'string' },
                model: { type: 'string' },
                totemId: { type: 'integer' },
                localId: { type: 'integer' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // ExportJobData / AdvancedScheduleJobData (config/queue)
  ExportJobData: {
    type: 'object',
    required: ['exportScheduleId'],
    properties: {
      exportScheduleId: { type: 'integer' },
      exportQueryId: { type: 'integer' },
      format: { type: 'string', enum: ['csv', 'xlsx', 'parquet', 'json'] },
      executionId: { type: 'integer' },
      destinationIndex: { type: 'integer' },
      retries: { type: 'integer', default: 0 },
      maxRetries: { type: 'integer', default: 3 }
    }
  },
  AdvancedScheduleJobData: {
    type: 'object',
    required: ['scheduleId'],
    properties: {
      scheduleId: { type: 'integer' },
      scheduleType: { type: 'string' },
      targetId: { type: 'integer' },
      executionTime: { type: 'string', format: 'date-time' },
      retries: { type: 'integer', default: 0 },
      payload: { type: 'object', additionalProperties: true }
    }
  },

  // Client entity (FullEntity + propriedades adicionais)
  ClientListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Client' }
          }
        },
        required: ['success']
      }
    ]
  },

  // Webhook
  CreateWebhookRequest: {
    type: 'object',
    required: ['name', 'url', 'eventType'],
    properties: {
      name: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      eventType: { type: 'string' },
      secret: { type: 'string' },
      isActive: { type: 'boolean', default: true },
      filters: { type: 'object', additionalProperties: true },
      headers: { type: 'object', additionalProperties: { type: 'string' } }
    }
  },
  UpdateWebhookRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      secret: { type: 'string' },
      isActive: { type: 'boolean' },
      filters: { type: 'object' },
      headers: { type: 'object' }
    }
  },

  // Installation Profile (modo Direct vs Multi Lite/Pro)
  InstallationProfile: {
    type: 'object',
    required: ['mode', 'installationId', 'orgName'],
    properties: {
      mode: { type: 'string', enum: ['direct', 'multi_lite', 'multi_pro'] },
      installationId: { type: 'string', format: 'uuid' },
      orgName: { type: 'string' },
      modules: {
        type: 'object',
        properties: {
          ace: { type: 'boolean' },
          smartDisplayFx: { type: 'boolean' },
          tdep: { type: 'boolean' },
          billing: { type: 'boolean' },
          aiVideo: { type: 'boolean' }
        }
      },
      version: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },

  // Tag
  TagRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      color: { type: 'string' },
      category: { type: 'string' }
    }
  },

  // Menu Catalog
  MenuCatalog: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      clientId: { type: 'integer' },
      publisherId: { type: 'integer' },
      name: { type: 'string' },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  mediaId: { type: 'integer' },
                  tags: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        }
      },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },

  // Quick Publish
  QuickPublishRequest: {
    type: 'object',
    required: ['mediaIds', 'totemIds'],
    properties: {
      mediaIds: { type: 'array', items: { type: 'integer' }, minItems: 1 },
      totemIds: { type: 'array', items: { type: 'integer' }, minItems: 1 },
      startAt: { type: 'string', format: 'date-time' },
      endAt: { type: 'string', format: 'date-time' },
      loopCount: { type: 'integer', default: 0, description: '0 = infinite' },
      priority: { type: 'integer', minimum: 0, maximum: 100, default: 50 },
      playlistName: { type: 'string' }
    }
  },

  // Simple Publish
  SimplePublishRequest: {
    type: 'object',
    required: ['totemId', 'mediaId'],
    properties: {
      totemId: { type: 'integer' },
      mediaId: { type: 'integer' },
      durationSeconds: { type: 'integer', default: 15 },
      startImmediately: { type: 'boolean', default: true },
      expiresAt: { type: 'string', format: 'date-time' }
    }
  },

  // Financial Admin
  RecordPaymentRequest: {
    type: 'object',
    required: ['billingId', 'amountPaid', 'paymentMethod', 'paidAt'],
    properties: {
      billingId: { type: 'integer' },
      amountPaid: { type: 'number', minimum: 0 },
      paymentMethod: { type: 'string', enum: ['pix', 'credit_card', 'bank_slip', 'bank_transfer', 'cash', 'stripe'] },
      paidAt: { type: 'string', format: 'date-time' },
      transactionRef: { type: 'string' },
      notes: { type: 'string' }
    }
  },
  PaymentQrResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          qrCodeBase64: { type: 'string' },
          copyPaste: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          amount: { type: 'number' }
        }
      }
    }
  },

  // DashboardLayout (já existe no enhanced, aqui normalizado)
  CreateDashboardLayoutRequest: {
    type: 'object',
    required: ['name', 'layoutData'],
    properties: {
      name: { type: 'string' },
      layoutData: { type: 'object', additionalProperties: true },
      isDefault: { type: 'boolean', default: false },
      isShared: { type: 'boolean', default: false }
    }
  },
  UpdateDashboardLayoutRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      layoutData: { type: 'object', additionalProperties: true },
      isDefault: { type: 'boolean' },
      isShared: { type: 'boolean' }
    }
  },

  // MediaConfig
  MediaConfigApplyResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      applied: { type: 'integer' },
      skipped: { type: 'integer' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mediaId: { type: 'integer' },
            message: { type: 'string' }
          }
        }
      }
    }
  },

  // Publisher Contracts (publisherContractService)
  CreatePublisherContractRequest: {
    type: 'object',
    required: ['publisherId', 'title', 'startDate'],
    properties: {
      publisherId: { type: 'integer' },
      title: { type: 'string' },
      clientId: { type: 'integer' },
      contractType: { type: 'string', enum: ['revenue_share', 'subscription', 'partnership', 'hybrid'] },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      totalAmount: { type: 'number', minimum: 0 },
      currency: { type: 'string', default: 'BRL' },
      revenueSharePercent: { type: 'number', minimum: 0, maximum: 100 },
      terms: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'active', 'expired', 'cancelled'], default: 'draft' }
    }
  },
  UpdatePublisherContractRequest: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      endDate: { type: 'string', format: 'date' },
      totalAmount: { type: 'number' },
      revenueSharePercent: { type: 'number' },
      terms: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'active', 'expired', 'cancelled'] }
    }
  },
  PublisherContractListResponse: {
    allOf: [
      { $ref: '#/components/schemas/PaginatedResponse' },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                contractNumber: { type: 'string' },
                title: { type: 'string' },
                publisherId: { type: 'integer' },
                contractType: { type: 'string' },
                status: { type: 'string' },
                totalAmount: { type: 'number' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' }
              }
            }
          }
        },
        required: ['success']
      }
    ]
  },

  // AI Video (aiVideoTypes.ts)
  VideoAiQueueRequest: {
    type: 'object',
    required: ['mediaId', 'prompt'],
    properties: {
      mediaId: { type: 'integer' },
      prompt: { type: 'string' },
      provider: { type: 'string', enum: ['runway', 'kling', 'pika', 'luma', 'replicate', 'local'] },
      model: { type: 'string' },
      aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3'], default: '16:9' },
      durationSeconds: { type: 'integer', minimum: 1, maximum: 180, default: 10 },
      seed: { type: 'integer' },
      parameters: { type: 'object', additionalProperties: true }
    }
  },
  AIRequestType: { $ref: '#/components/schemas/AIRequest' },
  AIResponseType: { $ref: '#/components/schemas/AIResponse' },

  // ACE Types (aceTypes.ts) - ponte oficial
  AceTypesOverview: {
    type: 'object',
    properties: {
      audienceSnapshot: { $ref: '#/components/schemas/AceAudienceSnapshot' },
      contentPerformance: { $ref: '#/components/schemas/AceContentPerformance' },
      demographics: { $ref: '#/components/schemas/AceAudienceDemographics' },
      sentiment: { $ref: '#/components/schemas/AceSentimentBreakdown' }
    }
  },

  // PlayerTransaction (Player debug)
  PlayerTransaction: {
    type: 'object',
    required: ['playerId', 'transactionId', 'type', 'timestamp'],
    properties: {
      playerId: { type: 'integer' },
      transactionId: { type: 'string' },
      type: { type: 'string', enum: ['sync', 'heartbeat', 'command', 'ota', 'media_check', 'error_report'] },
      status: { type: 'string', enum: ['started', 'completed', 'failed', 'timeout'] },
      timestamp: { type: 'string', format: 'date-time' },
      payload: { type: 'object', additionalProperties: true },
      error: { type: 'string' },
      durationMs: { type: 'integer' }
    }
  },

  // Media Usage / Conflicts (mediaDeletionService)
  MediaUsagePayload: {
    type: 'object',
    properties: {
      mediaId: { type: 'integer' },
      usages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['playlist', 'campaign', 'smart_playlist', 'publish_board', 'fx_effect', 'menu_catalog', 'qrcode'] },
            referenceId: { type: 'integer' },
            referenceName: { type: 'string' }
          }
        }
      }
    }
  },
  MediaInUseConflictPayload: {
    type: 'object',
    properties: {
      mediaId: { type: 'integer' },
      conflictCount: { type: 'integer' },
      usages: { $ref: '#/components/schemas/MediaUsagePayload' },
      safeToDelete: { type: 'boolean' },
      cascadingPlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['detach_from_playlist', 'detach_from_campaign', 'disable_in_smart_playlist', 'hard_delete'] },
            targetType: { type: 'string' },
            targetId: { type: 'integer' }
          }
        }
      }
    }
  },

  // RemoteCommand (remoteCommandService)
  CreateCommandRequest: {
    type: 'object',
    required: ['totemId', 'command'],
    properties: {
      totemId: { type: 'integer' },
      command: { type: 'string', enum: ['reboot', 'shutdown', 'reload_playlist', 'clear_cache', 'update_ota', 'screenshot', 'debug_mode', 'restart_player', 'volume_up', 'volume_down', 'volume_set'] },
      args: { type: 'object', additionalProperties: true },
      ttlSeconds: { type: 'integer', default: 300 },
      requireAck: { type: 'boolean', default: true }
    }
  },

  // PlayerConfig (systemService)
  PlayerConfig: {
    type: 'object',
    required: ['platform', 'version', 'baseUrl'],
    properties: {
      platform: { type: 'string', enum: ['android', 'linux', 'webos', 'electron', 'ios'] },
      version: { type: 'string' },
      baseUrl: { type: 'string', format: 'uri' },
      heartbeatIntervalSec: { type: 'integer', default: 30 },
      syncIntervalSec: { type: 'integer', default: 300 },
      cachePolicy: {
        type: 'object',
        properties: {
          maxGB: { type: 'number' },
          evictionPolicy: { type: 'string', enum: ['lru', 'lfu', 'fifo'] },
          prefetchWindowSec: { type: 'integer', default: 120 }
        }
      },
      telemetry: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          batchSize: { type: 'integer', default: 50 },
          endpoint: { type: 'string', format: 'uri' }
        }
      },
      ace: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          modelUrl: { type: 'string', format: 'uri' },
          inferenceEveryMs: { type: 'integer', default: 1000 },
          minFaceSize: { type: 'integer', default: 60 }
        }
      }
    }
  },

  // Resolved Financial Integration Configs
  ResolvedEmailIntegrationConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      provider: { type: 'string', enum: ['smtp', 'sendgrid', 'ses', 'mandrill'] },
      smtpHost: { type: 'string' },
      smtpPort: { type: 'integer' },
      fromAddress: { type: 'string', format: 'email' },
      secure: { type: 'boolean' },
      templates: {
        type: 'object',
        properties: {
          billingIssued: { type: 'string' },
          billingPaid: { type: 'string' },
          revenueSharePayout: { type: 'string' }
        }
      }
    }
  },
  ResolvedWhatsAppIntegrationConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      provider: { type: 'string', enum: ['meta_cloud', 'twilio', 'evolution', 'wppconnect'] },
      phoneNumberId: { type: 'string' },
      businessAccountId: { type: 'string' },
      templates: {
        type: 'object',
        additionalProperties: { type: 'string' }
      }
    }
  },

  // LogRotation / Backup (utilitários)
  LogRotationConfig: {
    type: 'object',
    properties: {
      maxFileSizeMB: { type: 'integer', default: 100 },
      maxFiles: { type: 'integer', default: 30 },
      compress: { type: 'boolean', default: true },
      retentionDays: { type: 'integer', default: 90 },
      directory: { type: 'string' }
    }
  },
  BackupConfig: {
    type: 'object',
    required: ['type', 'schedule'],
    properties: {
      type: { type: 'string', enum: ['database', 'media', 'config', 'full'] },
      schedule: { type: 'string' },
      retentionDays: { type: 'integer', default: 30 },
      destinations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: ['s3', 'sftp', 'local'] },
            config: { type: 'object', additionalProperties: true }
          }
        }
      },
      compression: { type: 'string', enum: ['none', 'gzip', 'zstd'], default: 'gzip' },
      encryption: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          algorithm: { type: 'string' },
          publicKey: { type: 'string' }
        }
      }
    }
  },

  // ReportData (analyticsService extra)
  ReportData: {
    type: 'object',
    properties: {
      reportId: { type: 'integer' },
      name: { type: 'string' },
      type: { type: 'string' },
      format: { type: 'string' },
      rows: { type: 'array', items: {} },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string', enum: ['string', 'number', 'date', 'currency', 'boolean'] }
          }
        }
      },
      generatedAt: { type: 'string', format: 'date-time' }
    }
  },

  // Locale (localService) - List + CreateBody normalizados
  CreateLocalRequestBody: { $ref: '#/components/schemas/CreateLocalRequest' },
  UpdateLocalRequestBody: { $ref: '#/components/schemas/UpdateLocalRequest' },

  // Billing Enforcement (tipos compartilhados)
  BillingEnforcementState: {
    type: 'object',
    properties: {
      subscriberId: { type: 'integer' },
      status: { type: 'string', enum: ['active', 'grace_period', 'suspended', 'terminated'] },
      nextInvoiceAt: { type: 'string', format: 'date' },
      lastPaymentAt: { type: 'string', format: 'date-time' },
      overdueBalance: { type: 'number' },
      graceDaysRemaining: { type: 'integer' },
      enforcementActions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['throttle', 'restrict_new', 'readonly', 'suspend', 'notify'] },
            reason: { type: 'string' },
            enforcedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },

  // --------------- Dashboards (Sprint 8 - ACE / FX / General ---------------
  WidgetMeta: {
    type: 'object',
    required: ['id', 'title', 'category'],
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      category: {
        type: 'string',
        enum: ['kpi', 'chart', 'heatmap', 'timeline', 'table', 'gauge', 'compare']
      },
      unit: { type: 'string' },
      updatedAt: { type: 'string', format: 'date-time' },
      cacheKey: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } }
    }
  },
  KpiValue: {
    type: 'object',
    required: ['value'],
    properties: {
      value: { type: 'number' },
      previous: { type: 'number' },
      delta: { type: 'number' },
      deltaPercent: { type: 'number' },
      trend: { type: 'string', enum: ['up', 'down', 'flat'] },
      label: { type: 'string' }
    }
  },
  TimeSeriesPoint: {
    type: 'object',
    required: ['timestamp', 'value'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      value: { type: 'number' },
      label: { type: 'string' },
      group: { type: 'string' }
    }
  },
  HeatmapCell: {
    type: 'object',
    required: ['x', 'y', 'value'],
    properties: {
      x: { type: 'string' },
      y: { type: 'string' },
      value: { type: 'number' },
      count: { type: 'integer' }
    }
  },
  CompareSeries: {
    type: 'object',
    required: ['name', 'value'],
    properties: {
      name: { type: 'string' },
      value: { type: 'number' },
      previous: { type: 'number' },
      color: { type: 'string' }
    }
  },
  DashboardFilters: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      sortBy: { type: 'string' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      totemIds: { type: 'array', items: { type: 'integer' } },
      campaignIds: { type: 'array', items: { type: 'integer' } },
      mediaIds: { type: 'array', items: { type: 'integer' } },
      fxEffectIds: { type: 'array', items: { type: 'integer' } },
      granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'] }
    }
  },
  AceDemographicBucket: {
    type: 'object',
    required: ['ageRange', 'gender', 'detections', 'engagements'],
    properties: {
      ageRange: { type: 'string' },
      gender: { type: 'string', enum: ['male', 'female', 'unknown', 'other'] },
      detections: { type: 'integer' },
      engagements: { type: 'integer' },
      avgDurationSec: { type: 'number' }
    }
  },
  AceAudienceTimeline: {
    type: 'object',
    required: ['hour', 'weekday', 'detected', 'engaged'],
    properties: {
      hour: { type: 'integer', minimum: 0, maximum: 23 },
      weekday: { type: 'string' },
      detected: { type: 'integer' },
      engaged: { type: 'integer' }
    }
  },
  AceTopContent: {
    type: 'object',
    required: ['mediaId', 'mediaName', 'impressions', 'engagements'],
    properties: {
      mediaId: { type: 'integer' },
      mediaName: { type: 'string' },
      impressions: { type: 'integer' },
      engagements: { type: 'integer' },
      targetProfile: { type: 'string' }
    }
  },
  AceRecallMetrics: {
    type: 'object',
    required: ['totalDetections', 'uniqueFaces', 'engagedFaces', 'recallRate'],
    properties: {
      totalDetections: { type: 'integer' },
      uniqueFaces: { type: 'integer' },
      engagedFaces: { type: 'integer' },
      recallRate: { type: 'number', minimum: 0, maximum: 1 },
      avgEngagementDurationSec: { type: 'number' },
      bounceRate: { type: 'number', minimum: 0, maximum: 1 }
    }
  },
  AceDashboardResponse: {
    type: 'object',
    required: ['meta', 'widgets', 'kpis', 'demographicHeatmap', 'audienceTimeline', 'topContents', 'demographicBuckets', 'recall'],
    properties: {
      meta: {
        type: 'object',
        required: ['generatedAt', 'filters', 'period'],
        properties: {
          generatedAt: { type: 'string', format: 'date-time' },
          filters: { $ref: '#/components/schemas/DashboardFilters' },
          period: {
            type: 'object',
            required: ['start', 'end'],
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      widgets: { type: 'array', items: { $ref: '#/components/schemas/WidgetMeta' } },
      kpis: {
        type: 'object',
        required: ['totalDetections', 'uniqueFaces', 'engagementRate', 'recallRate', 'avgWatchTimeSec'],
        properties: {
          totalDetections: { $ref: '#/components/schemas/KpiValue' },
          uniqueFaces: { $ref: '#/components/schemas/KpiValue' },
          engagementRate: { $ref: '#/components/schemas/KpiValue' },
          recallRate: { $ref: '#/components/schemas/KpiValue' },
          avgWatchTimeSec: { $ref: '#/components/schemas/KpiValue' }
        }
      },
      demographicHeatmap: { type: 'array', items: { $ref: '#/components/schemas/HeatmapCell' } },
      audienceTimeline: { type: 'array', items: { $ref: '#/components/schemas/AceAudienceTimeline' } },
      topContents: { type: 'array', items: { $ref: '#/components/schemas/AceTopContent' } },
      demographicBuckets: { type: 'array', items: { $ref: '#/components/schemas/AceDemographicBucket' } },
      recall: { $ref: '#/components/schemas/AceRecallMetrics' }
    }
  },
  FxEffectStat: {
    type: 'object',
    required: ['effectId', 'effectName', 'executions', 'avgLatencyMs', 'errors', 'successRate'],
    properties: {
      effectId: { type: 'integer' },
      effectName: { type: 'string' },
      executions: { type: 'integer' },
      avgLatencyMs: { type: 'number' },
      p95LatencyMs: { type: 'number' },
      errors: { type: 'integer' },
      successRate: { type: 'number', minimum: 0, maximum: 1 }
    }
  },
  FxUptimeStat: {
    type: 'object',
    required: ['totemId', 'uptimePercent', 'downtimeMinutes'],
    properties: {
      totemId: { type: 'integer' },
      totemName: { type: 'string' },
      uptimePercent: { type: 'number', minimum: 0, maximum: 100 },
      downtimeMinutes: { type: 'number' },
      lastOfflineAt: { type: 'string', format: 'date-time' },
      syncDriftMs: { type: 'number' }
    }
  },
  FxCompareEntry: {
    type: 'object',
    required: ['label', 'before', 'after', 'deltaPercent', 'metric'],
    properties: {
      label: { type: 'string' },
      before: { type: 'number' },
      after: { type: 'number' },
      deltaPercent: { type: 'number' },
      metric: { type: 'string' }
    }
  },
  FxTimelineEvent: {
    type: 'object',
    required: ['timestamp', 'type', 'ok'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      type: { type: 'string', enum: ['orchestration', 'sync', 'effect', 'error', 'heartbeat'] },
      totemId: { type: 'integer' },
      effectName: { type: 'string' },
      durationMs: { type: 'number' },
      ok: { type: 'boolean' }
    }
  },
  FxDashboardResponse: {
    type: 'object',
    required: ['meta', 'widgets', 'kpis', 'topEffects', 'uptimeByTotem', 'compareAB', 'timeline'],
    properties: {
      meta: {
        type: 'object',
        required: ['generatedAt', 'filters', 'period'],
        properties: {
          generatedAt: { type: 'string', format: 'date-time' },
          filters: { $ref: '#/components/schemas/DashboardFilters' },
          period: {
            type: 'object',
            required: ['start', 'end'],
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      widgets: { type: 'array', items: { $ref: '#/components/schemas/WidgetMeta' } },
      kpis: {
        type: 'object',
        required: ['totalExecutions', 'avgLatencyMs', 'fleetUptimePercent', 'syncSuccessRate', 'totalErrors'],
        properties: {
          totalExecutions: { $ref: '#/components/schemas/KpiValue' },
          avgLatencyMs: { $ref: '#/components/schemas/KpiValue' },
          fleetUptimePercent: { $ref: '#/components/schemas/KpiValue' },
          syncSuccessRate: { $ref: '#/components/schemas/KpiValue' },
          totalErrors: { $ref: '#/components/schemas/KpiValue' }
        }
      },
      topEffects: { type: 'array', items: { $ref: '#/components/schemas/FxEffectStat' } },
      uptimeByTotem: { type: 'array', items: { $ref: '#/components/schemas/FxUptimeStat' } },
      compareAB: { type: 'array', items: { $ref: '#/components/schemas/FxCompareEntry' } },
      timeline: { type: 'array', items: { $ref: '#/components/schemas/FxTimelineEvent' } }
    }
  },
  GeneralMediaStat: {
    type: 'object',
    required: ['mediaId', 'mediaName', 'mediaType', 'impressions', 'plays', 'ctrPercent'],
    properties: {
      mediaId: { type: 'integer' },
      mediaName: { type: 'string' },
      mediaType: { type: 'string' },
      impressions: { type: 'integer' },
      plays: { type: 'integer' },
      ctrPercent: { type: 'number', minimum: 0 },
      avgWatchPercent: { type: 'number', minimum: 0, maximum: 100 }
    }
  },
  GeneralCampaignStat: {
    type: 'object',
    required: ['campaignId', 'campaignName', 'impressions'],
    properties: {
      campaignId: { type: 'integer' },
      campaignName: { type: 'string' },
      budgetSpent: { type: 'number' },
      impressions: { type: 'integer' },
      clicks: { type: 'integer' },
      conversions: { type: 'integer' },
      roi: { type: 'number' }
    }
  },
  GeneralTotemFleetStat: {
    type: 'object',
    required: ['total', 'online', 'offline', 'warning', 'avgUptimePercent', 'totalHeartbeats24h'],
    properties: {
      total: { type: 'integer' },
      online: { type: 'integer' },
      offline: { type: 'integer' },
      warning: { type: 'integer' },
      avgUptimePercent: { type: 'number', minimum: 0, maximum: 100 },
      totalHeartbeats24h: { type: 'integer' }
    }
  },
  GeneralPlaylistStat: {
    type: 'object',
    required: ['playlistId', 'playlistName', 'plays', 'impressions'],
    properties: {
      playlistId: { type: 'integer' },
      playlistName: { type: 'string' },
      plays: { type: 'integer' },
      impressions: { type: 'integer' },
      skipRate: { type: 'number', minimum: 0, maximum: 1 },
      avgCompletionPercent: { type: 'number', minimum: 0, maximum: 100 }
    }
  },
  GeneralBillingStat: {
    type: 'object',
    properties: {
      plan: { type: 'string' },
      meteredUsage: {
        type: 'object',
        properties: {
          impressions: { type: 'integer' },
          bandwidthMB: { type: 'number' },
          storageMB: { type: 'number' },
          aiCreditsUsed: { type: 'number' }
        }
      },
      currentMonthCost: { type: 'number' },
      projectedCost: { type: 'number' }
    }
  },
  GeneralAnalyticsResponse: {
    type: 'object',
    required: ['meta', 'widgets', 'kpis', 'impressionsTimeline', 'topMedias', 'topCampaigns', 'fleet', 'playlists'],
    properties: {
      meta: {
        type: 'object',
        required: ['generatedAt', 'filters', 'period'],
        properties: {
          generatedAt: { type: 'string', format: 'date-time' },
          filters: { $ref: '#/components/schemas/DashboardFilters' },
          period: {
            type: 'object',
            required: ['start', 'end'],
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      widgets: { type: 'array', items: { $ref: '#/components/schemas/WidgetMeta' } },
      kpis: {
        type: 'object',
        required: ['totalImpressions', 'totalPlays', 'ctrPercent', 'avgWatchTimeSec', 'fleetUptimePercent'],
        properties: {
          totalImpressions: { $ref: '#/components/schemas/KpiValue' },
          totalPlays: { $ref: '#/components/schemas/KpiValue' },
          ctrPercent: { $ref: '#/components/schemas/KpiValue' },
          avgWatchTimeSec: { $ref: '#/components/schemas/KpiValue' },
          fleetUptimePercent: { $ref: '#/components/schemas/KpiValue' }
        }
      },
      impressionsTimeline: { type: 'array', items: { $ref: '#/components/schemas/TimeSeriesPoint' } },
      topMedias: { type: 'array', items: { $ref: '#/components/schemas/GeneralMediaStat' } },
      topCampaigns: { type: 'array', items: { $ref: '#/components/schemas/GeneralCampaignStat' } },
      fleet: { $ref: '#/components/schemas/GeneralTotemFleetStat' },
      playlists: { type: 'array', items: { $ref: '#/components/schemas/GeneralPlaylistStat' } },
      billing: { $ref: '#/components/schemas/GeneralBillingStat' }
    }
  },
  DashboardKind: { type: 'string', enum: ['ace', 'fx', 'general'] },
  DashboardAggregateRequest: {
    type: 'object',
    required: ['kind'],
    properties: {
      kind: { $ref: '#/components/schemas/DashboardKind' },
      filters: { $ref: '#/components/schemas/DashboardFilters' },
      includeWidgets: { type: 'array', items: { type: 'string' } },
      excludeWidgets: { type: 'array', items: { type: 'string' } },
      useCache: { type: 'boolean', default: true },
      ttlSec: { type: 'integer', default: 300 }
    }
  }
};

export default canonicalSchemas;

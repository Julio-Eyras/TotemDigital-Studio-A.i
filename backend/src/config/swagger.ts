export const openApiSpec: any = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Signage Pro v2.0 - API',
    version: '2.0.0',
    description: 'API REST do Smart Signage Pro v2.0'
  },
  servers: [ { url: '/api', description: 'API Base' } ],
  paths: {
    '/health': {
      get: { summary: 'Health check', responses: { '200': { description: 'OK' } } }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
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
      }
    }
  },
  security: [ { bearerAuth: [] } ]
};



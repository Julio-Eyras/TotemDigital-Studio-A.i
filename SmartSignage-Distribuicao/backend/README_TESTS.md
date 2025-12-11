# 🧪 Testes Automatizados - Smart Signage Pro v2.1

Este documento descreve como executar e desenvolver testes automatizados para o Smart Signage Pro.

## 📋 Configuração

### Instalação de Dependências

As dependências de teste já estão instaladas:
- `jest` - Framework de testes
- `ts-jest` - Suporte TypeScript para Jest
- `supertest` - Testes de integração para APIs HTTP
- `@types/jest` e `@types/supertest` - Tipos TypeScript

### Configuração do Ambiente de Teste

1. Copie o arquivo `.env.test.example` para `.env.test`:
```bash
cp backend/.env.test.example backend/.env.test
```

2. Configure as variáveis de ambiente de teste (opcional, já tem valores padrão):
- `TEST_DATABASE_URL` - URL do banco de dados de teste
- `JWT_SECRET` - Chave secreta para JWT (apenas para testes)
- `EMAIL_ENABLED=false` - Email desabilitado em testes

## 🚀 Executando Testes

### Executar Todos os Testes
```bash
cd backend
npm test
```

### Executar Testes em Modo Watch (desenvolvimento)
```bash
npm run test:watch
```

### Executar Testes com Cobertura
```bash
npm run test:coverage
```

### Executar Apenas Testes Unitários
```bash
npm run test:unit
```

### Executar Apenas Testes de Integração
```bash
npm run test:integration
```

## 📁 Estrutura de Testes

```
backend/
├── jest.config.js                 # Configuração do Jest
├── src/
│   ├── __tests__/
│   │   ├── setup.ts              # Configuração inicial dos testes
│   │   ├── services/             # Testes unitários de serviços
│   │   │   ├── authService.test.ts
│   │   │   └── emailService.test.ts
│   │   └── routes/               # Testes de integração de rotas
│   │       └── auth.test.ts
│   └── ...
└── coverage/                      # Relatórios de cobertura (gerado)
```

## 📝 Escrevendo Testes

### Teste Unitário de Serviço

Exemplo básico:

```typescript
import { MyService } from '../../services/myService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('deve fazer algo corretamente', async () => {
    const result = await service.doSomething();
    expect(result).toBeDefined();
  });
});
```

### Teste de Integração de Rota

Exemplo básico:

```typescript
import request from 'supertest';
import express from 'express';
import myRoutes from '../../routes/myRoutes';

describe('My Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/my', myRoutes);
  });

  it('deve retornar 200 para GET /api/my', async () => {
    const response = await request(app)
      .get('/api/my')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

## 🎯 Cobertura de Código

O Jest gera relatórios de cobertura em:
- `backend/coverage/lcov-report/index.html` - Relatório HTML
- `backend/coverage/lcov.info` - Relatório LCOV

### Metas de Cobertura

- **Serviços**: Mínimo 80% de cobertura
- **Rotas**: Mínimo 70% de cobertura
- **Funcionalidades críticas**: 100% de cobertura (auth, segurança)

## 🔧 Mocking

### Mock de Banco de Dados

```typescript
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

const mockDb = {
  findFirst: jest.fn(),
  executeRaw: jest.fn(),
};

(getDatabase as jest.Mock).mockReturnValue(mockDb);
```

### Mock de Serviços Externos

```typescript
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));
```

## 📊 Testes Existentes

### ✅ AuthService
- `forgotPassword` - Recuperação de senha
- `resetPassword` - Redefinição de senha
- `login` - Autenticação
- `register` - Registro de usuário
- `cleanupExpiredTokens` - Limpeza de tokens

### ✅ EmailService
- `sendEmail` - Envio de email genérico
- `sendPasswordResetEmail` - Email de recuperação
- `sendWelcomeEmail` - Email de boas-vindas
- `sendNotificationEmail` - Email de notificação
- `testConnection` - Teste de conexão SMTP

### ✅ Rotas de Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/forgot-password` - Recuperação de senha
- `POST /api/auth/reset-password` - Redefinição de senha

## 🚧 Próximos Testes a Implementar

- [ ] Testes para CampaignService
- [ ] Testes para MediaService
- [ ] Testes para PlaylistService
- [ ] Testes para ExportQueryService
- [ ] Testes para AdvancedScheduleService
- [ ] Testes E2E para fluxos completos

## 📚 Recursos

- [Documentação do Jest](https://jestjs.io/docs/getting-started)
- [Documentação do Supertest](https://github.com/visionmedia/supertest)
- [TypeScript com Jest](https://jestjs.io/docs/getting-started#using-typescript)


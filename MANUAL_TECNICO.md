# Manual Técnico - SmartSignage Pro v2.1

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 📋 Índice

1. [Introdução](#introdução)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Requisitos do Sistema](#requisitos-do-sistema)
4. [Instalação](#instalação)
5. [Configuração](#configuração)
6. [Estrutura do Projeto](#estrutura-do-projeto)
7. [Banco de Dados](#banco-de-dados)
8. [APIs e Endpoints](#apis-e-endpoints)
9. [Autenticação e Autorização](#autenticação-e-autorização)
10. [Desenvolvimento](#desenvolvimento)
11. [Deploy e Produção](#deploy-e-produção)
12. [Monitoramento e Logs](#monitoramento-e-logs)
13. [Troubleshooting](#troubleshooting)

---

## Introdução

Este manual técnico fornece informações detalhadas sobre a arquitetura, instalação, configuração e desenvolvimento do sistema SmartSignage Pro v2.1.

### Tecnologias Principais

- **Backend:** Node.js 18+, TypeScript, Express.js, PostgreSQL 15+
- **Frontend:** React 18+, TypeScript, Material-UI, Redux Toolkit
- **Banco de Dados:** PostgreSQL 15+
- **Cache:** Redis (opcional)
- **Autenticação:** JWT
- **Arquivos:** Sistema de armazenamento local ou S3-compatible

---

## Arquitetura do Sistema

### Visão Geral

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│   (React)   │     │ (Node.js)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │    Redis    │
                    │  (Cache)    │
                    └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │    Totens   │
                    │  (Edge)     │
                    └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │  Smart TVs  │
                    │  (Displays) │
                    └─────────────┘
```

### Componentes Principais

1. **Frontend (React)**
   - Interface administrativa
   - Dashboard e analytics
   - Gerenciamento de campanhas, mídias, totens

2. **Backend (Node.js/Express)**
   - API RESTful
   - Autenticação e autorização
   - Processamento de mídias
   - Sincronização com totens

3. **Banco de Dados (PostgreSQL)**
   - Dados estruturados
   - Relacionamentos complexos
   - Views e stored procedures

4. **Cache (Redis - Opcional)**
   - Cache de sessões
   - Cache de queries frequentes
   - Rate limiting

5. **Totens (Edge Nodes)**
   - Micro-servidores que controlam Smart TVs
   - Sincronização com backend
   - Reprodução de conteúdo

---

## Requisitos do Sistema

### Servidor

**Mínimo:**
- CPU: 2 cores
- RAM: 4GB
- Disco: 50GB SSD
- SO: Ubuntu 20.04+ / Windows Server 2019+ / macOS 12+

**Recomendado:**
- CPU: 4+ cores
- RAM: 8GB+
- Disco: 100GB+ SSD
- SO: Ubuntu 22.04 LTS

### Software

- **Node.js:** 18.0.0 ou superior
- **npm:** 9.0.0 ou superior
- **PostgreSQL:** 15.0 ou superior
- **Redis:** 6.0+ (opcional, mas recomendado)
- **Nginx:** 1.20+ (para produção)

### Portas

- **Backend:** 3000 (desenvolvimento) / 3000 (produção)
- **Frontend:** 3001 (desenvolvimento) / 80/443 (produção via Nginx)
- **PostgreSQL:** 5432
- **Redis:** 6379

---

## Instalação

### Windows

1. **Instalar pré-requisitos:**
   ```powershell
   # Node.js 18+ (https://nodejs.org/)
   # PostgreSQL 15+ (https://www.postgresql.org/download/windows/)
   # Redis (opcional - via Chocolatey: choco install redis-64)
   ```

2. **Executar script de instalação:**
   ```powershell
   .\install-windows.ps1
   ```

   O script irá:
   - Verificar pré-requisitos
   - Instalar dependências (npm install)
   - Compilar backend (npm run build)
   - Configurar banco de dados
   - Corrigir problemas comuns

3. **Iniciar serviços:**
   ```powershell
   # Terminal 1 - Backend
   cd backend
   npm start

   # Terminal 2 - Frontend
   cd frontend
   npm start
   ```

### Linux/Ubuntu

1. **Instalar pré-requisitos:**
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm postgresql postgresql-contrib redis-server nginx
   ```

2. **Executar script de instalação:**
   ```bash
   chmod +x install-smartsignage.sh
   sudo ./install-smartsignage.sh
   ```

3. **Iniciar serviços:**
   ```bash
   # Backend (como serviço systemd)
   sudo systemctl start smartsignage-backend
   
   # Frontend (via Nginx)
   sudo systemctl start nginx
   ```

### Instalação Manual

Se preferir instalar manualmente:

1. **Backend:**
   ```bash
   cd backend
   npm install
   npm run build
   cp env.example .env
   # Editar .env com suas configurações
   npm start
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   # Editar .env com configurações da API
   npm start
   ```

3. **Banco de Dados:**
   ```bash
   # Criar banco
   createdb -U postgres smartsignage

   # Aplicar schema
   psql -U postgres -d smartsignage -f database/smartchannel-db-v2-refactored-apply-all.sql
   ```

---

## Configuração

### Arquivo .env do Backend

```env
# Servidor
NODE_ENV=development
PORT=3000

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=smartsignage
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartsignage

# Redis (Opcional)
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_ENABLED=false

# JWT
JWT_SECRET=seu-jwt-secret-aqui
JWT_EXPIRES_IN=24h

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=104857600

# Email (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha

# Frontend
FRONTEND_URL=http://localhost:3001
```

### Arquivo .env do Frontend

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ENV=development
```

---

## Estrutura do Projeto

```
SmartSignage-Pro/
├── backend/
│   ├── src/
│   │   ├── config/          # Configurações
│   │   ├── controllers/     # Controladores
│   │   ├── middleware/      # Middlewares
│   │   ├── routes/          # Rotas da API
│   │   ├── services/        # Lógica de negócio
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilitários
│   │   └── index.ts         # Entry point
│   ├── dist/                # Build compilado
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas
│   │   ├── store/           # Redux store
│   │   ├── services/        # Services (API calls)
│   │   ├── types/           # TypeScript types
│   │   └── App.tsx          # Entry point
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── database/
│   ├── smartchannel-db-v2-refactored-part*.sql
│   └── scripts/
│       └── setup-database.js
│
├── docs/                    # Documentação
├── install-windows.ps1      # Script de instalação Windows
└── install-smartsignage.sh  # Script de instalação Linux
```

---

## Banco de Dados

### Schema v2.0

O sistema utiliza PostgreSQL com schema refatorado v2.0, onde:
- `clients` → `subscribers` (Anunciantes)
- `hosts` → `publishers` (Publicadores)
- Billing separado (`subscriber_billing`, `publisher_billing`)
- Contratos (`subscriber_contracts`, `publisher_contracts`)

### Principais Tabelas

- **subscribers**: Anunciantes/Assinantes
- **publishers**: Publicadores
- **users**: Usuários do sistema
- **locals**: Locais físicos
- **totems**: Totens edge
- **smart_tvs**: Smart TVs
- **campaigns**: Campanhas
- **medias**: Mídias
- **playlists**: Playlists
- **subscriber_billing**: Billing de anunciantes
- **publisher_billing**: Billing de publicadores

Para documentação completa do schema, consulte **ESQUEMA_BANCO_DADOS.md**.

### Conexão com o Banco

```typescript
// Backend usa pg (node-postgres)
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

---

## APIs e Endpoints

### Autenticação

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### Subscribers

```
GET    /api/subscribers
GET    /api/subscribers/:id
POST   /api/subscribers
PUT    /api/subscribers/:id
DELETE /api/subscribers/:id
```

### Publishers

```
GET    /api/publishers
GET    /api/publishers/:id
POST   /api/publishers
PUT    /api/publishers/:id
DELETE /api/publishers/:id
```

### Campanhas

```
GET    /api/campaigns
GET    /api/campaigns/:id
POST   /api/campaigns
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
```

### Mídias

```
GET    /api/medias
GET    /api/medias/:id
POST   /api/medias/upload
PUT    /api/medias/:id
DELETE /api/medias/:id
```

### Totens

```
GET    /api/totems
GET    /api/totems/:id
POST   /api/totems
PUT    /api/totems/:id
DELETE /api/totems/:id
GET    /api/totems/:id/status
POST   /api/totems/:id/commands
```

### Analytics

```
GET    /api/analytics/dashboard
GET    /api/analytics/campaigns/:id
GET    /api/analytics/totems/:id
GET    /api/analytics/reports
```

Para documentação completa da API, consulte a documentação Swagger (se disponível) ou o código em `backend/src/routes/`.

---

## Autenticação e Autorização

### JWT (JSON Web Tokens)

O sistema usa JWT para autenticação:

```typescript
// Login
POST /api/auth/login
Body: { email, password }
Response: { token, user }

// Usar token
Authorization: Bearer <token>
```

### Roles e Permissions

O sistema possui roles hierárquicos:
- **admin**: Acesso total
- **manager**: Gerencia subscribers/publishers
- **operator**: Operações básicas
- **viewer**: Apenas visualização

### Middleware de Autenticação

```typescript
// backend/src/middleware/auth.middleware.ts
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  // Validar token JWT
  // Adicionar user ao req.user
  next();
};
```

---

## Desenvolvimento

### Backend

```bash
cd backend
npm install
npm run dev  # Modo desenvolvimento (nodemon)
npm run build  # Compilar TypeScript
npm start  # Executar build
npm test  # Executar testes
```

### Frontend

```bash
cd frontend
npm install
npm start  # Modo desenvolvimento
npm run build  # Build de produção
npm test  # Executar testes
```

### TypeScript

O projeto usa TypeScript strict mode. Sempre tipar:
- Funções
- Variáveis quando necessário
- Props de componentes
- Estados e stores

### Convenções de Código

- **Naming:** camelCase para variáveis/funções, PascalCase para classes
- **Arquivos:** kebab-case para arquivos, PascalCase para componentes React
- **Commits:** Conventional Commits (feat:, fix:, docs:, etc.)

---

## Deploy e Produção

### Build de Produção

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Variáveis de Ambiente

Certifique-se de configurar todas as variáveis de ambiente em produção:
- `NODE_ENV=production`
- Credenciais do banco de dados
- JWT_SECRET forte
- URLs corretas

### Nginx (Recomendado)

```nginx
# /etc/nginx/sites-available/smartsignage
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend
    location / {
        root /path/to/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Systemd (Linux)

```ini
# /etc/systemd/system/smartsignage-backend.service
[Unit]
Description=SmartSignage Pro Backend
After=network.target postgresql.service

[Service]
Type=simple
User=smartsignage
WorkingDirectory=/opt/smartsignage/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Monitoramento e Logs

### Logs do Backend

Logs são salvos em:
- `backend/logs/` (arquivos)
- Console (desenvolvimento)
- Sistema de logs (produção - syslog, etc.)

### Estrutura de Logs

```typescript
logger.info('Mensagem informativa', { metadata });
logger.error('Erro', { error, stack });
logger.warn('Aviso', { context });
```

### Monitoramento Recomendado

- **Uptime:** Verificar se serviços estão rodando
- **Banco de Dados:** Queries lentas, conexões
- **Disco:** Espaço de uploads
- **Memória:** Uso de RAM
- **CPU:** Performance

---

## Troubleshooting

### Backend não inicia

1. Verificar se PostgreSQL está rodando
2. Verificar variáveis de ambiente (.env)
3. Verificar logs: `backend/logs/`
4. Verificar porta 3000 disponível

### Frontend não conecta à API

1. Verificar `REACT_APP_API_URL` no .env
2. Verificar CORS no backend
3. Verificar se backend está rodando
4. Verificar console do navegador (F12)

### Erros de banco de dados

1. Verificar conexão: `psql -U postgres -d smartsignage`
2. Verificar schema aplicado
3. Verificar migrations pendentes
4. Verificar logs do PostgreSQL

### Upload de arquivos falha

1. Verificar permissões da pasta `uploads/`
2. Verificar `MAX_FILE_SIZE` no .env
3. Verificar espaço em disco
4. Verificar formato de arquivo suportado

### Redis não conecta

Se `CACHE_ENABLED=false`, Redis é opcional. Se estiver habilitado:
1. Verificar se Redis está rodando
2. Verificar `REDIS_HOST` e `REDIS_PORT`
3. Verificar firewall

---

## Recursos Adicionais

- **Documentação da API:** `/docs/api` (se Swagger disponível)
- **Schema do Banco:** `ESQUEMA_BANCO_DADOS.md`
- **Manual do Usuário:** `MANUAL_DO_USUARIO.md`
- **Issues:** Repositório Git

---

**Última Atualização:** Dezembro 2025  
**Versão:** 2.1.0


# 🚀 Smart Signage Pro v2.0

**Sistema Completo de Sinalização Digital Profissional**  
*Implementação 100% Real - Zero Mocks - Pronto para Produção*

---

## 📋 **VISÃO GERAL**

O **Smart Signage Pro v2.0** é um sistema completo e robusto de sinalização digital desenvolvido para empresas de todos os portes. Oferece funcionalidades profissionais para criar, gerenciar e exibir conteúdo digital de forma eficiente e escalável.

### 🎯 **Características Principais**
- ✅ **100% Implementado** - Nenhum mock ou simulação
- ✅ **Interface Moderna** - Material-UI com design responsivo
- ✅ **API RESTful Completa** - Backend robusto com TypeScript
- ✅ **Containerização Docker** - Deploy simples e escalável
- ✅ **Monitoramento Integrado** - Prometheus + Grafana
- ✅ **Instalação Automatizada** - Script único para setup completo
- ✅ **Backup Automático** - Proteção de dados garantida
- ✅ **Documentação Completa** - Guias detalhados disponíveis

---

## ✨ **FUNCIONALIDADES IMPLEMENTADAS**

### 🏗️ **Backend (Node.js + TypeScript + Prisma)**
- ✅ **Autenticação JWT** completa com refresh tokens
- ✅ **Sistema RBAC** (Roles Based Access Control)
- ✅ **CRUD Completo** - Usuários, Clientes, Mídias, Playlists, Players
- ✅ **Upload de Mídia** com validação e processamento
- ✅ **Gestão de Playlists** com ordenação e duração
- ✅ **Monitoramento de Players** com heartbeat em tempo real
- ✅ **Dashboard Analytics** com estatísticas em tempo real
- ✅ **API RESTful** completa e documentada
- ✅ **Middleware de Segurança** - Auth, Validation, CORS
- ✅ **Logs Estruturados** e auditoria de ações

### 🎨 **Frontend (React + TypeScript + Material-UI)**
- ✅ **Interface Moderna** - Design profissional e responsivo
- ✅ **Páginas Completas**:
  - Dashboard com estatísticas em tempo real
  - Gestão de Usuários (CRUD completo)
  - Gestão de Clientes (CRUD completo)
  - Gestão de Mídias (Upload, preview, edição)
  - Gestão de Playlists (Criação e edição completa)
  - Gestão de Players/Totems (Monitoramento em tempo real)
- ✅ **Upload de Arquivos** com progresso
- ✅ **Formulários Validados** e feedback visual
- ✅ **Integração Real** - Tudo conectado às APIs
- ✅ **Sem Dados Mock** - 100% real

### 🐳 **Infraestrutura Docker**
- ✅ **8 Containers Orquestrados**:
  - PostgreSQL (banco de dados)
  - Redis (cache e sessões)
  - Backend Node.js (API)
  - Frontend React (Interface)
  - Nginx (Reverse Proxy)
  - Prometheus (Métricas)
  - Grafana (Dashboards)
  - Ollama (IA Local)
- ✅ **Health Checks** em todos os serviços
- ✅ **Volumes Persistentes** para dados e logs
- ✅ **Rede Isolada** para segurança
- ✅ **Restart Automático** em caso de falha

### 📺 **Player HTML5**
- ✅ **Reprodução Automática** de mídias
- ✅ **Suporte Completo** - Imagens, vídeos, áudio
- ✅ **Transições Suaves** entre conteúdos
- ✅ **Controle de Duração** personalizado
- ✅ **Modo Kiosk** otimizado para totens
- ✅ **Heartbeat Automático** para monitoramento

---

## 🚀 **INSTALAÇÃO RÁPIDA**

### **Pré-requisitos**
- Ubuntu 20.04+ ou similar (recomendado) ou Windows com WSL2
- Docker e Docker Compose instalados
- Git (para clonar o repositório)
- 4GB RAM mínimo (8GB recomendado)
- 20GB espaço em disco

### **Instalação Completa (Modo Docker - Recomendado)**

```bash
# 1. Clone o repositório
git clone https://github.com/Julio-Eyras/smartsignage-pro.git
cd smartsignage-pro

# 2. Execute o script de instalação
chmod +x install-smartsignage.sh
./install-smartsignage.sh

# 3. O script fará tudo automaticamente:
#    - Instalação de dependências
#    - Build das imagens Docker
#    - Configuração de banco de dados
#    - Inicialização de todos os serviços
#    - Configuração de firewall
#    - Criação de usuário admin padrão
```

### **Após a Instalação**

O sistema estará disponível em:

- **Frontend/Interface**: `http://seu-servidor-ip` ou `http://localhost`
- **API Backend**: `http://seu-servidor-ip/api` ou `http://localhost/api`
- **Player**: `http://seu-servidor-ip/player` ou `http://localhost/player`
- **Grafana**: `http://seu-servidor-ip:3002` (admin/admin)
- **Prometheus**: `http://seu-servidor-ip:9090`

### **Credenciais Padrão**
- **Usuário**: `admin`
- **Senha**: `admin`
- ⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

---

## 🛠️ **GERENCIAMENTO DO SISTEMA**

### **Script de Gerenciamento**

```bash
cd /opt/smart-signage

# Ver status de todos os serviços
./manage-system.sh status

# Iniciar serviços
./manage-system.sh start

# Parar serviços
./manage-system.sh stop

# Reiniciar serviços
./manage-system.sh restart

# Ver logs
./manage-system.sh logs [servico]

# Atualizar sistema
./manage-system.sh update

# Fazer backup
./manage-system.sh backup

# Ver ajuda completa
./manage-system.sh help
```

### **Comandos Docker Compose Diretos**

```bash
cd /opt/smart-signage

# Ver status
docker compose ps

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Reiniciar um serviço
docker compose restart backend

# Rebuild após atualizações
docker compose build --no-cache
docker compose up -d
```

---

## 📊 **ARQUITETURA TÉCNICA**

### **Stack Tecnológico**

```
Frontend:     React 18 + TypeScript + Material-UI + Redux Toolkit
Backend:      Node.js 18 + Express + TypeScript + Prisma ORM
Database:     PostgreSQL 15 (produção)
Cache:        Redis 7
Proxy:        Nginx (2 containers: frontend + reverse proxy)
Monitoring:   Prometheus + Grafana
AI:           Ollama (IA local)
Container:    Docker + Docker Compose
```

### **Arquitetura de Containers**

```
┌─────────────────────────────────────────────────┐
│           Internet (Porta 80/443)               │
└────────────────────┬────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────┐
        │  Nginx Reverse Proxy       │
        │  (Container: nginx)        │
        │  - Roteamento principal    │
        └───────┬────────────────────┘
                │
    ┌───────────┴────────────┐
    │                        │
    ↓                        ↓
┌───────────┐        ┌──────────────┐
│ Frontend  │        │   Backend    │
│ React     │        │   Node.js    │
│           │        │              │
│ Nginx     │        │   API REST   │
│ (estático)│        │   Prisma     │
│           │        │              │
│ Porta 80  │        │   Porta 3000 │
│ (interno) │        │   (interno)  │
└───────────┘        └──────┬───────┘
                            │
                    ┌───────┴─────────┐
                    │                 │
                    ↓                 ↓
            ┌──────────────┐  ┌──────────────┐
            │ PostgreSQL   │  │    Redis     │
            │ Porta 5432   │  │  Porta 6379  │
            └──────────────┘  └──────────────┘
```

### **Estrutura do Projeto**

```
SmartSignage-Pro/
├── backend/                   # API Node.js
│   ├── src/
│   │   ├── services/         # Serviços de negócio (20+ serviços)
│   │   ├── routes/           # Rotas RESTful (16 rotas)
│   │   ├── middleware/       # Auth, validation, logging
│   │   ├── config/           # Configurações (database, etc)
│   │   └── types/            # Tipos TypeScript
│   ├── prisma/               # Schema Prisma
│   └── dist/                 # Build compilado
│
├── frontend/                  # Interface React
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── pages/            # Páginas principais
│   │   │   ├── Dashboard/    # Dashboard principal
│   │   │   ├── Users/        # Gestão de usuários
│   │   │   ├── Clients/      # Gestão de clientes
│   │   │   ├── Media/        # Gestão de mídias
│   │   │   ├── Playlists/    # Gestão de playlists
│   │   │   └── Players/      # Gestão de players/totems
│   │   ├── services/         # Serviços de API
│   │   └── App.tsx           # Componente principal
│   └── build/                # Build de produção
│
├── player/                    # Player HTML5
│   └── index.html            # Player otimizado
│
├── nginx/                     # Configurações Nginx
│   ├── nginx.conf            # Config principal (contexto http)
│   ├── frontend.conf         # Reverse proxy (porta 80)
│   └── frontend-static.conf  # Nginx do container frontend
│
├── monitoring/                # Monitoramento
│   ├── prometheus/           # Config Prometheus
│   └── grafana/              # Dashboards Grafana
│
├── scripts/                   # Scripts utilitários
│   ├── backup-system.sh      # Backup automático
│   ├── health-check.sh       # Health checks
│   └── ...
│
├── docker-compose.yml         # Orquestração Docker
├── Dockerfile.backend         # Build do backend
├── Dockerfile.frontend        # Build do frontend
├── install-smartsignage.sh   # Script de instalação principal
└── manage-system.sh          # Script de gerenciamento
```

---

## 🎯 **MÓDULOS PRINCIPAIS**

### 👥 **Gestão de Usuários**
- ✅ Criação, edição e exclusão de usuários
- ✅ Sistema de roles (admin, manager, operator)
- ✅ Ativação/desativação de contas
- ✅ Alteração de senhas
- ✅ Histórico de login

### 🏢 **Gestão de Clientes**
- ✅ CRUD completo de clientes
- ✅ Estatísticas por cliente
- ✅ Histórico de atividades
- ✅ Filtros e busca avançada

### 📺 **Gestão de Players/Totems**
- ✅ Cadastro de players
- ✅ Monitoramento em tempo real (online/offline)
- ✅ Heartbeat automático
- ✅ Atribuição de playlists
- ✅ Status e métricas

### 🎬 **Gestão de Mídia**
- ✅ Upload de arquivos (imagens, vídeos, áudio)
- ✅ Preview de mídias
- ✅ Validação de tipos e tamanhos
- ✅ Geração automática de metadados
- ✅ Organização por clientes

### 📋 **Gestão de Playlists**
- ✅ Criação e edição de playlists
- ✅ Adicionar/remover mídias
- ✅ Ordenação personalizada
- ✅ Controle de duração
- ✅ Ativação/desativação

### 📊 **Dashboard**
- ✅ Estatísticas em tempo real
- ✅ Total de usuários, clientes, mídias, playlists
- ✅ Status de players (online/offline)
- ✅ Atividades recentes
- ✅ Métricas de uso

---

## 🔧 **CONFIGURAÇÃO**

### **Variáveis de Ambiente**

As variáveis são configuradas automaticamente durante a instalação. Principais configurações:

```bash
# Database
DATABASE_URL=postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://frontend:80,http://nginx:80

# Storage
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=/app/uploads
MEDIA_QUOTA_PER_CLIENT=5GB

# AI (Ollama)
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://ollama:11434
```

### **Configuração do Player**

O player está configurado para se conectar automaticamente ao backend. Para configuração personalizada, edite `player/index.html`.

---

## 📈 **MONITORAMENTO**

### **Prometheus**
- Acesse: `http://seu-servidor:9090`
- Coleta métricas de todos os serviços
- Retenção: 200 horas

### **Grafana**
- Acesse: `http://seu-servidor:3002`
- Usuário: `admin`
- Senha: `admin`
- Dashboards pré-configurados disponíveis

### **Health Checks**

Todos os containers possuem health checks automáticos:
- Backend: `http://localhost:3000/health`
- Frontend: `http://localhost:80`
- Prometheus: `http://localhost:9090/-/healthy`
- Grafana: Verificação automática
- Redis: `redis-cli ping`
- PostgreSQL: `pg_isready`

---

## 🔐 **SEGURANÇA**

### **Implementado**
- ✅ Autenticação JWT com refresh tokens
- ✅ Sistema RBAC (roles e permissões)
- ✅ CORS configurado adequadamente
- ✅ Validação de entrada em todas as rotas
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection (React escapa automaticamente)
- ✅ Rate limiting configurável
- ✅ Firewall configurado automaticamente
- ✅ Logs de auditoria

### **Recomendações**
- ⚠️ Altere a senha padrão do admin
- ⚠️ Configure SSL/TLS para produção (HTTPS)
- ⚠️ Atualize o `JWT_SECRET` para um valor forte e aleatório
- ⚠️ Configure backups automáticos regulares
- ⚠️ Mantenha o sistema atualizado

---

## 🚨 **TROUBLESHOOTING**

### **Problemas Comuns**

**1. Nginx mostra página padrão "Welcome to nginx!"**
- ✅ **Resolvido**: Implementação corrigida para sempre usar proxy
- Verifique logs: `docker compose logs nginx`

**2. Containers reiniciando constantemente**
- Verifique logs: `docker compose logs [servico]`
- Verifique recursos: `docker stats`
- Verifique dependências: `docker compose ps`

**3. Frontend não carrega**
- Verifique se o build foi criado: `docker compose logs frontend`
- Verifique conectividade: `docker exec smartsignage-nginx curl http://frontend:80`

**4. Backend não responde**
- Verifique banco de dados: `docker compose logs postgres`
- Verifique health: `curl http://localhost:3000/health`
- Verifique logs: `docker compose logs backend`

### **Scripts de Diagnóstico**

```bash
# Diagnóstico completo do sistema
./diagnose-system.sh

# Verificar saúde de todos os serviços
./manage-system.sh status

# Ver logs em tempo real
./manage-system.sh logs

# Verificar conectividade entre containers
docker exec smartsignage-nginx ping backend
docker exec smartsignage-nginx ping frontend
```

---

## 📚 **DOCUMENTAÇÃO ADICIONAL**

Documentação detalhada disponível no repositório:

- **[ARQUITETURA_NGINX.md](ARQUITETURA_NGINX.md)** - Detalhes da arquitetura Nginx (2 containers)
- **[MANUAL_USUARIO.md](MANUAL_USUARIO.md)** - Manual completo do usuário
- **[GUIA_ACESSO_SISTEMA.md](GUIA_ACESSO_SISTEMA.md)** - Guia de URLs e acesso
- **[INSTALACAO_VPS_SSH.md](INSTALACAO_VPS_SSH.md)** - Instalação em VPS remoto
- **[CORRECOES_IMPLEMENTADAS.md](CORRECOES_IMPLEMENTADAS.md)** - Histórico de correções

---

## 🛠️ **DESENVOLVIMENTO**

### **Pré-requisitos**
- Node.js 18+
- npm 9+
- Docker e Docker Compose
- Git

### **Setup de Desenvolvimento**

```bash
# Clone o repositório
git clone https://github.com/Julio-Eyras/smartsignage-pro.git
cd smartsignage-pro

# Backend
cd backend
npm install
npm run build
npm run dev  # Executa em modo watch

# Frontend (em outro terminal)
cd frontend
npm install
npm start  # Executa em modo desenvolvimento
```

### **Scripts Disponíveis**

```bash
# Build do backend
cd backend && npm run build

# Build do frontend
cd frontend && npm run build

# Testes
cd backend && npm test
cd frontend && npm test
```

---

## 🤝 **SUPORTE E CONTRIBUIÇÕES**

### **Reportar Problemas**
- Abra uma [Issue no GitHub](https://github.com/Julio-Eyras/smartsignage-pro/issues)
- Inclua logs relevantes
- Descreva os passos para reproduzir

### **Contribuir**
1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 **LICENÇA**

Este projeto está licenciado sob a [MIT License](LICENSE).

---

## 🎉 **VERSÃO ATUAL**

**Smart Signage Pro v2.0**  
**Status**: ✅ **100% Funcional - Pronto para Produção**

### **Últimas Melhorias (v2.0)**
- ✅ Interface moderna completa (Material-UI)
- ✅ Zero mocks - implementação 100% real
- ✅ Arquitetura Nginx otimizada (2 containers)
- ✅ Sistema de monitoramento completo
- ✅ Instalação automatizada robusta
- ✅ Health checks em todos os serviços
- ✅ Backup automático configurado
- ✅ Documentação completa

---

**📅 Última Atualização**: 29 de Outubro de 2025  
**👥 Desenvolvido por**: Julio Eyras  
**🌐 Repositório**: [github.com/Julio-Eyras/smartsignage-pro](https://github.com/Julio-Eyras/smartsignage-pro)  
**💬 Issues**: [github.com/Julio-Eyras/smartsignage-pro/issues](https://github.com/Julio-Eyras/smartsignage-pro/issues)

---

**🚀 Comece agora! Execute `./install-smartsignage.sh` e tenha seu sistema funcionando em minutos!**

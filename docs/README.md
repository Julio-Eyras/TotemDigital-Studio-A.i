# 🚀 Smart Signage Pro v2.1

**Sistema Completo de Sinalização Digital Profissional**  
*Implementação 100% Real - Zero Mocks - PostgreSQL Direto - Pronto para Produção*

---

## 📋 **VISÃO GERAL**

O **Smart Signage Pro v2.1** é um sistema completo e robusto de sinalização digital desenvolvido para empresas de todos os portes. Oferece funcionalidades profissionais para criar, gerenciar e exibir conteúdo digital de forma eficiente e escalável.

**v2.1:** Migração completa para PostgreSQL direto (Prisma removido) - Melhor performance e simplicidade.

### 🎯 **Status do Projeto**
- ✅ **Funcionalidades:** 100% implementadas
- ✅ **Serviços:** 20+ serviços completos
- ✅ **API REST:** 100+ endpoints
- ⚠️ **Qualidade:** Melhorias em andamento (logging, types, testes)

### 📋 **Estratégia de Logging**
O sistema utiliza uma estratégia híbrida de logging:
- **Arquivos locais**: Logs operacionais (erro, debug, execução) - Performance otimizada
- **Banco de dados**: Eventos importantes (playback, anúncios, BI, campanhas) - Auditoria completa

📚 **Documentação completa:** Veja `DOCUMENTACAO_ESTRATEGIA_LOGGING.md`

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

### 🏗️ **Backend (Node.js + TypeScript + PostgreSQL direto)**
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
- ✅ **7 Containers Orquestrados**:
  - PostgreSQL (banco de dados)
  - Redis (cache e sessões)
  - Backend Node.js (API)
  - Frontend React + Nginx Integrado (Interface + Proxy)
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

### **Instalação no Windows (PowerShell)**

Requisitos: Docker Desktop (Linux containers), Git, PowerShell como Administrador.

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
cd C:\SmartSignage-Pro
./scripts/install-windows.ps1

# Opções
# -InstallDir "D:\SmartSignage-Pro"  # caminho alternativo
# -ForceRebuild -NoCache              # rebuild completo
# -SkipClone                          # usar pasta existente (não clona)
```


### **Instalação Single-Server (com HTTPS opcional)**

```bash
# 1) Executar instalador com perguntas interativas
chmod +x install-smartsignage.sh
./install-smartsignage.sh

# Durante a instalação, escolha o modo:
#   1) Single-Server (SQLite)
#   2) Docker (PostgreSQL)
#   3) Desenvolvimento (SQLite)

# HTTPS (pergunta interativa):
#   1) Sem HTTPS (HTTP 80)
#   2) HTTPS autoassinado (teste)
#   3) HTTPS Let's Encrypt (produção, requer domínio)

# 2) Para forçar HTTPS autoassinado sem perguntar:
./install-smartsignage.sh --https-self-signed --skip-menu
```

### **Let's Encrypt (produção, com domínio público)**

- O instalador pergunta e, se escolhido, realiza:
  - Verificação de DNS do domínio
  - Emissão automática via Certbot (porta 80 aberta)
  - Configuração do Nginx com redireção 80→443
  - Renovação automática diária (cron)
- Se falhar ou não houver domínio: a instalação segue sem HTTPS (ou com autoassinado, se escolhido).

### **Após a Instalação**

O sistema estará disponível em:

- **Frontend/Interface**: `http://seu-servidor-ip` ou `http://localhost`
- **API Backend**: `http://seu-servidor-ip/api` ou `http://localhost/api`
- **Documentação da API (Swagger UI)**: `http://seu-servidor-ip/api-docs`
- **OpenAPI JSON**: `http://seu-servidor-ip/api/docs.json`
- **Player**: `http://seu-servidor-ip/player` ou `http://localhost/player`
- **Grafana**: `http://seu-servidor-ip:3002` (admin/admin)
- **Prometheus**: `http://seu-servidor-ip:9090`

Se HTTPS estiver ativo (autoassinado ou Let's Encrypt), use `https://`.

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

### **Systemd (Single-Server)**

```bash
# Serviço do backend
sudo systemctl status smart-signage
sudo systemctl start smart-signage
sudo systemctl stop smart-signage
sudo systemctl restart smart-signage

# Teste rápido da API
curl -s http://localhost:3000/health | jq .
```

### **Comandos Docker Compose Diretos**

```bash
cd /opt/smart-signage

# Ver status
docker compose ps

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f frontend  # inclui Nginx integrado

# Reiniciar um serviço
docker compose restart backend

# Rebuild após atualizações
docker compose build --no-cache
docker compose up -d
```

### **Nginx (Single-Server)**

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

### **Exemplos rápidos (cURL)**

```bash
# 1) Login (obter token JWT)
TOKEN=$(curl -s -X POST http://SEU_HOST:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.accessToken')

# 2) Upload de mídia (multipart/form-data)
curl -s -X POST http://SEU_HOST:3000/api/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F file=@./banner.jpg \
  -F name=banner_loja \
  -F description="Banner promocional" \
  -F tags="promo,blackfriday" \
  -F clientId=1 | jq .

# 3) Criar campanha
curl -s -X POST http://SEU_HOST:3000/api/campaigns \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "clientId": 1,
    "title": "Campanha Verão",
    "description": "Promoções de verão",
    "campaignType": "general",
    "startDate": "2025-12-01",
    "endDate": "2026-01-15",
    "isActive": true
  }' | jq .

# 4) Atribuir playlist a um player
curl -s -X POST http://SEU_HOST:3000/api/players/1001/playlist \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"playlistId":55}' | jq .

# 5) Enviar heartbeat de totem
curl -s -X POST http://SEU_HOST:3000/api/totems/2001/heartbeat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"online","uptime":3600,"memoryUsage":42.5}' | jq .

# 6) Health e OpenAPI
curl -s http://SEU_HOST:3000/health | jq .
curl -s http://SEU_HOST:3000/api/docs.json | jq '.info,.paths | keys | length'
```

### **Reexecutar checklist pós-instalação**

```bash
# Substitua HOST_OVERRIDE pelo IP ou domínio público
HOST_OVERRIDE=SEU_HOST bash scripts/post-install-check.sh
```

---

## 📊 **ARQUITETURA TÉCNICA**

### **Stack Tecnológico**

```
Frontend:     React 18 + TypeScript + Material-UI + Redux Toolkit
Backend:      Node.js 18 + Express + TypeScript + PostgreSQL direto (pg)
Database:     PostgreSQL 15 (produção)
Cache:        Redis 7
Proxy:        Nginx (2 containers: frontend + reverse proxy)
Monitoring:   Prometheus + Grafana
AI:           Ollama (IA local)
Container:    Docker + Docker Compose
```

### **Arquitetura de Containers (Simplificada)**

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

O player está configurado para se conectar automaticamente ao backend. Para configuração personalizada, edite `player-web/index.html`.

### **Arquivo de exemplo de ambiente**

- Caminho: `backend/env.example`
- Como usar: copie para `backend/.env` (em produção o instalador já cria na raiz de instalação `.env`).
- Variáveis principais:
  - `DATABASE_URL`: URL de conexão (PostgreSQL em Docker; SQLite em single-server/desenvolvimento)
  - `JWT_SECRET`: chave secreta para assinar JWT (gerada automaticamente no install)
  - `PORT`/`HOST`: porta e host do backend (padrão 3000/0.0.0.0)
  - `UPLOAD_PATH`, `UPLOAD_MAX_SIZE`: diretórios e limites de upload
  - `CORS_ORIGIN`: origens permitidas
  - `AI_PROVIDER`, `AI_MODEL`, `OLLAMA_BASE_URL`: provedor/modelo de IA

Consulte o arquivo `backend/env.example` para a lista completa e descrições comentadas.

### **Saúde e Diagnóstico Rápido**

```bash
# Saúde do backend
curl -s http://localhost:3000/health | jq .

# Saúde do Nginx (Docker)
docker compose logs --tail 50 nginx

# Saúde do Nginx (Single-Server)
sudo tail -n 50 /var/log/nginx/error.log

# OpenAPI JSON
curl -s http://localhost:3000/api/docs.json | jq '.info,.paths | keys | length'
```

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
- Importar dashboard de operação:
  - Em Grafana: Dashboards → Import → Upload JSON
  - Arquivo: `monitoring/grafana/dashboards/smartsignage-operations.json`
- Configurar alertas (Grafana Alerting):
  - Em Grafana: Alerting → Alert rules → Import/Provision
  - Arquivo: `monitoring/grafana/alerts/smartsignage-alerts.yaml`
  - Alternativamente, copie o YAML para a pasta de provisionamento do Grafana (ex.: `/etc/grafana/provisioning/alerting/`) e reinicie o Grafana.

### **Health Checks**

Todos os containers possuem health checks automáticos:
- Backend: `http://localhost:3000/health`
- Frontend: `http://localhost:${FRONTEND_INTERNAL_PORT:-8080}`
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
- Verifique conectividade: `docker exec smartsignage-frontend curl -s http://localhost:${FRONTEND_INTERNAL_PORT:-8080}`

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
docker exec smartsignage-frontend ping -c1 backend
docker exec smartsignage-frontend ping -c1 frontend
```

---

## 📚 **DOCUMENTAÇÃO ADICIONAL**

Documentação detalhada disponível no repositório:

- ~~[ARQUITETURA_NGINX.md](ARQUITETURA_NGINX.md)~~ (obsoleto)
  - Consulte: **[ARQUITETURA_NGINX_SIMPLIFICADA.md](ARQUITETURA_NGINX_SIMPLIFICADA.md)**
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

**Smart Signage Pro v2.1**  
**Status**: ✅ **100% Funcional - Pronto para Produção**

### **Últimas Melhorias (v2.1)**
- ✅ Migração completa Prisma → PostgreSQL direto
- ✅ Melhor performance com connection pooling nativo
- ✅ Código mais simples e manutenível
- ✅ Interface moderna completa (Material-UI)
- ✅ Zero mocks - implementação 100% real
- ✅ Arquitetura Nginx otimizada (2 containers)
- ✅ Sistema de monitoramento completo
- ✅ Instalação automatizada robusta
- ✅ Health checks em todos os serviços
- ✅ Backup automático configurado
- ✅ Documentação completa

---

**📅 Última Atualização**: 03 de Novembro de 2025  
**👥 Desenvolvido por**: Julio Eyras  
**🌐 Repositório**: [github.com/Julio-Eyras/smartsignage-pro](https://github.com/Julio-Eyras/smartsignage-pro)  
**💬 Issues**: [github.com/Julio-Eyras/smartsignage-pro/issues](https://github.com/Julio-Eyras/smartsignage-pro/issues)

---

**🚀 Comece agora! Execute `./install-smartsignage.sh` e tenha seu sistema funcionando em minutos!**

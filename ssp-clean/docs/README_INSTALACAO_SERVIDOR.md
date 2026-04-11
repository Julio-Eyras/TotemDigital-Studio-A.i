# 📘 GUIA RÁPIDO DE INSTALAÇÃO EM SERVIDOR

**SmartSignage-Pro v2.0** - Instalação via SSH em Servidor VPS/Dedicado

---

## 📍 ARQUIVOS TÉCNICOS DISPONÍVEIS

### 1. **INSTALACAO_VPS_SSH.md** ⭐
📄 Localização: `SmartSignage-Pro/INSTALACAO_VPS_SSH.md`

**Guia completo passo-a-passo** com todos os comandos necessários para instalar o SmartSignage-Pro em um servidor via SSH.

**Conteúdo**:
- ✅ Pré-requisitos do servidor
- ✅ Configuração inicial via SSH
- ✅ Instalação do Docker e Docker Compose
- ✅ Clonagem e preparação do projeto
- ✅ Configuração de variáveis de ambiente
- ✅ Configuração do Nginx (com SSL opcional)
- ✅ Build e deploy com Docker
- ✅ Verificação e testes
- ✅ Comandos úteis de gerenciamento
- ✅ Monitoramento (Grafana/Prometheus)
- ✅ Segurança e hardening
- ✅ Troubleshooting completo

---

### 2. **deploy-production.sh** 🚀
📄 Localização: `SmartSignage-Pro/scripts/deploy-production.sh`

**Script automatizado** para fazer deploy do projeto em um servidor remoto via SSH.

**Uso**:
```bash
# Na sua máquina LOCAL:
cd SmartSignage-Pro/scripts

# Executar deploy
SERVER_IP=192.168.1.100 ./deploy-production.sh

# Com usuário específico
SERVER_IP=192.168.1.100 SERVER_USER=ubuntu ./deploy-production.sh

# Com chave SSH
SERVER_IP=192.168.1.100 SSH_KEY=~/.ssh/id_rsa ./deploy-production.sh
```

**O que o script faz**:
- ✅ Testa conexão SSH
- ✅ Cria backup automático no servidor
- ✅ Faz upload do código
- ✅ Para containers antigos
- ✅ Atualiza arquivos (preserva .env e uploads)
- ✅ Rebuild das imagens Docker
- ✅ Inicia containers
- ✅ Verifica health check
- ✅ Mostra informações de acesso

---

### 3. **docker-compose.yml** 🐳
📄 Localização: `SmartSignage-Pro/docker-compose.yml`

**Orquestração completa** de todos os serviços em Docker.

**Serviços incluídos**:
- ✅ PostgreSQL (banco de dados)
- ✅ Backend (Node.js/TypeScript)
- ✅ Frontend (React)
- ✅ Nginx (reverse proxy)
- ✅ Ollama (IA local)
- ✅ Redis (cache)
- ✅ Prometheus (métricas)
- ✅ Grafana (dashboards)

**Uso**:
```bash
# Iniciar todos os serviços
docker compose up -d

# Ver logs
docker compose logs -f

# Parar serviços
docker compose down
```

---

### 4. **Dockerfiles Separados** 📦
📄 Localização: `SmartSignage-Pro/Dockerfile.backend` e `SmartSignage-Pro/Dockerfile.frontend`

**Imagens Docker** especializadas para cada serviço.

**Dockerfile.backend**:
- ✅ Multi-stage build (reduz tamanho final)
- ✅ Node.js 18 Alpine (leve)
- ✅ Usuário não-root (segurança)
- ✅ Health check integrado
- ✅ Timezone configurável

**Dockerfile.frontend**:
- ✅ Build React otimizado
- ✅ Nginx Alpine para servir frontend
- ✅ Configuração de proxy para API
- ✅ Compressão gzip
- ✅ Cache de assets

---

### 5. **env.example** ⚙️
📄 Localização: `SmartSignage-Pro/env.example`

**Template de configuração** com todas as variáveis de ambiente.

**Seções**:
- ✅ Servidor (PORT, HOST, NODE_ENV)
- ✅ Banco de Dados (DATABASE_URL)
- ✅ Autenticação (JWT_SECRET)
- ✅ Storage (UPLOAD_PATH)
- ✅ Redis (REDIS_URL)
- ✅ Email (SMTP)
- ✅ Logs (LOG_LEVEL)
- ✅ Segurança (CORS, Rate Limit)
- ✅ Player (configurações)
- ✅ Analytics, Backup, Monitoramento

**Uso**:
```bash
cp env.example .env
nano .env  # editar conforme necessário
```

---

### 6. **install.sh** 🔧
📄 Localização: `SmartSignage-Pro/scripts/install.sh`

**Script de instalação local** com 3 modos:
1. **Single-Server** (SQLite) - Servidor único
2. **Docker** (PostgreSQL) - Containerizado
3. **Development** - Ambiente de desenvolvimento

**Uso**:
```bash
cd SmartSignage-Pro/scripts
./install.sh
# Escolher opção 1, 2 ou 3
```

---

### 7. **first-boot.sh** ⚡
📄 Localização: `SmartSignage-Pro/scripts/first-boot.sh`

**Configuração inicial** automática do sistema após instalação.

**O que faz**:
- ✅ Gera UIN único do sistema
- ✅ Inicializa banco de dados
- ✅ Cria usuário admin padrão
- ✅ Configura permissões
- ✅ Baixa modelos de IA
- ✅ Configura logrotate
- ✅ Configura backup automático
- ✅ Configura monitoramento
- ✅ Configura rede

---

## 🚀 PROCESSO DE INSTALAÇÃO RECOMENDADO

### Opção 1: Manual (Passo-a-Passo)

```bash
# 1. Leia o guia completo
cat SmartSignage-Pro/INSTALACAO_VPS_SSH.md

# 2. Siga cada passo do guia
# O guia contém TODOS os comandos necessários
```

### Opção 2: Automatizada (Script de Deploy)

```bash
# 1. Configure as variáveis
export SERVER_IP="seu_ip_do_servidor"
export SERVER_USER="ubuntu"  # ou root
export SSH_KEY="~/.ssh/id_rsa"  # opcional

# 2. Execute o deploy
cd SmartSignage-Pro/scripts
./deploy-production.sh

# 3. Aguarde a conclusão (5-10 minutos)
```

---

## 📊 ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                 │
│                    Porta 80/443                          │
└────────────────┬────────────────────────────────────────┘
                 │
     ┌───────────┼───────────┬──────────────┐
     │           │           │              │
     ▼           ▼           ▼              ▼
┌─────────┐ ┌─────────┐ ┌─────────┐  ┌──────────┐
│Frontend │ │Backend  │ │Grafana  │  │Prometheus│
│React    │ │Node.js  │ │:3002    │  │:9090     │
│:80      │ │:3000    │ └─────────┘  └──────────┘
└─────────┘ └────┬────┘
                 │
     ┌───────────┼───────────┬──────────────┐
     │           │           │              │
     ▼           ▼           ▼              ▼
┌─────────┐ ┌─────────┐ ┌─────────┐  ┌──────────┐
│Postgres │ │Redis    │ │Ollama   │  │Storage   │
│:5432    │ │:6379    │ │:11434   │  │/uploads  │
└─────────┘ └─────────┘ └─────────┘  └──────────┘
```

---

## 🔐 PORTAS UTILIZADAS

| Porta | Serviço | Acesso Externo | Descrição |
|-------|---------|----------------|-----------|
| 80 | Nginx | ✅ Sim | HTTP |
| 443 | Nginx | ✅ Sim | HTTPS (SSL) |
| 3000 | Backend | ❌ Não | API (via Nginx) |
| 3001 | Frontend | ❌ Não | React (via Nginx) |
| 3002 | Grafana | ⚠️ Opcional | Monitoramento |
| 5432 | PostgreSQL | ❌ Não | Banco de dados |
| 6379 | Redis | ❌ Não | Cache |
| 9090 | Prometheus | ⚠️ Opcional | Métricas |
| 11434 | Ollama | ❌ Não | IA local |

---

## 📝 REQUISITOS MÍNIMOS DO SERVIDOR

### Produção (Recomendado):
- **OS**: Ubuntu 20.04+ ou Debian 11+
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Rede**: 100Mbps

### Desenvolvimento/Teste:
- **OS**: Ubuntu 20.04+ ou Debian 11+
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB
- **Rede**: 10Mbps

---

## 🌐 URLs DE ACESSO APÓS INSTALAÇÃO

Substitua `SEU_IP` pelo IP do seu servidor:

- 🎮 **Player**: `http://SEU_IP/player`
- 👨‍💼 **Admin Panel**: `http://SEU_IP/admin`
- 🔌 **API**: `http://SEU_IP/api`
- 💚 **Health Check**: `http://SEU_IP/health`
- 📊 **Grafana**: `http://SEU_IP:3002` (admin/admin)
- 📈 **Prometheus**: `http://SEU_IP:9090`

**WebSocket (Monitor em tempo real):** O painel usa `ws://SEU_IP/ws` para atualizações ao vivo. Se aparecer "Error during WebSocket handshake: Unexpected response code: 200", o Nginx não está a fazer proxy do `/ws` para o backend. Pode corrigir **sem refazer a instalação** executando no servidor: `sudo bash scripts/fix-nginx-websocket.sh` (o script adiciona ou confirma o bloco `location /ws` e recarrega o Nginx). O config gerado por `install-smartsignage.sh` já inclui este bloco; o script é útil quando o config em uso é outro ou foi criado antes de o /ws existir no instalador.

**Player – "Totem não encontrado" (404 em `/api/player/validate`):** O endpoint existe e responde. O 404 significa que o **UIN** do totem (ex.: `td-academia`) não está registrado no sistema. Cadastre o totem no painel em **Anunciantes → Publishers → Totens** (ou equivalente) com o mesmo UIN que o player envia, para a validação passar.

---

## 🔧 COMANDOS ESSENCIAIS

### No Servidor (via SSH):

```bash
# Navegar para o diretório
cd /opt/smart-signage

# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs backend -f

# Reiniciar todos os serviços
docker-compose restart

# Reiniciar um serviço específico
docker-compose restart backend

# Parar todos os serviços
docker-compose down

# Iniciar serviços
docker-compose up -d

# Fazer backup manual
docker-compose exec postgres pg_dump -U smartsignage smartsignage > backup_$(date +%Y%m%d).sql

# Acessar bash do backend
docker-compose exec backend sh

# Acessar PostgreSQL
docker-compose exec postgres psql -U smartsignage -d smartsignage
```

---

## ⚠️ SEGURANÇA - CHECKLIST

- [ ] Alterar senha do usuário admin
- [ ] Gerar JWT_SECRET forte (64+ caracteres)
- [ ] Alterar senha do PostgreSQL
- [ ] Configurar firewall (UFW)
- [ ] Instalar certificado SSL/HTTPS
- [ ] Configurar CORS apenas para domínios permitidos
- [ ] Ativar rate limiting
- [ ] Configurar Fail2Ban
- [ ] Desabilitar login root via SSH
- [ ] Usar autenticação por chave SSH
- [ ] Manter sistema atualizado
- [ ] Configurar backup automático

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **API Reference**: Disponível em `/api/docs` após instalação
- **Swagger UI**: Disponível em `/swagger`
- **Changelog**: Ver `CHANGELOG.md`
- **Troubleshooting**: Ver seção no `INSTALACAO_VPS_SSH.md`

---

## 💡 DICAS IMPORTANTES

1. **Sempre faça backup antes de atualizar**
2. **Use SSL/HTTPS em produção**
3. **Configure DNS para usar domínio próprio**
4. **Monitore logs regularmente**
5. **Configure alertas no Grafana**
6. **Mantenha Docker e containers atualizados**
7. **Use senhas fortes e únicas**
8. **Documente suas customizações**

---

## 🆘 SUPORTE E AJUDA

### Problemas Comuns:

**Container não inicia:**
```bash
docker-compose logs nome_do_servico
docker-compose down && docker-compose up -d
```

**Sem conexão com banco:**
```bash
docker-compose logs postgres
docker-compose restart postgres
```

**Erro 502 Bad Gateway:**
```bash
docker-compose logs backend nginx
```

**Memória insuficiente:**
```bash
docker system prune -a
free -h
```

### Logs Importantes:
- Backend: `docker-compose logs backend`
- PostgreSQL: `docker-compose logs postgres`
- Nginx: `docker-compose logs nginx`

---

## ✅ VERIFICAÇÃO PÓS-INSTALAÇÃO

Execute estes testes após a instalação:

```bash
# 1. Health check
curl http://SEU_IP/health

# 2. API funcionando
curl http://SEU_IP/api

# 3. Banco conectado
docker-compose exec postgres pg_isready -U smartsignage

# 4. Containers rodando
docker-compose ps

# 5. Acesso web
# Abrir navegador em http://SEU_IP/admin
```

---

**🎉 PRONTO PARA USAR!**

Com estes arquivos técnicos, você tem **tudo o que precisa** para instalar o SmartSignage-Pro em um servidor via SSH em modo dockerizado.

**Escolha o método:**
1. **Manual**: Siga o guia `INSTALACAO_VPS_SSH.md`
2. **Automatizado**: Use o script `deploy-production.sh`

Ambos resultam em um sistema completo e funcional em produção!

---

**Data**: 22 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Documentação Completa


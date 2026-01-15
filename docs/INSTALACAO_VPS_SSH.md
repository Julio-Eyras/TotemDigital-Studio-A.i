# 🚀 GUIA DE INSTALAÇÃO VIA SSH - SMARTSIGNAGE-PRO
**Versão**: 2.0  
**Ambiente**: Servidor VPS/Dedicado via SSH  
**Deploy**: Docker Compose (Produção)

## ⚡ INSTALAÇÃO RÁPIDA (Recomendado)

Para instalação automática, use o script:
```bash
./scripts/install-smartsignage.sh
```

**O script automatizado inclui:**
- ✅ Instalação automática de dependências
- ✅ Configuração de Docker e Docker Compose v2
- ✅ Build e teste de containers
- ✅ Configuração de autostart
- ✅ Teste de endpoints
- ✅ Scripts de gerenciamento
- ✅ 3 modos: Single-Server, Docker, Desenvolvimento

## 📚 INSTALAÇÃO MANUAL (Para Aprendizado)

Se preferir instalar manualmente ou entender cada passo, continue com este guia...

---

## 📋 PRÉ-REQUISITOS

### Servidor VPS/Dedicado:
- ✅ **OS**: Ubuntu 20.04+ ou Debian 11+ (64-bit)
- ✅ **CPU**: 2+ cores (4+ recomendado)
- ✅ **RAM**: 4GB mínimo (8GB recomendado)
- ✅ **Storage**: 50GB mínimo (100GB+ recomendado)
- ✅ **Rede**: IP público estático
- ✅ **Portas**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### Sua Máquina Local:
- ✅ Cliente SSH (OpenSSH, PuTTY, etc.)
- ✅ Git instalado
- ✅ Acesso root ou sudo no servidor

---

## 🔑 PASSO 1: ACESSO SSH INICIAL

### 1.1 Conectar ao Servidor

```bash
# Conectar via SSH
ssh root@SEU_IP_DO_SERVIDOR
# ou com usuário não-root
ssh seu_usuario@SEU_IP_DO_SERVIDOR

# Se usar chave SSH
ssh -i /caminho/para/chave.pem usuario@SEU_IP_DO_SERVIDOR
```

### 1.2 Atualizar Sistema

```bash
# Atualizar lista de pacotes
sudo apt update && sudo apt upgrade -y

# Instalar pacotes essenciais
sudo apt install -y curl wget git vim nano htop ufw
```

### 1.3 Configurar Firewall

```bash
# Resetar firewall
sudo ufw --force reset

# Configurar regras
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Ativar firewall
sudo ufw --force enable

# Verificar status
sudo ufw status
```

---

## 🐳 PASSO 2: INSTALAÇÃO DO DOCKER

### 2.1 Instalar Docker

```bash
# Remover versões antigas (se existirem)
sudo apt remove docker docker-engine docker.io containerd runc

# Instalar dependências
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Adicionar chave GPG oficial do Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Adicionar repositório do Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Atualizar índice de pacotes
sudo apt update

# Instalar Docker Engine
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar instalação
docker --version
```

**Saída esperada**: `Docker version 24.0.x, build xxxxx`

### 2.2 Instalar Docker Compose

```bash
# Verificar se Docker Compose está disponível
docker compose version
```

**Saída esperada**: `Docker Compose version v2.x.x`

**Nota**: O Docker Compose v2 já vem incluído com o Docker Engine moderno. Se não estiver disponível, instale:

```bash
# Instalar Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verificar instalação
docker compose version
```

### 2.3 Adicionar Usuário ao Grupo Docker

```bash
# Adicionar usuário atual ao grupo docker
sudo usermod -aG docker $USER

# Aplicar alterações (ou fazer logout/login)
newgrp docker

# Testar sem sudo
docker ps
```

---

## 📦 PASSO 3: CLONAR E PREPARAR O PROJETO

### 3.1 Criar Diretório de Instalação

```bash
# Criar diretório para o projeto
sudo mkdir -p /opt/smart-signage
cd /opt/smart-signage

# Dar permissões ao usuário atual
sudo chown -R $USER:$USER /opt/smart-signage
```

### 3.2 Clonar Repositório

**Opção A: Se já tem o projeto localmente, fazer upload via SCP**

```bash
# Na sua máquina LOCAL (não no servidor):
cd /caminho/local/Smart-Signage-main
tar -czf smartsignage-pro.tar.gz SmartSignage-Pro/
scp smartsignage-pro.tar.gz usuario@SEU_IP:/opt/smart-signage/

# No SERVIDOR:
cd /opt/smart-signage
tar -xzf smartsignage-pro.tar.gz
mv SmartSignage-Pro/* .
rm -rf SmartSignage-Pro smartsignage-pro.tar.gz
```

**Opção B: Clonar do Git (se tiver repositório)**

```bash
cd /opt/smart-signage
git clone https://github.com/seu-usuario/Smart-Signage.git .
# ou
git clone git@github.com:seu-usuario/Smart-Signage.git .
```

### 3.3 Verificar Estrutura

```bash
# Listar arquivos
ls -la

# Estrutura esperada:
# backend/
# frontend/
# database/
# docker/
# nginx/
# monitoring/
# scripts/
# docker-compose.yml
# Dockerfile
# env.example
```

---

## ⚙️ PASSO 4: CONFIGURAÇÃO DO AMBIENTE

### 4.1 Criar Arquivo .env

```bash
# Copiar exemplo
cp env.example .env

# Editar com nano ou vim
nano .env
```

### 4.2 Configurar Variáveis Essenciais

```bash
# ====================================
# CONFIGURAÇÕES OBRIGATÓRIAS
# ====================================

# Ambiente
NODE_ENV=production

# Banco de Dados
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://smartsignage:SENHA_FORTE_AQUI@postgres:5432/smartsignage

# Segurança (GERAR NOVOS VALORES!)
JWT_SECRET=$(openssl rand -base64 64)
PLAYER_ABANDON_PIN=$(shuf -i 1000-9999 -n 1)

# Servidor
PORT=3000
HOST=0.0.0.0

# CORS (substituir pelo IP/domínio real)
CORS_ORIGIN=http://SEU_IP,https://SEU_DOMINIO.com

# Logs
LOG_LEVEL=info

# ====================================
# CONFIGURAÇÕES OPCIONAIS
# ====================================

# AI (se quiser usar)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434

# Email (configurar se necessário)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
```

**💡 Gerar JWT Secret forte:**

```bash
openssl rand -base64 64
```

**💡 Gerar PIN de abandono aleatório:**

```bash
shuf -i 1000-9999 -n 1
```

### 4.3 Criar Diretórios Necessários

```bash
# Criar diretórios para volumes Docker
mkdir -p public/assets/uploads
mkdir -p logs
mkdir -p backups
mkdir -p ml-models
mkdir -p database

# Criar diretórios para Nginx
mkdir -p nginx/ssl

# Definir permissões
chmod -R 755 public logs backups ml-models
```

---

## 🏗️ PASSO 5: CONFIGURAR NGINX (SSL OPCIONAL)

### 5.1 Criar Configuração Nginx

```bash
# Criar arquivo de configuração
nano nginx/nginx.conf
```

**Cole o seguinte conteúdo:**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Upstream Backend
    upstream backend {
        server backend:3000;
    }

    # Upstream Frontend
    upstream frontend {
        server frontend:80;
    }

    # Servidor HTTP (porta 80)
    server {
        listen 80;
        server_name _;

        # Redirecionar para HTTPS (descomente se tiver SSL)
        # return 301 https://$server_name$request_uri;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # API Backend
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Health Check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        # Player
        location /player {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Admin Panel (Frontend)
        location /admin {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Frontend (root)
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Static Assets
        location /assets/ {
            alias /usr/share/nginx/html/assets/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Servidor HTTPS (porta 443) - Descomente se tiver SSL
    # server {
    #     listen 443 ssl http2;
    #     server_name SEU_DOMINIO.com;

    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #     ssl_prefer_server_ciphers on;

    #     # ... (mesmas configurações do servidor HTTP)
    # }
}
```

### 5.2 SSL/HTTPS com Let's Encrypt (OPCIONAL mas RECOMENDADO)

```bash
# Instalar Certbot
sudo apt install -y certbot

# Gerar certificado (substitua SEU_DOMINIO.com)
sudo certbot certonly --standalone -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com

# Copiar certificados para o diretório do projeto
sudo cp /etc/letsencrypt/live/SEU_DOMINIO.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/SEU_DOMINIO.com/privkey.pem nginx/ssl/key.pem

# Dar permissões
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem

# Renovação automática (configurar cron)
sudo crontab -e
# Adicionar linha:
# 0 0 * * * certbot renew --quiet && docker compose -f /opt/smart-signage/docker-compose.yml restart nginx
```

---

## 🚀 PASSO 6: BUILD E DEPLOY COM DOCKER

### 6.1 Nova Arquitetura Separada

O SmartSignage-Pro v2.0 utiliza uma **arquitetura separada** com containers especializados:

#### **Containers Especializados:**
- **`postgres`**: Banco de dados PostgreSQL
- **`backend`**: API Node.js (apenas backend)
- **`frontend`**: Interface React (apenas frontend)
- **`nginx`**: Proxy reverso e servidor web
- **`redis`**: Cache e sessões
- **`ollama`**: Serviço de IA
- **`prometheus`**: Monitoramento
- **`grafana`**: Dashboards

#### **Dockerfiles Separados:**
- **`Dockerfile.backend`**: Container especializado para backend
- **`Dockerfile.frontend`**: Container especializado para frontend

#### **Volumes Separados:**
- **`postgres_data`**: Dados do banco
- **`backend_uploads`**: Uploads do backend
- **`backend_logs`**: Logs do backend
- **`backend_data`**: Dados do backend
- **`frontend_assets`**: Assets do frontend
- **`ollama_data`**: Modelos de IA
- **`redis_data`**: Cache Redis
- **`prometheus_data`**: Métricas
- **`grafana_data`**: Dashboards

### 6.2 Verificar Docker Compose

```bash
# Verificar sintaxe do docker-compose.yml
cd /opt/smart-signage
docker compose config
```

### 6.3 Build das Imagens

```bash
# Build de todas as imagens (nova arquitetura)
docker compose build

# Ou build com cache limpo
docker compose build --no-cache
```

**⏱️ Tempo estimado**: 5-10 minutos

**Saída esperada:**

```text
REPOSITORY              TAG       IMAGE ID       CREATED         SIZE
smart-signage-backend   latest    xxxxx          x minutes ago   xxxMB
smart-signage-frontend  latest    xxxxx          x minutes ago   xxxMB
```

### 6.4 Teste de Build (Novo)

```bash
# Testar build antes do deploy
docker compose build --no-cache

# Verificar se os Dockerfiles existem
ls -la Dockerfile*
```

**Arquivos esperados:**
- `Dockerfile.backend` - Container do backend
- `Dockerfile.frontend` - Container do frontend

### 6.5 Iniciar Serviços na Ordem Correta (Novo)

```bash
# Iniciar serviços na ordem de dependências
docker compose up -d postgres
docker compose up -d redis
docker compose up -d ollama
docker compose up -d backend
docker compose up -d frontend
docker compose up -d nginx
docker compose up -d prometheus
docker compose up -d grafana

# Ou iniciar todos de uma vez (com dependências)
docker compose up -d

# Ver logs durante a inicialização
docker compose logs -f
```

**Serviços que serão iniciados:**
- ✅ `postgres` - Banco de dados PostgreSQL
- ✅ `backend` - API Backend (Node.js)
- ✅ `frontend` - Interface Admin (React)
- ✅ `nginx` - Reverse Proxy
- ✅ `ollama` - Serviço de IA local
- ✅ `redis` - Cache (opcional)
- ✅ `prometheus` - Monitoramento
- ✅ `grafana` - Dashboards

### 6.4 Verificar Status dos Containers

```bash
# Ver containers em execução
docker-compose ps

# Ver logs de todos os serviços
docker-compose logs

# Ver logs de um serviço específico
docker-compose logs backend -f
docker-compose logs postgres -f
docker-compose logs nginx -f
```

**✅ Status esperado**: Todos os serviços devem estar `Up`

---

## 🔍 PASSO 7: VERIFICAÇÃO E TESTES

### 7.1 Scripts de Gerenciamento (Novo)

O sistema agora inclui scripts especializados para gerenciamento:

```bash
# Navegar para diretório de scripts
cd /opt/smart-signage/scripts

# Listar scripts disponíveis
ls -la *.sh
```

**Scripts disponíveis:**
- **`start-system.sh`** - Iniciar sistema
- **`stop-system.sh`** - Parar sistema
- **`restart-system.sh`** - Reiniciar sistema
- **`status-system.sh`** - Verificar status
- **`logs-system.sh`** - Ver logs
- **`health-check.sh`** - Verificação completa de saúde
- **`backup-system.sh`** - Backup do sistema
- **`update-system.sh`** - Atualizar sistema
- **`autostart-system.sh`** - Configurar autostart
- **`debug-backend.sh`** - Debug do backend
- **`fix-backend.sh`** - Corrigir problemas do backend
- **`rebuild-architecture.sh`** - Rebuild da arquitetura

### 7.2 Verificar Health Checks

```bash
# Usar script de health check
./scripts/health-check.sh

# Ou verificar manualmente
curl http://localhost:3000/health
curl http://localhost/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-22T...",
  "uptime": 123,
  "database": "connected"
}
```

### 7.2 Verificar Banco de Dados

```bash
# Acessar container do PostgreSQL
docker-compose exec postgres psql -U smartsignage -d smartsignage

# Dentro do PostgreSQL:
# Listar tabelas
\dt

# Ver usuários
SELECT * FROM users;

# Sair
\q
```

### 7.3 Criar Usuário Admin

```bash
# Executar criação de usuário admin via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123!@#",
    "role": "admin"
  }'
```

### 7.4 Testar Login

```bash
# Fazer login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123!@#"
  }'
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

## 🔧 PASSO 8: CONFIGURAÇÃO DE AUTOSTART

### 8.1 Autostart Automático (Novo)

O script automatizado já configura o autostart, mas você pode fazer manualmente:

```bash
# Usar script de autostart
./scripts/autostart-system.sh

# Ou configurar manualmente
```

### 8.2 Criar Serviço Systemd (Manual)

```bash
# Criar arquivo de serviço
sudo tee /etc/systemd/system/smart-signage.service > /dev/null <<EOF
[Unit]
Description=Smart Signage Pro
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/smart-signage
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar serviço
sudo systemctl enable smart-signage.service

# Verificar status
sudo systemctl status smart-signage.service
```

### 8.3 Verificar Autostart

```bash
# Verificar se o serviço está habilitado
sudo systemctl is-enabled smart-signage.service

# Testar reinicialização
sudo systemctl restart smart-signage.service

# Verificar logs
sudo journalctl -u smart-signage.service -f
```

---

## 🌐 PASSO 9: ACESSAR O SISTEMA

### 9.1 URLs de Acesso (Atualizadas)

**Via IP do Servidor:**
- 🎮 **Player**: `http://SEU_IP/player`
- 👨‍💼 **Admin Panel**: `http://SEU_IP/admin` (via Nginx)
- 👨‍💼 **Admin Panel Direto**: `http://SEU_IP:3001` (Frontend direto)
- 🔌 **API Backend**: `http://SEU_IP:3000` (Backend direto)
- 🔌 **API via Nginx**: `http://SEU_IP/api` (via Nginx)
- 💚 **Health Check**: `http://SEU_IP/health`
- 📊 **Grafana**: `http://SEU_IP:3002`
- 📈 **Prometheus**: `http://SEU_IP:9090`

**Via Domínio (se configurou DNS):**
- 🎮 **Player**: `https://SEU_DOMINIO.com/player`
- 👨‍💼 **Admin Panel**: `https://SEU_DOMINIO.com/admin`
- 🔌 **API**: `https://SEU_DOMINIO.com/api`

### 9.2 Credenciais Padrão

```text
Usuário: admin
Senha: admin123!@# (ou a que você definiu)
```

**⚠️ IMPORTANTE**: Altere a senha após o primeiro login!

---

## 🔧 PASSO 9: COMANDOS ÚTEIS

### 9.1 Gerenciamento de Containers

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs backend -f

# Reiniciar todos os serviços
docker-compose restart

# Reiniciar um serviço específico
docker-compose restart backend

# Parar todos os serviços
docker-compose stop

# Iniciar serviços parados
docker-compose start

# Parar e remover containers
docker-compose down

# Parar, remover containers e volumes
docker-compose down -v
```

### 9.2 Acessar Containers

```bash
# Acessar bash do backend
docker-compose exec backend sh

# Acessar bash do frontend
docker-compose exec frontend sh

# Acessar PostgreSQL
docker-compose exec postgres psql -U smartsignage -d smartsignage
```

### 9.3 Backup Manual

```bash
# Backup do banco de dados
docker-compose exec postgres pg_dump -U smartsignage smartsignage > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup de uploads
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz public/assets/uploads/

# Backup completo
tar -czf smartsignage_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  .env \
  public/assets/uploads/ \
  logs/ \
  backups/ \
  database/
```

### 9.4 Restaurar Backup

```bash
# Restaurar banco de dados
cat backup_YYYYMMDD_HHMMSS.sql | docker-compose exec -T postgres psql -U smartsignage -d smartsignage

# Restaurar uploads
tar -xzf uploads_backup_YYYYMMDD_HHMMSS.tar.gz -C /opt/smart-signage/
```

### 9.5 Atualizar Sistema

```bash
# Fazer backup antes de atualizar!
cd /opt/smart-signage

# Baixar atualizações (se usar Git)
git pull

# Rebuild e reiniciar
docker-compose down
docker-compose build
docker-compose up -d

# Verificar logs
docker-compose logs -f
```

---

## 📊 PASSO 10: MONITORAMENTO

### 10.1 Acessar Grafana

```
URL: http://SEU_IP:3002
Usuário: admin
Senha: admin
```

### 10.2 Acessar Prometheus

```
URL: http://SEU_IP:9090
```

### 10.3 Configurar Alertas (OPCIONAL)

```bash
# Editar configuração do Prometheus
nano monitoring/prometheus/prometheus.yml

# Adicionar regras de alerta
nano monitoring/prometheus/alerts.yml

# Reiniciar Prometheus
docker-compose restart prometheus
```

---

## 🔒 PASSO 11: SEGURANÇA

### 11.1 Alterar Senhas Padrão

```bash
# Alterar senha do admin no sistema
# (fazer via interface web após login)

# Alterar senha do PostgreSQL
docker-compose exec postgres psql -U postgres
ALTER USER smartsignage WITH PASSWORD 'NOVA_SENHA_FORTE';
\q

# Atualizar .env com nova senha
nano .env
# Alterar linha: DATABASE_URL=postgresql://smartsignage:NOVA_SENHA_FORTE@postgres:5432/smartsignage

# Reiniciar backend
docker-compose restart backend
```

### 11.2 Configurar Fail2Ban (OPCIONAL)

```bash
# Instalar Fail2Ban
sudo apt install -y fail2ban

# Criar configuração local
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /opt/smart-signage/logs/*.log
```

```bash
# Reiniciar Fail2Ban
sudo systemctl restart fail2ban

# Ver status
sudo fail2ban-client status
```

---

## ❗ TROUBLESHOOTING

### Scripts de Troubleshooting (Novo)

```bash
# Debug completo do backend
./scripts/debug-backend.sh

# Corrigir problemas comuns
./scripts/fix-backend.sh

# Rebuild da arquitetura
./scripts/rebuild-architecture.sh

# Verificação completa de saúde
./scripts/health-check.sh
```

### Problema: Container não inicia

```bash
# Ver logs detalhados
docker compose logs backend

# Verificar se portas estão em uso
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :5432

# Recriar containers
docker compose down
docker compose up -d
```

### Problema: Erro de conexão com banco

```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Verificar logs do PostgreSQL
docker compose logs postgres

# Testar conexão manualmente
docker compose exec postgres pg_isready -U smartsignage
```

### Problema: Sem espaço em disco

```bash
# Limpar imagens não utilizadas
docker system prune -a

# Limpar volumes não utilizados
docker volume prune

# Ver uso de disco
df -h
du -sh /opt/smart-signage/*
```

### Problema: Memória insuficiente

```bash
# Ver uso de memória
free -h

# Ver uso por container
docker stats

# Limitar memória de containers (editar docker-compose.yml)
# Adicionar em cada serviço:
#   mem_limit: 512m
#   memswap_limit: 512m
```

---

## 📝 CHECKLIST FINAL

- [ ] Docker e Docker Compose instalados
- [ ] Firewall configurado (portas 80, 443, 22)
- [ ] Projeto clonado/copiado para /opt/smart-signage
- [ ] Arquivo .env criado e configurado
- [ ] JWT_SECRET gerado com forte entropia
- [ ] Nginx configurado (com ou sem SSL)
- [ ] Containers iniciados com `docker-compose up -d`
- [ ] Health check retornando "ok"
- [ ] Usuário admin criado
- [ ] Login testado e funcionando
- [ ] Senha padrão alterada
- [ ] Backup configurado
- [ ] Monitoramento acessível (Grafana/Prometheus)
- [ ] DNS configurado (se aplicável)
- [ ] SSL/HTTPS configurado (se aplicável)

---

## 📞 SUPORTE

### Logs Importantes:
- **Backend**: `docker-compose logs backend -f`
- **PostgreSQL**: `docker-compose logs postgres -f`
- **Nginx**: `docker-compose logs nginx -f`

### Arquivos de Configuração:
- **Variáveis de ambiente**: `/opt/smart-signage/.env`
- **Docker Compose**: `/opt/smart-signage/docker-compose.yml`
- **Nginx**: `/opt/smart-signage/nginx/nginx.conf`

---

**🎉 INSTALAÇÃO CONCLUÍDA!**

Seu SmartSignage-Pro está rodando em produção via Docker!

**Próximos Passos:**
1. Acesse `http://SEU_IP/admin`
2. Faça login com admin
3. Configure seu primeiro cliente
4. Crie campanhas e adicione mídia
5. Configure totens

---

## ✅ CONCLUSÃO

Sistema instalado e funcionando! 🎉

### 🆕 Novidades da Versão 2.0

**Arquitetura Separada:**
- ✅ Containers especializados (backend, frontend, database)
- ✅ Dockerfiles separados para cada serviço
- ✅ Volumes dedicados para cada componente
- ✅ Melhor isolamento e segurança

**Scripts de Gerenciamento:**
- ✅ Scripts especializados para cada operação
- ✅ Autostart automático configurado
- ✅ Health checks integrados
- ✅ Troubleshooting automatizado

**Docker Compose v2:**
- ✅ Sintaxe moderna e otimizada
- ✅ Melhor performance
- ✅ Recursos avançados

**Próximos passos:**
1. Acesse o admin panel
2. Configure suas campanhas
3. Adicione mídias
4. Configure totems
5. Monitore via Grafana

**Suporte:**
- 📧 Email: suporte@smartsignage.com
- 📚 Docs: https://docs.smartsignage.com
- 🐛 Issues: https://github.com/smartsignage/issues

---

**Data do Documento**: 25 de Outubro de 2025  
**Versão**: 2.0  
**Status**: ✅ Completo e Atualizado


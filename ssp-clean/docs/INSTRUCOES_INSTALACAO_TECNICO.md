# Smart Signage Pro v2.1 - Instruções Técnicas de Instalação

## 📋 Visão Geral

Este documento contém instruções detalhadas para técnicos instalarem o Smart Signage Pro v2.1 em sistemas Ubuntu. O sistema suporta 3 modos de instalação:

1. **Single-Server** (Appliance dedicado)
2. **Docker** (Produção)
3. **Desenvolvimento** (Local)

---

## 🎯 Pré-requisitos

### Sistema Operacional
- **Ubuntu 20.04 LTS** ou superior
- **4GB RAM** mínimo (8GB recomendado)
- **20GB espaço em disco** mínimo
- **Acesso à internet** para download de dependências

### Hardware Recomendado
- **CPU**: 2 cores mínimo (4 cores recomendado)
- **RAM**: 4GB mínimo (8GB recomendado)
- **Disco**: 20GB SSD mínimo (50GB recomendado)
- **Rede**: Conexão estável com internet

---

## 🚀 Instalação Automática (Recomendada)

### Passo 1: Preparar o Sistema
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git unzip
```

### Passo 2: Baixar e Executar Script
```bash
# Baixar o projeto (se ainda não tiver)
git clone https://github.com/seu-repositorio/smartsignage-pro.git
cd smartsignage-pro

# Tornar o script executável
chmod +x install-smartsignage.sh

# Executar instalação
./scripts/install-smartsignage.sh
```

### Passo 3: Selecionar Modo de Instalação
O script apresentará um menu com 3 opções:

```
Selecione o modo de instalação:
1) Single-Server (Appliance dedicado - SQLite)
2) Docker (Produção - PostgreSQL)  
3) Desenvolvimento (Local - SQLite)
```

**Recomendações:**
- **Opção 1**: Para totems únicos ou appliances dedicados
- **Opção 2**: Para ambientes de produção com múltiplos totems
- **Opção 3**: Para desenvolvimento e testes

---

## 🔧 Instalação Manual (Avançada)

### Modo Single-Server

#### 1. Instalar Node.js
```bash
# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version  # Deve ser v18.x ou superior
npm --version
```

#### 2. Instalar Dependências do Sistema
```bash
sudo apt install -y \
    nginx \
    sqlite3 \
    ufw \
    build-essential \
    python3 \
    python3-pip
```

#### 3. Configurar Projeto
```bash
# Criar diretório de instalação
sudo mkdir -p /opt/smart-signage
sudo chown $USER:$USER /opt/smart-signage

# Copiar arquivos do projeto
cp -r backend /opt/smart-signage/
cp -r frontend /opt/smart-signage/
cp -r player /opt/smart-signage/
cp -r scripts /opt/smart-signage/
cp -r database /opt/smart-signage/
cp docker-compose.yml /opt/smart-signage/
cp env.example /opt/smart-signage/.env
```

#### 4. Instalar Dependências do Projeto
```bash
cd /opt/smart-signage/backend
npm install --production
```

#### 5. Compilar Backend
```bash
npm run build
```

#### 6. Configurar Banco de Dados
```bash
# Criar diretório de dados
mkdir -p /opt/smart-signage/data

# Inicializar banco SQLite
(cd /opt/smart-signage/database && psql "$DATABASE_URL" -f smartchannel-db-v2-refactored-apply-all.sql)
```

#### 7. Configurar Variáveis de Ambiente
```bash
# Editar arquivo .env
nano /opt/smart-signage/.env
```

Configuração mínima:
```env
# Modo de instalação
INSTALL_MODE=single-server

# Banco de dados
DB_DRIVER=sqlite
DATABASE_URL=file:/opt/smart-signage/data/smartsignage.db

# Servidor
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Autenticação
JWT_SECRET=seu-jwt-secret-aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Player
PLAYER_ABANDON_PIN=1234
```

#### 8. Configurar Nginx
```bash
# Criar configuração do Nginx
sudo nano /etc/nginx/sites-available/smart-signage
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root /opt/smart-signage/frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Player
    location /player/ {
        alias /opt/smart-signage/player/;
        try_files $uri $uri/ /player-web/index.html;
    }
}
```

Ativar configuração:
```bash
sudo ln -s /etc/nginx/sites-available/smart-signage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

#### 9. Criar Serviço Systemd
```bash
sudo nano /etc/systemd/system/smart-signage.service
```

Conteúdo:
```ini
[Unit]
Description=Smart Signage Pro Backend
After=network.target

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/opt/smart-signage/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/smart-signage/.env

[Install]
WantedBy=multi-user.target
```

Ativar serviço:
```bash
sudo systemctl daemon-reload
sudo systemctl enable smart-signage
sudo systemctl start smart-signage
```

#### 10. Configurar Firewall
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Backend
sudo ufw --force enable
```

---

### Modo Docker

#### 1. Instalar Docker
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Fazer logout e login novamente
```

#### 2. Configurar Projeto
```bash
# Criar diretório de instalação
sudo mkdir -p /opt/smart-signage
sudo chown $USER:$USER /opt/smart-signage

# Copiar arquivos do projeto
cp -r . /opt/smart-signage/
cd /opt/smart-signage
```

#### 3. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar configurações
nano .env
```

Configuração para Docker:
```env
# Modo de instalação
INSTALL_MODE=docker

# Banco de dados
DB_DRIVER=postgresql
DATABASE_URL=postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage

# Servidor
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Autenticação
JWT_SECRET=seu-jwt-secret-aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Player
PLAYER_ABANDON_PIN=1234

# IA
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://ollama:11434
```

#### 4. Criar Diretórios Necessários
```bash
mkdir -p logs backups public/assets/uploads ml-models
```

#### 5. Iniciar Serviços
```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps
```

#### 6. Configurar Firewall
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Backend
sudo ufw allow 3001/tcp  # Frontend
sudo ufw allow 5432/tcp  # PostgreSQL
sudo ufw allow 6379/tcp  # Redis
sudo ufw allow 9090/tcp  # Prometheus
sudo ufw allow 3002/tcp  # Grafana
sudo ufw --force enable
```

---

## 🔍 Verificação da Instalação

### Verificar Serviços
```bash
# Single-Server
sudo systemctl status smart-signage
sudo systemctl status nginx

# Docker
docker-compose ps
```

### Verificar Logs
```bash
# Single-Server
sudo journalctl -u smart-signage -f

# Docker
docker-compose logs -f
```

### Testar Acesso
```bash
# Testar backend
curl http://localhost:3000/health

# Testar frontend
curl http://localhost:80

# Testar player
curl http://localhost:80/player
```

---

## 🌐 Configuração de Acesso

### URLs de Acesso
- **Frontend**: `http://IP_DO_SERVIDOR:80`
- **Backend**: `http://IP_DO_SERVIDOR:3000`
- **Player**: `http://IP_DO_SERVIDOR:80/player`

### Credenciais Padrão
- **Usuário**: `admin`
- **Senha**: `admin`

⚠️ **IMPORTANTE**: Altere a senha padrão após o primeiro login!

---

## 🛠️ Gerenciamento do Sistema

### Script de Gerenciamento
O sistema inclui um script de gerenciamento em `/opt/smart-signage/manage.sh`:

```bash
# Iniciar sistema
/opt/smart-signage/manage.sh start

# Parar sistema
/opt/smart-signage/manage.sh stop

# Reiniciar sistema
/opt/smart-signage/manage.sh restart

# Ver status
/opt/smart-signage/manage.sh status

# Ver logs
/opt/smart-signage/manage.sh logs

# Atualizar sistema
/opt/smart-signage/manage.sh update

# Criar backup
/opt/smart-signage/manage.sh backup
```

### Comandos Úteis

#### Single-Server
```bash
# Status do serviço
sudo systemctl status smart-signage

# Logs em tempo real
sudo journalctl -u smart-signage -f

# Reiniciar serviço
sudo systemctl restart smart-signage

# Parar serviço
sudo systemctl stop smart-signage

# Iniciar serviço
sudo systemctl start smart-signage
```

#### Docker
```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Reiniciar todos os serviços
docker-compose restart

# Parar todos os serviços
docker-compose down

# Iniciar todos os serviços
docker-compose up -d

# Rebuild e iniciar
docker-compose up -d --build
```

---

## 🔧 Solução de Problemas

### Problemas Comuns

#### 1. Erro de Permissão
```bash
# Verificar permissões
ls -la /opt/smart-signage/

# Corrigir permissões
sudo chown -R $USER:$USER /opt/smart-signage/
```

#### 2. Porta em Uso
```bash
# Verificar portas em uso
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80

# Matar processo se necessário
sudo kill -9 PID_DO_PROCESSO
```

#### 3. Erro de Banco de Dados
```bash
# Verificar banco SQLite
sqlite3 /opt/smart-signage/data/smartsignage.db ".tables"

# Recriar banco se necessário
rm /opt/smart-signage/data/smartsignage.db
(cd /opt/smart-signage/database && psql "$DATABASE_URL" -f smartchannel-db-v2-refactored-apply-all.sql)
```

#### 4. Erro de Nginx
```bash
# Testar configuração
sudo nginx -t

# Recarregar configuração
sudo systemctl reload nginx

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

#### 5. Erro de Docker
```bash
# Verificar status do Docker
sudo systemctl status docker

# Reiniciar Docker
sudo systemctl restart docker

# Limpar containers órfãos
docker system prune -f
```

### Logs Importantes

#### Single-Server
- **Aplicação**: `sudo journalctl -u smart-signage -f`
- **Nginx**: `sudo tail -f /var/log/nginx/error.log`
- **Sistema**: `sudo tail -f /var/log/syslog`

#### Docker
- **Aplicação**: `docker-compose logs -f`
- **Container específico**: `docker-compose logs -f backend`
- **Docker**: `sudo journalctl -u docker -f`

---

## 🔒 Configuração de Segurança

### SSL/HTTPS (Produção)
```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d seu-dominio.com

# Renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Avançado
```bash
# Configurar regras específicas
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 443
sudo ufw deny 22
```

### Backup Automático
```bash
# Criar script de backup
sudo nano /opt/smart-signage/backup.sh
```

Conteúdo:
```bash
#!/bin/bash
BACKUP_DIR="/opt/smart-signage/backups"
DATE=$(date +%Y%m%d-%H%M%S)
tar -czf "$BACKUP_DIR/backup-$DATE.tar.gz" -C /opt/smart-signage data logs
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +7 -delete
```

```bash
# Tornar executável
sudo chmod +x /opt/smart-signage/backup.sh

# Agendar backup diário
sudo crontab -e
# Adicionar: 0 2 * * * /opt/smart-signage/backup.sh
```

---

## 📊 Monitoramento

### Health Checks
```bash
# Verificar saúde do sistema
curl http://localhost:3000/health

# Verificar métricas
curl http://localhost:3000/metrics
```

### Monitoramento com Prometheus (Docker)
- **Prometheus**: `http://IP_DO_SERVIDOR:9090`
- **Grafana**: `http://IP_DO_SERVIDOR:3002`
  - Usuário: `admin`
  - Senha: `admin`

---

## 🆘 Suporte

### Informações para Suporte
Ao solicitar suporte, forneça:

1. **Versão do sistema**: `cat /etc/os-release`
2. **Modo de instalação**: Verificar arquivo `.env`
3. **Logs de erro**: `sudo journalctl -u smart-signage -n 100`
4. **Status dos serviços**: `sudo systemctl status smart-signage`
5. **Uso de recursos**: `htop` ou `top`
6. **Espaço em disco**: `df -h`

### Contatos
- **Documentação**: [Link para documentação]
- **Issues**: [Link para issues do GitHub]
- **Email**: suporte@smartsignage.com

---

## ✅ Checklist de Instalação

### Pré-Instalação
- [ ] Sistema Ubuntu 20.04+ verificado
- [ ] 4GB+ RAM disponível
- [ ] 20GB+ espaço em disco
- [ ] Acesso à internet confirmado
- [ ] Usuário com sudo configurado

### Instalação
- [ ] Script de instalação executado
- [ ] Modo de instalação selecionado
- [ ] Dependências instaladas
- [ ] Projeto configurado
- [ ] Banco de dados inicializado
- [ ] Serviços iniciados

### Pós-Instalação
- [ ] Acesso web funcionando
- [ ] Login com credenciais padrão
- [ ] Senha padrão alterada
- [ ] Firewall configurado
- [ ] Backup configurado
- [ ] Monitoramento ativo

### Produção
- [ ] SSL/HTTPS configurado
- [ ] Backup automático ativo
- [ ] Monitoramento configurado
- [ ] Logs centralizados
- [ ] Plano de recuperação definido

---

**Smart Signage Pro v2.1** - Sistema de Sinalização Digital Profissional

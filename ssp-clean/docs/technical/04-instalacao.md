# Guia de Instalação - SmartSignage Pro

## Requisitos do Sistema

### Servidor
- **SO**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: Mínimo 4GB (recomendado: 8GB+)
- **CPU**: 2+ cores
- **Disco**: 50GB+ livres
- **Rede**: Conexão estável com internet

### Software Necessário
- PostgreSQL 12+
- Node.js 18+
- Nginx
- Git

## Instalação Automática

### Método Recomendado: Script de Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd SmartSignage-Pro

# Execute o script de instalação
sudo bash scripts/install-smartsignage.sh
```

O script oferece menu interativo para:
- Modo de instalação (Single-Server ou Docker)
- Configuração de banco de dados
- Configuração de Nginx
- Seleção de players a instalar

### Opções do Script

```bash
# Instalação completa do zero
sudo bash scripts/install-smartsignage.sh --fresh

# Rebuild preservando dados
sudo bash scripts/install-smartsignage.sh --rebuild

# Modo específico (sem menu)
sudo bash scripts/install-smartsignage.sh --mode single-server --skip-menu
```

## Instalação Manual

### 1. Preparar Sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl git build-essential
```

### 2. Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Criar banco e usuário
sudo -u postgres psql << EOF
CREATE DATABASE smartsignage;
CREATE USER smartsignage WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE smartsignage TO smartsignage;
\q
EOF
```

### 3. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 4. Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Configurar Aplicação

```bash
# Clonar repositório
git clone <repository-url>
cd SmartSignage-Pro

# Instalar dependências do backend
cd backend
npm install
npm run build

# Instalar dependências do frontend
cd ../frontend
npm install
npm run build
```

### 6. Aplicar Schema do Banco

```bash
cd database
bash apply-schema-v2.sh
```

Ou manualmente:

```bash
export DB_NAME=smartsignage
export DB_USER=smartsignage
export PGPASSWORD=sua_senha_aqui
psql -U smartsignage -d smartsignage -f smartchannel-db-v2-refactored-part1-schema-setup.sql
# ... (aplicar todos os arquivos na ordem)
```

### 7. Configurar Variáveis de Ambiente

Crie `.env` no diretório `backend`:

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage
DB_USER=smartsignage
DB_PASSWORD=sua_senha_aqui
JWT_SECRET=seu_jwt_secret_aqui
TOTEM_SECRET_KEY=seu_totem_secret_aqui
PLAYER_DIR=/opt/smart-signage/player-web
```

### 8. Configurar Nginx

Copie configuração de exemplo:

```bash
sudo cp nginx/smart-signage.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/smart-signage.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Criar Serviço Systemd

Crie `/etc/systemd/system/smart-signage.service`:

```ini
[Unit]
Description=SmartSignage Pro Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/smart-signage/backend
Environment=NODE_ENV=production
Environment=PLAYER_DIR=/opt/smart-signage/player-web
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smart-signage
sudo systemctl start smart-signage
```

## Instalação Docker

### Usando Docker Compose

```bash
cd docker
docker-compose up -d
```

### Build Manual

```bash
# Build das imagens
docker build -t smart-signage-backend ./backend
docker build -t smart-signage-frontend ./frontend

# Executar containers
docker run -d --name smart-signage-backend \
  -p 3000:3000 \
  -v $(pwd)/backend:/app \
  smart-signage-backend

docker run -d --name smart-signage-frontend \
  -p 80:80 \
  -v $(pwd)/frontend/build:/usr/share/nginx/html \
  nginx:alpine
```

## Configuração Pós-Instalação

### 1. Criar Usuário Admin

```bash
# Via script
cd scripts
bash create-admin-user.sh

# Ou via SQL
psql -U smartsignage -d smartsignage << EOF
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@example.com', '$2a$12$...', 'Admin', 'admin');
EOF
```

### 2. Configurar Player

```bash
# Gerar configuração do player para um totem
cd scripts
bash generate-player-config.sh UIN-SHOPPING-001-2025 /opt/smart-signage/player-web
```

### 3. Verificar Instalação

```bash
# Verificar backend
curl http://localhost:3000/api/health

# Verificar frontend
curl http://localhost

# Verificar player
curl http://localhost/api/player-static/js/app.js
```

## Troubleshooting

### Backend não inicia

```bash
# Verificar logs
sudo journalctl -u smart-signage -f

# Verificar porta
sudo netstat -tlnp | grep 3000

# Verificar variáveis de ambiente
sudo systemctl show smart-signage | grep Environment
```

### Banco de dados não conecta

```bash
# Testar conexão
psql -U smartsignage -d smartsignage -h localhost

# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar configuração
sudo cat /etc/postgresql/*/main/pg_hba.conf
```

### Nginx retorna 502

```bash
# Verificar logs
sudo tail -f /var/log/nginx/error.log

# Verificar backend está rodando
curl http://localhost:3000/api/health

# Verificar configuração Nginx
sudo nginx -t
```

### Player não carrega

```bash
# Verificar arquivos do player
ls -la /opt/smart-signage/player-web/

# Verificar permissões
sudo chown -R www-data:www-data /opt/smart-signage/player-web

# Verificar endpoint
curl http://localhost/api/player-static/js/app.js
```

## Atualização

### Atualizar Sistema

```bash
# Pull do repositório
git pull origin main

# Rebuild backend
cd backend
npm install
npm run build

# Rebuild frontend
cd ../frontend
npm install
npm run build

# Reiniciar serviços
sudo systemctl restart smart-signage
sudo systemctl reload nginx
```

### Atualizar Banco (Migrations)

```bash
# Aplicar migrations pendentes
cd database/migrations
for migration in *.sql; do
  psql -U smartsignage -d smartsignage -f "$migration"
done
```

## Backup e Restore

### Backup do Banco

```bash
# Backup completo
pg_dump -U smartsignage smartsignage > backup_$(date +%Y%m%d).sql

# Backup apenas schema
pg_dump -U smartsignage -s smartsignage > schema_backup.sql

# Backup apenas dados
pg_dump -U smartsignage -a smartsignage > data_backup.sql
```

### Restore do Banco

```bash
# Restore completo
psql -U smartsignage smartsignage < backup_20260126.sql

# Restore apenas dados (schema já existe)
psql -U smartsignage smartsignage < data_backup.sql
```

## Segurança

### Configurar SSL/HTTPS

```bash
# Usar Let's Encrypt (via script)
sudo bash scripts/install-smartsignage.sh --https-letsencrypt

# Ou manualmente com certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

### Firewall

```bash
# Permitir apenas portas necessárias
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Próximos Passos

- [Arquitetura](../platform/01-arquitetura.md) - Entender a arquitetura
- [API](./01-api.md) - Documentação da API
- [Configuração](../platform/03-configuracao.md) - Configurações avançadas

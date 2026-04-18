# Configuração e Personalização - SmartSignage Pro

## Arquivos de Configuração

### Backend (.env)

Localização: `backend/.env`

```env
# Ambiente
NODE_ENV=production
PORT=3000

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage
DB_USER=smartsignage
DB_PASSWORD=sua_senha_aqui

# JWT
JWT_SECRET=seu_jwt_secret_aqui
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Totem
TOTEM_SECRET_KEY=seu_totem_secret_aqui

# Player
PLAYER_DIR=/opt/smart-signage/player-web

# Storage
MEDIA_STORAGE_PATH=/opt/smart-signage/public/assets/uploads
MAX_UPLOAD_SIZE=500000000

# Cache
CACHE_ENABLED=true
CACHE_TTL=60

# Email (opcional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario@example.com
SMTP_PASSWORD=senha_aqui

# Logs
LOG_LEVEL=info
LOG_FILE=/var/log/smart-signage/backend.log

# TotemDigital compacto (monousuário)
# true = reduz superfície Pro (subdomínio, billing multiagência, smartdisplayfx etc.)
TOTEMDIGITAL_COMPACT=true
```

### Frontend

Configurações de ambiente suportadas pelo build:

```env
# Base da API (opcional)
REACT_APP_API_URL=/api

# TotemDigital compacto (monousuário)
REACT_APP_TOTEMDIGITAL_COMPACT=true
```

Além disso, há configurações no código:
- `frontend/src/config/api.ts`: URL da API
- `frontend/src/config/constants.ts`: Constantes da aplicação

### Modo TotemDigital compacto (recomendado)

Nesta documentação, **modo compacto**, **mono** e **monousuário** referem-se ao mesmo perfil (`TOTEMDIGITAL_COMPACT=true`).

Para operar na variante monousuário com superfície reduzida:

1. Defina no backend: `TOTEMDIGITAL_COMPACT=true`
2. Defina no frontend: `REACT_APP_TOTEMDIGITAL_COMPACT=true`
3. Rebuild backend e frontend para aplicar as flags

**Instalador (`scripts/install-smartsignage.sh`):** no fluxo interativo, após escolher o modo de instalação, o script pergunta o perfil (**1 = compacto/mono**, **2 = Pro completo**) e grava o mesmo valor em `TOTEMDIGITAL_COMPACT` e `REACT_APP_TOTEMDIGITAL_COMPACT` no `.env` (raiz e `backend/.env`). Com `--skip-menu`, o padrão é compacto (`true`). Em modo não interativo pode usar a variável de ambiente `INSTALL_TOTEMDIGITAL_COMPACT=true|false`, ou as flags `--totemdigital-compact` / `--smartsignage-pro` (forçam compacto ou Pro e saltam essa pergunta no menu). No menu interativo, a pergunta compacto (mono) vs Pro só é omitida se passares uma destas flags na linha de comando.

Com as flags ativas, o sistema prioriza operação compacta (Totens, Mídias, Playlists, Campanhas, Monitor) e desativa módulos Pro/multiagência na API e navegação.

No backend, o modo compacto também evita inicializar filas Bull, workers e rotinas Pro (faturamento, notificação de acesso subscriber/publisher, mix/engine avançado e cron de alertas), reduzindo consumo e dependências em operação monousuária.

Após configurar, valide com o checklist em [Teste rápido — modo compacto TotemDigital](./07-teste-modo-compacto.md).

### Nginx

Localização: `/etc/nginx/sites-available/smart-signage`

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend
    location / {
        root /opt/smart-signage/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Player Static
    location ^~ /api/player-static/ {
        alias /opt/smart-signage/player-web/;
    }

    # Player
    location ^~ /player {
        alias /opt/smart-signage/player-web;
        try_files $uri $uri/ /player/index.html;
    }
}
```

## Configurações do Sistema

### System Settings (via Interface)

Acesse **Configurações** → **Sistema** para configurar:

#### Mídia
- **Caminho de Storage**: Onde arquivos são salvos
- **Tamanho Máximo de Upload**: Limite por arquivo
- **Formatos Permitidos**: Extensões aceitas
- **Geração de Thumbnail**: Automática ou manual

#### Dispatcher
- **Cache Habilitado**: Ativar/desativar cache
- **TTL do Cache**: Tempo de vida do cache (segundos)
- **Validação Comercial**: Ativar regras comerciais

#### Notificações
- **Email**: Configuração SMTP
- **Alertas**: Totens offline, erros críticos
- **Webhooks**: URLs para eventos

#### Segurança
- **Sessão**: Tempo de expiração
- **2FA**: Obrigatório ou opcional
- **Rate Limiting**: Limites de requisição

## Personalização

### Tema e Cores

Edite `frontend/src/styles/theme.ts`:

```typescript
export const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    // ...
  },
  fonts: {
    primary: 'Arial, sans-serif',
    // ...
  }
};
```

### Logo e Branding

1. Substitua logo em `frontend/public/logo.png`
2. Atualize favicon em `frontend/public/favicon.ico`
3. Modifique título em `frontend/index.html`

### Mensagens e Textos

Edite arquivos de tradução em `frontend/src/locales/`:
- `pt-BR.json`: Português
- `en-US.json`: Inglês

### Player

#### Vinheta Padrão

Substitua arquivo em `player-web/vinhetas/Smartsignage-interface-111.mp4`

#### Configuração do Player

Arquivo: `player-web/js/app.js`

```javascript
this.config = {
  apiBaseURL: 'http://seu-servidor:3000',
  heartbeatInterval: 30000,  // 30 segundos
  dispatchSyncInterval: 900000,  // 15 minutos
  maxCacheSize: 500 * 1024 * 1024  // 500MB
};
```

## Variáveis de Ambiente Avançadas

### Desenvolvimento

```env
NODE_ENV=development
LOG_LEVEL=debug
CACHE_ENABLED=false
```

### Produção

```env
NODE_ENV=production
LOG_LEVEL=info
CACHE_ENABLED=true
SENTRY_DSN=sua_dsn_aqui  # Para monitoramento de erros
```

### Docker

```env
DB_HOST=postgres
DB_PORT=5432
REDIS_HOST=redis
REDIS_PORT=6379
```

## Configurações de Banco

### PostgreSQL

Edite `/etc/postgresql/*/main/postgresql.conf`:

```conf
# Performance
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Logs
log_statement = 'all'  # Para debug
log_duration = on
```

### Índices

Índices são criados automaticamente pelo schema. Para otimização adicional:

```sql
-- Índice composto para queries frequentes
CREATE INDEX idx_campaigns_active ON campaigns(is_active, status, start_date, end_date);

-- Índice para busca de texto
CREATE INDEX idx_medias_name_search ON medias USING gin(to_tsvector('portuguese', name));
```

## Configurações de Segurança

### SSL/TLS

#### Let's Encrypt (Automático)

```bash
sudo bash scripts/install-smartsignage.sh --https-letsencrypt
```

#### Manual

```bash
sudo certbot --nginx -d seu-dominio.com
```

### Firewall

```bash
# Configurar UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Fail2ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Configurações de Performance

### Nginx

```nginx
# Cache de arquivos estáticos
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

### Node.js

Para produção, use PM2 ou systemd:

```bash
# PM2
npm install -g pm2
pm2 start dist/index.js --name smart-signage

# Systemd (já configurado no install)
sudo systemctl start smart-signage
```

### PostgreSQL

```sql
-- Ajustar work_mem para queries grandes
SET work_mem = '64MB';

-- Habilitar parallel queries
SET max_parallel_workers_per_gather = 4;
```

## Backup e Restore

### Backup Automático

Crie script `/opt/smart-signage/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/smart-signage"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup do banco
pg_dump -U smartsignage smartsignage > "$BACKUP_DIR/db_$DATE.sql"

# Backup de mídias
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" /opt/smart-signage/public/assets/uploads

# Manter apenas últimos 30 dias
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

Agende no cron:

```bash
# Diariamente às 2h da manhã
0 2 * * * /opt/smart-signage/scripts/backup.sh
```

## Monitoramento

### Logs

```bash
# Backend logs
sudo journalctl -u smart-signage -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Métricas

Configure ferramentas como:
- **Prometheus**: Coleta de métricas
- **Grafana**: Visualização
- **Sentry**: Monitoramento de erros

## Próximos Passos

- [Instalação](../technical/04-instalacao.md) - Guia de instalação
- [Arquitetura](./01-arquitetura.md) - Arquitetura do sistema
- [Requisitos](./02-requisitos.md) - Requisitos detalhados

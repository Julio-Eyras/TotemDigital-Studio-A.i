/**
 * Script de Deploy para Produção - SmartSignage-Pro v2.0
 * Prepara e executa o deploy do sistema em produção
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando Deploy para Produção - SmartSignage-Pro v2.0\n');

// Função para executar comandos
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    execSync(command, { cwd: __dirname, stdio: 'inherit' });
    console.log(`✅ ${description} - SUCESSO\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} - FALHOU: ${error.message}\n`);
    return false;
  }
}

// Função para criar arquivo de configuração de produção
function createProductionConfig() {
  console.log('📋 Criando configuração de produção...');
  
  const productionConfig = `# Smart Signage v2.0 - Configuração de Produção
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database - PostgreSQL
DB_DRIVER=postgresql
DATABASE_URL=postgresql://smartsignage:CHANGE_THIS_PASSWORD@localhost:5432/smartsignage_prod

# JWT - ALTERE ESTAS CHAVES EM PRODUÇÃO
JWT_SECRET=CHANGE_THIS_JWT_SECRET_IN_PRODUCTION
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Upload
UPLOAD_PATH=/var/smartsignage/uploads
MAX_FILE_SIZE=50MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,video/mp4

# Logs
LOG_LEVEL=warn
LOG_FILE=/var/log/smartsignage/app.log

# CORS - Configure os domínios permitidos
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# AI (Configure conforme necessário)
AI_PROVIDER=none
AI_MODEL=
OLLAMA_BASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# SSL/TLS (Para HTTPS)
SSL_CERT_PATH=/etc/ssl/certs/smartsignage.crt
SSL_KEY_PATH=/etc/ssl/private/smartsignage.key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=CHANGE_THIS_SESSION_SECRET_IN_PRODUCTION
`;

  fs.writeFileSync(path.join(__dirname, '../config.production.env'), productionConfig);
  console.log('✅ Configuração de produção criada\n');
}

// Função para criar script de inicialização do sistema
function createSystemdService() {
  console.log('📋 Criando serviço systemd...');
  
  const systemdService = `[Unit]
Description=SmartSignage-Pro v2.0
After=network.target postgresql.service
Wants=network.target postgresql.service

[Service]
Type=simple
User=smartsignage
Group=smartsignage
WorkingDirectory=/opt/smartsignage/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/smartsignage/config.production.env

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smartsignage

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/smartsignage/uploads /var/log/smartsignage

[Install]
WantedBy=multi-user.target
`;

  fs.writeFileSync(path.join(__dirname, 'smartsignage.service'), systemdService);
  console.log('✅ Serviço systemd criado\n');
}

// Função para criar script de instalação
function createInstallScript() {
  console.log('📋 Criando script de instalação...');
  
  const installScript = `#!/bin/bash
# Script de Instalação - SmartSignage-Pro v2.0

set -e

echo "🚀 Instalando SmartSignage-Pro v2.0..."

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute este script como root (sudo)"
  exit 1
fi

# Atualizar sistema
echo "📋 Atualizando sistema..."
apt update && apt upgrade -y

# Instalar dependências
echo "📋 Instalando dependências..."
apt install -y nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Criar usuário do sistema
echo "📋 Criando usuário do sistema..."
useradd -r -s /bin/false smartsignage || true

# Criar diretórios
echo "📋 Criando diretórios..."
mkdir -p /opt/smartsignage/backend
mkdir -p /var/smartsignage/uploads
mkdir -p /var/log/smartsignage
chown -R smartsignage:smartsignage /opt/smartsignage
chown -R smartsignage:smartsignage /var/smartsignage
chown -R smartsignage:smartsignage /var/log/smartsignage

# Configurar PostgreSQL
echo "📋 Configurando PostgreSQL..."
sudo -u postgres psql -c "CREATE USER smartsignage WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE smartsignage_prod OWNER smartsignage;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smartsignage_prod TO smartsignage;"

# Configurar Nginx
echo "📋 Configurando Nginx..."
cat > /etc/nginx/sites-available/smartsignage << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
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
}
EOF

ln -sf /etc/nginx/sites-available/smartsignage /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Configurar SSL
echo "📋 Configurando SSL..."
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Instalar serviço systemd
echo "📋 Instalando serviço systemd..."
cp smartsignage.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable smartsignage

echo "✅ Instalação concluída!"
echo "📋 Próximos passos:"
echo "   1. Copie os arquivos do projeto para /opt/smartsignage/backend"
echo "   2. Configure o arquivo /opt/smartsignage/config.production.env"
echo "   3. Execute: npm install && npm run build"
echo "   4. Inicie o serviço: systemctl start smartsignage"
echo "   5. Verifique o status: systemctl status smartsignage"
`;

  fs.writeFileSync(path.join(__dirname, 'install.sh'), installScript);
  fs.chmodSync(path.join(__dirname, 'install.sh'), '755');
  console.log('✅ Script de instalação criado\n');
}

// Função para criar Docker Compose para produção
function createDockerCompose() {
  console.log('📋 Criando Docker Compose para produção...');
  
  const dockerCompose = `services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    environment:
      POSTGRES_DB: smartsignage
      POSTGRES_USER: smartsignage
      POSTGRES_PASSWORD: CHANGE_THIS_PASSWORD
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - smartsignage-network

  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: backend
    environment:
      - DB_DRIVER=postgres
      - DATABASE_URL=postgresql://smartsignage:CHANGE_THIS_PASSWORD@postgres:5432/smartsignage
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    volumes:
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
      - backend_data:/app/data
    networks:
      - smartsignage-network

  # Frontend Admin Panel
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: frontend
    ports:
      - "3001:80"
    depends_on:
      - backend
    volumes:
      - frontend_assets:/usr/share/nginx/html/assets
    networks:
      - smartsignage-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: nginx
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    networks:
      - smartsignage-network

volumes:
  postgres_data:
  backend_uploads:
  backend_logs:
  backend_data:
  frontend_assets:

networks:
  smartsignage-network:
    driver: bridge
`;

  fs.writeFileSync(path.join(__dirname, 'docker-compose.production.yml'), dockerCompose);
  console.log('✅ Docker Compose para produção criado\n');
}

// Função para criar Dockerfile
function createDockerfile() {
  console.log('📋 Criando Dockerfile...');
  
  const dockerfile = `# SmartSignage-Pro v2.0 - Dockerfile para Produção
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    postgresql-client \
    curl \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S smartsignage -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Criar diretórios necessários
RUN mkdir -p uploads logs && chown -R smartsignage:nodejs uploads logs

# Mudar para usuário não-root
USER smartsignage

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de inicialização
CMD ["node", "dist/index.js"]
`;

  fs.writeFileSync(path.join(__dirname, 'Dockerfile'), dockerfile);
  console.log('✅ Dockerfile criado\n');
}

// Executar processo de deploy
async function deploy() {
  console.log('🚀 Iniciando processo de deploy...\n');
  
  // 1. Verificar se estamos em um ambiente de produção
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ ATENÇÃO: Este script é para produção. NODE_ENV deve ser "production"');
    console.log('📋 Para testar localmente, use: npm run dev\n');
  }
  
  // 2. Executar testes
  if (!runCommand('npm test', 'Executando testes')) {
    console.log('❌ Testes falharam. Deploy cancelado.');
    return;
  }
  
  // 3. Build da aplicação
  if (!runCommand('npm run build', 'Build da aplicação')) {
    console.log('❌ Build falhou. Deploy cancelado.');
    return;
  }
  
  // 4. Criar arquivos de configuração
  createProductionConfig();
  createSystemdService();
  createInstallScript();
  createDockerCompose();
  createDockerfile();
  
  // 5. Verificar estrutura
  console.log('📋 Verificando estrutura de arquivos...');
  const requiredFiles = [
    'dist/index.js',
    'package.json',
    '../config.production.env',
    'smartsignage.service',
    'install.sh',
    'docker-compose.production.yml',
    'Dockerfile'
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - Arquivo não encontrado`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    console.log('❌ Alguns arquivos necessários não foram encontrados.');
    return;
  }
  
  console.log('\n🎉 Deploy preparado com sucesso!');
  console.log('\n📋 Próximos passos para produção:');
  console.log('   1. Configure o arquivo config.production.env com suas credenciais');
  console.log('   2. Execute o script de instalação: ./install.sh');
  console.log('   3. Ou use Docker: docker-compose -f docker-compose.production.yml up -d');
  console.log('   4. Verifique os logs: journalctl -u smartsignage -f');
  console.log('\n🔒 Lembre-se de alterar todas as senhas e chaves secretas!');
}

// Executar deploy
deploy().catch(error => {
  console.error('❌ Erro durante o deploy:', error.message);
  process.exit(1);
});

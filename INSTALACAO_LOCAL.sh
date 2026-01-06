#!/bin/bash

# Smart Signage Pro - Instalação Local
# Para Linux/macOS
# 
# Este script instala e configura o backend e frontend na máquina local
# Banco de dados: PostgreSQL (localhost, user: postgres, password: postgres)

echo "========================================"
echo "Smart Signage Pro - Instalação Local"
echo "========================================"
echo ""

# Variáveis de configuração
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="smartsignage"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Verificar se Node.js está instalado
echo -e "${YELLOW}Verificando Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}Node.js encontrado: $NODE_VERSION${NC}"
else
    echo -e "${RED}ERRO: Node.js não encontrado. Por favor, instale Node.js 18+ primeiro.${NC}"
    exit 1
fi

# Verificar se npm está instalado
echo -e "${YELLOW}Verificando npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}npm encontrado: $NPM_VERSION${NC}"
else
    echo -e "${RED}ERRO: npm não encontrado.${NC}"
    exit 1
fi

# Verificar se PostgreSQL está rodando
echo ""
echo -e "${YELLOW}Verificando PostgreSQL...${NC}"
export PGPASSWORD="$DB_PASSWORD"
if command -v psql &> /dev/null; then
    if psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "SELECT version();" &> /dev/null; then
        echo -e "${GREEN}PostgreSQL está rodando e acessível${NC}"
    else
        echo -e "${YELLOW}AVISO: Não foi possível conectar ao PostgreSQL. Verifique se está rodando.${NC}"
        echo -e "${YELLOW}Tentando continuar mesmo assim...${NC}"
    fi
else
    echo -e "${YELLOW}AVISO: psql não encontrado no PATH. Verificando conexão manualmente...${NC}"
fi

echo ""
echo "========================================"
echo -e "${CYAN}1. Configurando Backend${NC}"
echo "========================================"

# Criar arquivo .env do backend
BACKEND_ENV_PATH="backend/.env"
if [ -f "$BACKEND_ENV_PATH" ]; then
    echo -e "${YELLOW}Arquivo .env do backend já existe. Fazendo backup...${NC}"
    cp "$BACKEND_ENV_PATH" "$BACKEND_ENV_PATH.backup"
fi

# Gerar JWT secret aleatório
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-key-change-in-production-$(date +%s)")
TWO_FACTOR_KEY=$(openssl rand -base64 32 2>/dev/null || echo "dev-2fa-key-change-in-production-$(date +%s)")

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

cat > "$BACKEND_ENV_PATH" << EOF
# Smart Signage Pro v2.1 - Configuração Local
NODE_ENV=development
PORT=$BACKEND_PORT
HOST=0.0.0.0

# =============================================
# BANCO DE DADOS (PostgreSQL)
# =============================================
DB_DRIVER=postgresql
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000

# =============================================
# AUTENTICAÇÃO JWT
# =============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# =============================================
# AUTENTICAÇÃO DE DOIS FATORES (2FA)
# =============================================
TWO_FACTOR_ENCRYPTION_KEY=$TWO_FACTOR_KEY

# =============================================
# SEGURANÇA
# =============================================
PLAYER_ABANDON_PIN=1234
BCRYPT_ROUNDS=12

# =============================================
# CORS
# =============================================
CORS_ORIGIN=http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://localhost:8080

# =============================================
# RATE LIMITING
# =============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
UPLOAD_RATE_LIMIT_WINDOW_MS=3600000
UPLOAD_RATE_LIMIT_MAX_REQUESTS=20
SENSITIVE_RATE_LIMIT_WINDOW_MS=600000
SENSITIVE_RATE_LIMIT_MAX_REQUESTS=10
MAX_PAYLOAD_SIZE=10MB

# =============================================
# UPLOAD DE ARQUIVOS
# =============================================
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=./public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg

# =============================================
# REDIS / CACHE (opcional - pode estar desabilitado)
# =============================================
CACHE_ENABLED=false
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# =============================================
# LOGGING
# =============================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
LOG_ENABLE_CONSOLE=true

# =============================================
# IA / SMART PLAYLIST (opcional)
# =============================================
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=30000

# =============================================
# EMAIL (desabilitado por padrão)
# =============================================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Smart Signage <noreply@smartsignage.com>
SMTP_TLS_REJECT_UNAUTHORIZED=true
FRONTEND_URL=http://localhost:$FRONTEND_PORT

# =============================================
# MONITORAMENTO (opcional)
# =============================================
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=false

# =============================================
# BACKUP
# =============================================
BACKUP_ENABLED=false
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=./backups

# =============================================
# ANALYTICS
# =============================================
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_BATCH_SIZE=1000

# =============================================
# STRIPE / PAGAMENTOS (desabilitado)
# =============================================
STRIPE_ENABLED=false

# =============================================
# DESENVOLVIMENTO
# =============================================
DEBUG=true
VERBOSE_LOGGING=true
EOF

echo -e "${GREEN}Arquivo .env do backend criado em: $BACKEND_ENV_PATH${NC}"

# Instalar dependências do backend
echo ""
echo -e "${YELLOW}Instalando dependências do backend...${NC}"
cd backend
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules já existe. Pulando instalação...${NC}"
else
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERRO: Falha ao instalar dependências do backend${NC}"
        cd ..
        exit 1
    fi
fi
echo -e "${GREEN}Dependências do backend instaladas com sucesso!${NC}"
cd ..

echo ""
echo "========================================"
echo -e "${CYAN}2. Configurando Banco de Dados${NC}"
echo "========================================"

# Criar banco de dados se não existir
echo -e "${YELLOW}Criando banco de dados '$DB_NAME' se não existir...${NC}"
export PGPASSWORD="$DB_PASSWORD"

if command -v psql &> /dev/null; then
    DB_EXISTS=$(psql -h "$DB_HOST" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")
    
    if [ "$DB_EXISTS" = "1" ]; then
        echo -e "${YELLOW}Banco de dados '$DB_NAME' já existe.${NC}"
    else
        echo -e "${YELLOW}Criando banco de dados '$DB_NAME'...${NC}"
        psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1 > /dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Banco de dados criado com sucesso!${NC}"
        else
            echo -e "${YELLOW}AVISO: Não foi possível criar o banco automaticamente. Crie manualmente:${NC}"
            echo -e "${YELLOW}psql -U $DB_USER -c \"CREATE DATABASE $DB_NAME;\"${NC}"
        fi
    fi

    # Executar scripts SQL
    echo ""
    echo -e "${YELLOW}Executando scripts SQL de criação do schema...${NC}"
    
    SQL_FILES=(
        "database/smartchannel-db-v2-refactored-part1-schema-setup.sql"
        "database/smartchannel-db-v2-refactored-part2-tables-base.sql"
        "database/smartchannel-db-v2-refactored-part3-tables-dependent.sql"
        "database/smartchannel-db-v2-refactored-part4-billing-contracts.sql"
        "database/smartchannel-db-v2-refactored-part5-tables-relationships.sql"
        "database/smartchannel-db-v2-refactored-part6-tables-other.sql"
        "database/smartchannel-db-v2-refactored-part7-foreign-keys.sql"
        "database/smartchannel-db-v2-refactored-part8-indexes.sql"
        "database/smartchannel-db-v2-refactored-part9-triggers-functions.sql"
        "database/smartchannel-db-v2-refactored-part10-views.sql"
        "database/smartchannel-db-v2-refactored-part11-playlist-mix.sql"
        "database/smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql"
    )
    
    for sql_file in "${SQL_FILES[@]}"; do
        if [ -f "$sql_file" ]; then
            echo "  Executando: $sql_file"
            psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" 2>&1 | grep -v "already exists\|does not exist" || true
        else
            echo -e "  ${YELLOW}AVISO: Arquivo não encontrado: $sql_file${NC}"
        fi
    done

    # Executar seeds se existirem
    if [ -f "database/seeds-default-settings.sql" ]; then
        echo -e "${YELLOW}Executando seeds (dados iniciais)...${NC}"
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "database/seeds-default-settings.sql" 2>&1 | grep -v "already exists" || true
    fi
    
    echo -e "${GREEN}Schema do banco de dados configurado!${NC}"
else
    echo -e "${YELLOW}AVISO: psql não encontrado. Execute os scripts SQL manualmente.${NC}"
fi

# Compilar backend
echo ""
echo "========================================"
echo -e "${CYAN}3. Compilando Backend${NC}"
echo "========================================"
cd backend
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}ERRO: Falha ao compilar backend${NC}"
    cd ..
    exit 1
fi
echo -e "${GREEN}Backend compilado com sucesso!${NC}"
cd ..

echo ""
echo "========================================"
echo -e "${CYAN}4. Configurando Frontend${NC}"
echo "========================================"

# Instalar dependências do frontend
echo -e "${YELLOW}Instalando dependências do frontend...${NC}"
cd frontend
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules já existe. Pulando instalação...${NC}"
else
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERRO: Falha ao instalar dependências do frontend${NC}"
        cd ..
        exit 1
    fi
fi
echo -e "${GREEN}Dependências do frontend instaladas com sucesso!${NC}"
cd ..

echo ""
echo "========================================"
echo -e "${GREEN}Instalação Concluída!${NC}"
echo "========================================"
echo ""
echo -e "${CYAN}Próximos passos:${NC}"
echo ""
echo -e "${YELLOW}1. Iniciar Backend:${NC}"
echo "   cd backend"
echo "   npm run dev    # Modo desenvolvimento"
echo "   npm start      # Modo produção"
echo ""
echo -e "${YELLOW}2. Iniciar Frontend (em outro terminal):${NC}"
echo "   cd frontend"
echo "   npm start"
echo ""
echo -e "${YELLOW}3. Acessar:${NC}"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend API: http://localhost:$BACKEND_PORT"
echo ""
echo -e "${CYAN}Configurações do banco:${NC}"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""


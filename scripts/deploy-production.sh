#!/bin/bash

# Smart Signage Pro v2.0 - Script de Deploy em Produção
# Deploy automatizado via SSH em servidor VPS/Dedicado
# =====================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Banner
echo -e "${BLUE}"
echo "=============================================="
echo "    Smart Signage Pro v2.0"
echo "    Deploy Automatizado em Produção"
echo "=============================================="
echo -e "${NC}"

# =============================================
# CONFIGURAÇÕES
# =============================================

# Servidor remoto (configurar conforme seu servidor)
SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP}"
SERVER_PORT="${SERVER_PORT:-22}"
SSH_KEY="${SSH_KEY}"

# Diretórios
REMOTE_DIR="/opt/smart-signage"
LOCAL_DIR=$(pwd)

# =============================================
# VALIDAÇÕES
# =============================================

# Verificar se SERVER_IP foi fornecido
if [[ -z "$SERVER_IP" ]]; then
    echo -e "${YELLOW}Usage:${NC}"
    echo "  SERVER_IP=seu_ip ./deploy-production.sh"
    echo ""
    echo -e "${YELLOW}Opções:${NC}"
    echo "  SERVER_IP     - IP do servidor (obrigatório)"
    echo "  SERVER_USER   - Usuário SSH (padrão: root)"
    echo "  SERVER_PORT   - Porta SSH (padrão: 22)"
    echo "  SSH_KEY       - Caminho para chave SSH (opcional)"
    echo ""
    echo -e "${YELLOW}Exemplo:${NC}"
    echo "  SERVER_IP=192.168.1.100 SERVER_USER=ubuntu SSH_KEY=~/.ssh/id_rsa ./deploy-production.sh"
    exit 1
fi

log "Configurações:"
log "  Servidor: $SERVER_USER@$SERVER_IP:$SERVER_PORT"
log "  Diretório remoto: $REMOTE_DIR"
log "  Diretório local: $LOCAL_DIR"

# Montar comando SSH
SSH_CMD="ssh"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -p $SERVER_PORT $SERVER_USER@$SERVER_IP"

SCP_CMD="scp"
if [[ -n "$SSH_KEY" ]]; then
    SCP_CMD="$SCP_CMD -i $SSH_KEY"
fi
SCP_CMD="$SCP_CMD -P $SERVER_PORT"

# =============================================
# TESTE DE CONECTIVIDADE
# =============================================

log "Testando conexão SSH..."

if ! $SSH_CMD "echo 'Conexão OK'"; then
    error "Falha ao conectar ao servidor via SSH"
fi

log "Conexão SSH estabelecida"

# =============================================
# PREPARAÇÃO DO PACOTE LOCAL
# =============================================

log "Preparando pacote para deploy..."

# Criar arquivo temporário com timestamp
DEPLOY_PACKAGE="smartsignage-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

# Criar arquivo .deployignore se não existir
if [[ ! -f ".deployignore" ]]; then
    cat > .deployignore <<EOF
node_modules/
.git/
.env
*.log
logs/
backups/
public/assets/uploads/*
dist/
build/
.DS_Store
*.swp
*.swo
.vscode/
.idea/
EOF
fi

# Criar pacote excluindo arquivos desnecessários
log "Criando pacote (excluindo node_modules, logs, etc.)..."
tar --exclude-from=.deployignore \
    -czf "/tmp/$DEPLOY_PACKAGE" \
    -C "$LOCAL_DIR/.." \
    $(basename "$LOCAL_DIR")

PACKAGE_SIZE=$(du -h "/tmp/$DEPLOY_PACKAGE" | cut -f1)
log "Pacote criado: $DEPLOY_PACKAGE ($PACKAGE_SIZE)"

# =============================================
# BACKUP NO SERVIDOR
# =============================================

log "Criando backup no servidor..."

$SSH_CMD <<EOF
    # Criar diretório de backups
    mkdir -p $REMOTE_DIR/backups

    # Fazer backup se o diretório existir
    if [[ -d "$REMOTE_DIR" ]]; then
        BACKUP_NAME="backup-\$(date +%Y%m%d_%H%M%S).tar.gz"
        
        # Backup dos arquivos (excluindo volumes grandes)
        cd /opt
        tar -czf "$REMOTE_DIR/backups/\$BACKUP_NAME" \
            --exclude='smart-signage/node_modules' \
            --exclude='smart-signage/public/assets/uploads' \
            --exclude='smart-signage/logs' \
            --exclude='smart-signage/backups' \
            smart-signage/ 2>/dev/null || true
        
        echo "Backup criado: \$BACKUP_NAME"
        
        # Manter apenas últimos 5 backups
        cd $REMOTE_DIR/backups
        ls -t backup-*.tar.gz | tail -n +6 | xargs rm -f 2>/dev/null || true
    fi
EOF

log "Backup concluído"

# =============================================
# UPLOAD DO PACOTE
# =============================================

log "Fazendo upload do pacote para o servidor..."

# Criar diretório temporário no servidor
$SSH_CMD "mkdir -p /tmp/smartsignage-deploy"

# Upload do pacote
$SCP_CMD "/tmp/$DEPLOY_PACKAGE" "$SERVER_USER@$SERVER_IP:/tmp/smartsignage-deploy/"

log "Upload concluído"

# Limpar pacote local
rm -f "/tmp/$DEPLOY_PACKAGE"

# =============================================
# INSTALAÇÃO NO SERVIDOR
# =============================================

log "Instalando no servidor..."

$SSH_CMD <<'ENDSSH'
    set -e
    
    # Cores
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
    
    log() {
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    }
    
    warning() {
        echo -e "${YELLOW}[WARNING] $1${NC}"
    }
    
    REMOTE_DIR="/opt/smart-signage"
    
    # Parar containers se estiverem rodando
    if [[ -f "$REMOTE_DIR/docker-compose.yml" ]]; then
        log "Parando containers..."
        cd $REMOTE_DIR
        if command -v docker &> /dev/null && docker compose version &> /dev/null; then
            docker compose down 2>/dev/null || true
        else
            docker-compose down 2>/dev/null || true
        fi
    fi
    
    # Criar diretório de instalação
    mkdir -p $REMOTE_DIR
    
    # Extrair pacote
    log "Extraindo pacote..."
    cd /tmp/smartsignage-deploy
    PACKAGE=$(ls smartsignage-deploy-*.tar.gz | head -n1)
    tar -xzf "$PACKAGE" -C /tmp/smartsignage-deploy/
    
    # Copiar arquivos (preservando .env se existir)
    log "Copiando arquivos..."
    if [[ -f "$REMOTE_DIR/.env" ]]; then
        cp "$REMOTE_DIR/.env" /tmp/smartsignage-env-backup
    fi
    
    # Sincronizar arquivos
    rsync -av --delete \
        --exclude='.env' \
        --exclude='node_modules' \
        --exclude='public/assets/uploads' \
        --exclude='logs' \
        --exclude='backups' \
        --exclude='.git' \
        /tmp/smartsignage-deploy/SmartSignage-Pro/ $REMOTE_DIR/
    
    # Restaurar .env
    if [[ -f "/tmp/smartsignage-env-backup" ]]; then
        cp /tmp/smartsignage-env-backup "$REMOTE_DIR/.env"
        rm /tmp/smartsignage-env-backup
    elif [[ ! -f "$REMOTE_DIR/.env" ]]; then
        warning "Arquivo .env não encontrado. Criando do exemplo..."
        cp "$REMOTE_DIR/env.example" "$REMOTE_DIR/.env"
        
        # Gerar JWT secret
        JWT_SECRET=$(openssl rand -base64 64)
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$REMOTE_DIR/.env"
        
        # Gerar PIN
        PIN=$(shuf -i 1000-9999 -n 1)
        sed -i "s|PLAYER_ABANDON_PIN=.*|PLAYER_ABANDON_PIN=$PIN|" "$REMOTE_DIR/.env"
        
        log "JWT_SECRET e PIN gerados automaticamente"
    fi
    
    # Criar diretórios necessários
    log "Criando diretórios..."
    mkdir -p $REMOTE_DIR/{public/assets/uploads,logs,backups,ml-models,nginx/ssl}
    
    # Definir permissões
    chmod -R 755 $REMOTE_DIR
    
    # Build e iniciar containers
    log "Iniciando containers Docker..."
    cd $REMOTE_DIR
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose build
        docker compose up -d
    else
        docker-compose build
        docker-compose up -d
    fi
    
    # Aguardar serviços iniciarem
    log "Aguardando serviços iniciarem..."
    sleep 30
    
    # Verificar status
    log "Verificando status dos containers..."
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose ps
    else
        docker-compose ps
    fi
    
    # Health check
    log "Verificando health check..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health | grep -q "ok"; then
            log "Backend está saudável!"
            break
        fi
        
        if [[ $i -eq 30 ]]; then
            warning "Backend não respondeu ao health check"
        fi
        
        sleep 2
    done
    
    # Limpar arquivos temporários
    log "Limpando arquivos temporários..."
    rm -rf /tmp/smartsignage-deploy
    
    # Logs finais
    log "Deploy concluído!"
    log "Logs dos containers:"
    docker-compose logs --tail=20
ENDSSH

log "Instalação concluída"

# =============================================
# VERIFICAÇÃO PÓS-DEPLOY
# =============================================

log "Verificando deploy..."

# Health check
sleep 5
if curl -s "http://$SERVER_IP/health" | grep -q "ok"; then
    log "✅ Health check OK"
else
    warning "⚠️  Health check falhou - verifique os logs"
fi

# =============================================
# INFORMAÇÕES FINAIS
# =============================================

echo -e "${GREEN}"
echo "=============================================="
echo "    DEPLOY CONCLUÍDO COM SUCESSO!"
echo "=============================================="
echo -e "${NC}"

echo -e "${BLUE}URLs de Acesso:${NC}"
echo "• Player: http://$SERVER_IP/player"
echo "• Admin: http://$SERVER_IP/admin"
echo "• API: http://$SERVER_IP/api"
echo "• Health: http://$SERVER_IP/health"
echo "• Grafana: http://$SERVER_IP:3002"
echo "• Prometheus: http://$SERVER_IP:9090"

echo -e "\n${BLUE}Comandos Úteis (no servidor):${NC}"
echo "• Ver logs: cd /opt/smart-signage && docker compose logs -f"
echo "• Reiniciar: cd /opt/smart-signage && docker compose restart"
echo "• Status: cd /opt/smart-signage && docker compose ps"
echo "• Backup: cd /opt/smart-signage && ./scripts/backup.sh"

echo -e "\n${BLUE}Backup Criado:${NC}"
echo "• Localização: /opt/smart-signage/backups/"
echo "• Para restaurar, use os backups salvos no servidor"

echo -e "\n${BLUE}Próximos Passos:${NC}"
echo "1. Acesse http://$SERVER_IP/admin"
echo "2. Faça login com as credenciais configuradas"
echo "3. Configure SSL/HTTPS se necessário"
echo "4. Configure backup automático"
echo "5. Monitore os logs iniciais"

echo -e "\n${GREEN}Deploy finalizado!${NC}"


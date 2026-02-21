#!/bin/bash

# Smart Signage Pro - Diagnóstico de Auto-Registro de Totens
# ============================================================
# Este script coleta informações e logs para diagnosticar problemas
# no auto-registro de totens.

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Diagnóstico de Auto-Registro de Totens                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Criar diretório de saída
OUTPUT_DIR="/tmp/smartsignage-diagnosis-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"
log "Diretório de saída: $OUTPUT_DIR"

# ============================================================================
# 1. Informações do Sistema
# ============================================================================

log "Coletando informações do sistema..."

{
    echo "=== INFORMAÇÕES DO SISTEMA ==="
    echo "Data/Hora: $(date)"
    echo "Hostname: $(hostname)"
    echo "Uptime: $(uptime)"
    echo ""
    echo "=== VERSÃO DO SISTEMA ==="
    uname -a
    echo ""
    echo "=== VERSÃO DO NODE ==="
    node --version 2>/dev/null || echo "Node não encontrado"
    echo ""
    echo "=== MEMÓRIA ==="
    free -h 2>/dev/null || vm_stat 2>/dev/null || echo "Comando não disponível"
} > "$OUTPUT_DIR/01-system-info.txt"

# ============================================================================
# 2. Verificar Backend
# ============================================================================

log "Verificando status do backend..."

{
    echo "=== STATUS DO BACKEND ==="
    
    # Verificar se backend está rodando
    if systemctl is-active --quiet smart-signage 2>/dev/null; then
        echo "✅ Serviço smart-signage está rodando"
        systemctl status smart-signage --no-pager -l 2>/dev/null || true
    else
        echo "❌ Serviço smart-signage não está rodando"
    fi
    
    echo ""
    echo "=== PORTAS EM USO ==="
    netstat -tlnp 2>/dev/null | grep -E ":(3000|8080|80)" || ss -tlnp 2>/dev/null | grep -E ":(3000|8080|80)" || echo "Nenhuma porta encontrada"
    
    echo ""
    echo "=== TESTE DE CONEXÃO ==="
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080/api/health 2>&1 || echo "❌ Não foi possível conectar ao backend"
    
} > "$OUTPUT_DIR/02-backend-status.txt"

# ============================================================================
# 3. Logs do Backend
# ============================================================================

log "Coletando logs do backend..."

{
    echo "=== ÚLTIMOS LOGS DO BACKEND (últimas 100 linhas) ==="
    
    # Logs do systemd
    if systemctl is-active --quiet smart-signage 2>/dev/null; then
        journalctl -u smart-signage -n 100 --no-pager 2>/dev/null || true
    fi
    
    echo ""
    echo "=== LOGS DE REGISTRO DE TOTENS ==="
    
    # Buscar logs relacionados a registro
    journalctl -u smart-signage --since "1 hour ago" --no-pager 2>/dev/null | grep -i "REG-\|register\|auto-registro" || echo "Nenhum log de registro encontrado"
    
    # Logs de arquivo (se existir)
    if [[ -f "/opt/smart-signage/backend/logs/app.log" ]]; then
        echo ""
        echo "=== LOGS DE ARQUIVO ==="
        tail -n 100 /opt/smart-signage/backend/logs/app.log 2>/dev/null || true
    fi
    
} > "$OUTPUT_DIR/03-backend-logs.txt"

# ============================================================================
# 4. Banco de Dados
# ============================================================================

log "Verificando banco de dados..."

{
    echo "=== STATUS DO BANCO DE DADOS ==="
    
    # Verificar PostgreSQL
    if systemctl is-active --quiet postgresql 2>/dev/null || systemctl is-active --quiet postgresql.service 2>/dev/null; then
        echo "✅ PostgreSQL está rodando"
    else
        echo "❌ PostgreSQL não está rodando"
    fi
    
    echo ""
    echo "=== TOTENS REGISTRADOS (últimos 10) ==="
    
    # Tentar conectar ao banco e listar totens
    if command -v psql &> /dev/null; then
        export PGPASSWORD="${PGPASSWORD:-smartsignage}"
        psql -h localhost -U smartsignage -d smartsignage -c "
            SELECT totem_id, identifier, uin, status, created_at, ip_address
            FROM totems
            ORDER BY created_at DESC
            LIMIT 10;
        " 2>/dev/null || echo "❌ Não foi possível conectar ao banco de dados"
    else
        echo "⚠️ psql não encontrado, não é possível verificar banco diretamente"
    fi
    
    echo ""
    echo "=== TOTENS PENDENTES DE APROVAÇÃO ==="
    
    if command -v psql &> /dev/null; then
        export PGPASSWORD="${PGPASSWORD:-smartsignage}"
        psql -h localhost -U smartsignage -d smartsignage -c "
            SELECT totem_id, identifier, uin, status, created_at, ip_address, config
            FROM totems
            WHERE status = 'pending_approval'
            ORDER BY created_at DESC;
        " 2>/dev/null || echo "❌ Não foi possível conectar ao banco de dados"
    fi
    
} > "$OUTPUT_DIR/04-database-status.txt"

# ============================================================================
# 5. Teste de API
# ============================================================================

log "Testando API de registro..."

{
    echo "=== TESTE DE API DE REGISTRO ==="
    
    # Testar endpoint de health
    echo "Testando /api/health..."
    curl -s http://localhost:8080/api/health 2>&1 | jq . 2>/dev/null || curl -s http://localhost:8080/api/health 2>&1
    
    echo ""
    echo "=== TESTE DE HARDWARE INFO ==="
    curl -s http://localhost:8080/api/player/hardware-info 2>&1 | jq . 2>/dev/null || curl -s http://localhost:8080/api/player/hardware-info 2>&1
    
    echo ""
    echo "=== TESTE DE REGISTRO (mock) ==="
    echo "Enviando requisição de teste..."
    
    # Criar payload de teste
    TEST_UIN="SSP-TEST-$(date +%s)"
    TEST_PAYLOAD=$(cat <<EOF
{
  "uin": "$TEST_UIN",
  "hardware": {
    "macAddress": "00:00:00:00:00:00",
    "hostname": "test-hostname",
    "platform": "linux",
    "arch": "x64",
    "hardwareHash": "test-hash-$(date +%s)"
  }
}
EOF
)
    
    echo "Payload:"
    echo "$TEST_PAYLOAD" | jq . 2>/dev/null || echo "$TEST_PAYLOAD"
    
    echo ""
    echo "Resposta:"
    curl -s -X POST http://localhost:8080/api/player/register \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" 2>&1 | jq . 2>/dev/null || curl -s -X POST http://localhost:8080/api/player/register \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" 2>&1
    
} > "$OUTPUT_DIR/05-api-tests.txt"

# ============================================================================
# 6. Configurações
# ============================================================================

log "Coletando configurações..."

{
    echo "=== VARIÁVEIS DE AMBIENTE ==="
    env | grep -E "SMART|TOTEM|PLAYER|DATABASE|POSTGRES" || echo "Nenhuma variável encontrada"
    
    echo ""
    echo "=== ARQUIVO .ENV ==="
    if [[ -f "/opt/smart-signage/.env" ]]; then
        cat /opt/smart-signage/.env | grep -v "PASSWORD\|SECRET\|KEY" || true
    else
        echo "Arquivo .env não encontrado"
    fi
    
    echo ""
    echo "=== CONFIGURAÇÃO DO NGINX ==="
    if [[ -f "/etc/nginx/sites-available/smart-signage" ]]; then
        cat /etc/nginx/sites-available/smart-signage 2>/dev/null || true
    elif [[ -f "/etc/nginx/conf.d/smart-signage.conf" ]]; then
        cat /etc/nginx/conf.d/smart-signage.conf 2>/dev/null || true
    else
        echo "Configuração do Nginx não encontrada"
    fi
    
} > "$OUTPUT_DIR/06-configurations.txt"

# ============================================================================
# 7. Logs do Player (console do navegador)
# ============================================================================

log "Criando guia para coletar logs do player..."

{
    cat <<'EOF'
=== COMO COLETAR LOGS DO PLAYER ===

1. Abra o player no navegador:
   http://localhost/player/

2. Abra o DevTools (F12 ou Ctrl+Shift+I)

3. Vá para a aba "Console"

4. Limpe o console (ícone de lixeira ou Ctrl+L)

5. Recarregue a página (F5)

6. Observe os logs que começam com:
   - [PLAYER-xxx] - Logs do auto-registro
   - [REG-xxx] - Request IDs do backend

7. Copie todos os logs do console

8. Envie junto com este diagnóstico

=== FILTROS ÚTEIS ===

Para ver apenas logs de registro:
- Filtre por: "REG-" ou "PLAYER-" ou "auto-registro"

Para ver erros:
- Filtre por: "❌" ou "error" ou "Error"

=== INFORMAÇÕES IMPORTANTES ===

- Request ID: Cada requisição tem um ID único (formato: REG-xxxxx ou PLAYER-xxxxx)
- Use este ID para rastrear a requisição nos logs do backend
- Anote o UIN gerado (se houver)
- Anote qualquer mensagem de erro completa

EOF
} > "$OUTPUT_DIR/07-player-logs-guide.txt"

# ============================================================================
# 8. Resumo
# ============================================================================

log "Criando resumo..."

{
    cat <<EOF
=== RESUMO DO DIAGNÓSTICO ===

Data/Hora: $(date)
Hostname: $(hostname)

Arquivos gerados:
- 01-system-info.txt - Informações do sistema
- 02-backend-status.txt - Status do backend
- 03-backend-logs.txt - Logs do backend
- 04-database-status.txt - Status do banco de dados
- 05-api-tests.txt - Testes de API
- 06-configurations.txt - Configurações
- 07-player-logs-guide.txt - Guia para coletar logs do player

=== PRÓXIMOS PASSOS ===

1. Revise os arquivos gerados
2. Colete logs do player seguindo o guia em 07-player-logs-guide.txt
3. Teste o registro novamente e observe os logs
4. Anote o Request ID da tentativa de registro
5. Use o Request ID para buscar nos logs do backend

=== COMANDOS ÚTEIS ===

Ver logs do backend em tempo real:
  sudo journalctl -u smart-signage -f

Buscar por Request ID específico:
  sudo journalctl -u smart-signage | grep "REG-xxxxx"

Testar API de registro:
  curl -X POST http://localhost:8080/api/player/register \\
    -H "Content-Type: application/json" \\
    -d '{"uin":"SSP-TEST","hardware":{"macAddress":"00:00:00:00:00:00"}}'

Ver totens pendentes:
  curl http://localhost:8080/api/debug/player-registration-logs

EOF
} > "$OUTPUT_DIR/00-README.txt"

# ============================================================================
# Criar arquivo compactado
# ============================================================================

log "Criando arquivo compactado..."

cd "$OUTPUT_DIR/.."
tar -czf "smartsignage-diagnosis-$(date +%Y%m%d-%H%M%S).tar.gz" "$(basename $OUTPUT_DIR)" 2>/dev/null || zip -r "smartsignage-diagnosis-$(date +%Y%m%d-%H%M%S).zip" "$(basename $OUTPUT_DIR)" 2>/dev/null || true

log "✅ Diagnóstico completo!"
echo ""
info "📁 Arquivos salvos em: $OUTPUT_DIR"
info "📦 Arquivo compactado criado (se possível)"
echo ""
warning "⚠️  IMPORTANTE: Colete também os logs do player seguindo o guia em:"
warning "   $OUTPUT_DIR/07-player-logs-guide.txt"
echo ""
log "📋 Para compartilhar: envie todos os arquivos de $OUTPUT_DIR"


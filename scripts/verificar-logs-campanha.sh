#!/bin/bash
# Script para verificar logs relacionados a campanhas

LOG_DIR="${LOG_DIR:-/opt/smart-signage/Logs}"

# Verificar se o diretório existe
if [ ! -d "$LOG_DIR" ]; then
    echo "❌ Diretório de logs não encontrado: $LOG_DIR"
    echo "📁 Tentando localizar diretório alternativo..."
    
    # Tentar diretório home
    if [ -d "$HOME/.smart-signage/logs" ]; then
        LOG_DIR="$HOME/.smart-signage/logs"
        echo "✅ Usando: $LOG_DIR"
    elif [ -d "/tmp/smart-signage-logs" ]; then
        LOG_DIR="/tmp/smart-signage-logs"
        echo "✅ Usando: $LOG_DIR"
    else
        echo "❌ Nenhum diretório de logs encontrado!"
        exit 1
    fi
fi

echo "========================================="
echo "🔍 Verificando Logs de Campanhas"
echo "========================================="
echo "📂 Diretório: $LOG_DIR"
echo ""

# Verificar arquivos de log disponíveis
echo "📄 Arquivos de log disponíveis:"
ls -lh "$LOG_DIR"/*.log 2>/dev/null | head -10
echo ""

# Últimas entradas relacionadas a campanhas
echo "📝 Últimas 20 entradas relacionadas a campanhas:"
echo "---"
grep -i "campaign\|campanha" "$LOG_DIR"/app-current.log 2>/dev/null | tail -20 || \
grep -i "campaign\|campanha" "$LOG_DIR"/app-*.log 2>/dev/null | tail -20 || \
echo "Nenhuma entrada encontrada"
echo ""

# Últimos erros relacionados a campanhas
echo "🚨 Últimos erros relacionados a campanhas:"
echo "---"
grep -i "error.*campaign\|error.*campanha" "$LOG_DIR"/error-current.log 2>/dev/null | tail -10 || \
grep -i "error.*campaign\|error.*campanha" "$LOG_DIR"/error-*.log 2>/dev/null | tail -10 || \
echo "Nenhum erro encontrado"
echo ""

# Verificar tentativas de criação recentes
echo "🆕 Tentativas de criação de campanha (últimas 2 horas):"
echo "---"
TODAY=$(date +%Y-%m-%d)
TWO_HOURS_AGO=$(date -d '2 hours ago' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-2H '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
grep -i "POST /api/campaigns\|criar campanha\|createCampaign" "$LOG_DIR"/app-current.log 2>/dev/null | tail -10 || \
grep -i "POST /api/campaigns\|criar campanha\|createCampaign" "$LOG_DIR"/app-*.log 2>/dev/null | tail -10 || \
echo "Nenhuma tentativa encontrada"
echo ""

# Verificar logs do CampaignService
echo "🔧 Logs do CampaignService:"
echo "---"
grep -i "CampaignService" "$LOG_DIR"/app-current.log 2>/dev/null | tail -10 || \
grep -i "CampaignService" "$LOG_DIR"/app-*.log 2>/dev/null | tail -10 || \
echo "Nenhum log do CampaignService encontrado"
echo ""

# Verificar erros de banco de dados
echo "💾 Erros de banco de dados relacionados:"
echo "---"
grep -i "database\|postgres\|sql" "$LOG_DIR"/error-current.log 2>/dev/null | grep -i "campaign\|campanha" | tail -5 || \
grep -i "database\|postgres\|sql" "$LOG_DIR"/error-*.log 2>/dev/null | grep -i "campaign\|campanha" | tail -5 || \
echo "Nenhum erro de banco encontrado"
echo ""

echo "========================================="
echo "💡 Dicas:"
echo "  - Para ver logs em tempo real: tail -f $LOG_DIR/app-current.log"
echo "  - Para buscar um erro específico: grep 'SEU_TERMO' $LOG_DIR/*.log"
echo "  - Para ver apenas erros: tail -f $LOG_DIR/error-current.log"
echo "========================================="


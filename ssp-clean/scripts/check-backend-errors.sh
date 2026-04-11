#!/bin/bash
# Script para verificar erros no backend e identificar queries problemáticas

echo "=========================================="
echo "Verificando erros no backend..."
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se o backend está rodando
if ! pgrep -f "node.*backend" > /dev/null && ! pgrep -f "npm.*start" > /dev/null; then
    echo -e "${YELLOW}⚠️  Backend não está rodando${NC}"
    echo "Inicie o backend primeiro para verificar os logs"
    exit 1
fi

# Caminho dos logs (ajustar conforme necessário)
LOG_PATH="/opt/smart-signage/Logs"
if [ ! -d "$LOG_PATH" ]; then
    LOG_PATH="./backend/logs"
fi

if [ ! -d "$LOG_PATH" ]; then
    echo -e "${YELLOW}⚠️  Diretório de logs não encontrado em $LOG_PATH${NC}"
    echo "Verificando logs do sistema..."
    
    # Tentar encontrar logs do PM2
    if command -v pm2 > /dev/null; then
        echo ""
        echo "Logs do PM2:"
        pm2 logs --lines 50 --nostream | grep -i "error\|failed\|500" | tail -20
    fi
    
    # Tentar encontrar logs do journalctl
    if command -v journalctl > /dev/null; then
        echo ""
        echo "Logs do systemd:"
        journalctl -u smart-signage -n 50 --no-pager | grep -i "error\|failed\|500" | tail -20
    fi
    
    exit 0
fi

echo "Verificando logs em: $LOG_PATH"
echo ""

# Verificar erros recentes nos logs
echo -e "${RED}=== ÚLTIMOS ERROS (últimas 50 linhas) ===${NC}"
find "$LOG_PATH" -name "*.log" -type f -mtime -1 -exec tail -50 {} \; | grep -i "error\|failed\|500\|exception" | tail -30

echo ""
echo -e "${YELLOW}=== QUERIES QUE FALHARAM ===${NC}"
find "$LOG_PATH" -name "*.log" -type f -mtime -1 -exec grep -i "column.*does not exist\|relation.*does not exist\|syntax error" {} \; | tail -20

echo ""
echo -e "${YELLOW}=== ERROS 500 RECENTES ===${NC}"
find "$LOG_PATH" -name "*.log" -type f -mtime -1 -exec grep -i "500\|internal server error" {} \; | tail -20

echo ""
echo -e "${GREEN}✅ Verificação concluída${NC}"
echo ""
echo "Para ver logs em tempo real, use:"
echo "  tail -f $LOG_PATH/*.log | grep -i error"


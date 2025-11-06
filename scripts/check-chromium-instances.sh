#!/bin/bash

# ================================================================
# Script para Verificar Instâncias do Chromium
# ================================================================
# Verifica onde e como o Chromium está sendo iniciado
# ================================================================

echo "🔍 Verificando instâncias do Chromium..."
echo ""

# 1. Verificar processos do Chromium em execução
echo "📋 1. Processos do Chromium em execução:"
echo "----------------------------------------"
ps aux | grep -E "chromium|chrome" | grep -v grep || echo "   Nenhum processo encontrado"
echo ""

# 2. Verificar comandos completos dos processos
echo "📋 2. Comandos completos dos processos:"
echo "----------------------------------------"
ps aux | grep -E "chromium|chrome" | grep -v grep | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}' || echo "   Nenhum processo encontrado"
echo ""

# 3. Verificar scripts de autostart
echo "📋 3. Scripts de autostart:"
echo "----------------------------------------"
echo "Autostart do usuário:"
if [ -d ~/.config/autostart/ ]; then
    ls -la ~/.config/autostart/ | grep -E "\.sh|\.desktop" || echo "   Nenhum arquivo encontrado"
    echo ""
    echo "Conteúdo dos scripts:"
    for file in ~/.config/autostart/*.sh; do
        if [ -f "$file" ]; then
            echo "--- $file ---"
            grep -n "chromium\|chrome\|192.168" "$file" || echo "   Nenhuma referência encontrada"
            echo ""
        fi
    done
else
    echo "   Diretório ~/.config/autostart/ não existe"
fi
echo ""

# 4. Verificar arquivos .desktop de autostart
echo "📋 4. Arquivos .desktop de autostart:"
echo "----------------------------------------"
if [ -d ~/.config/autostart/ ]; then
    for file in ~/.config/autostart/*.desktop; do
        if [ -f "$file" ]; then
            echo "--- $file ---"
            cat "$file"
            echo ""
        fi
    done
fi
echo ""

# 5. Verificar systemd services relacionados
echo "📋 5. Serviços systemd relacionados:"
echo "----------------------------------------"
systemctl list-unit-files | grep -i "chromium\|chrome\|kiosk\|lightdm" || echo "   Nenhum serviço encontrado"
echo ""

# 6. Verificar arquivos de configuração do Chromium
echo "📋 6. Configurações do Chromium:"
echo "----------------------------------------"
echo "Página inicial:"
if [ -d ~/.config/chromium/ ]; then
    if [ -f ~/.config/chromium/Default/Preferences ]; then
        grep -i "homepage\|startup" ~/.config/chromium/Default/Preferences | head -5 || echo "   Nenhuma configuração encontrada"
    fi
fi
echo ""

# 7. Verificar variáveis de ambiente
echo "📋 7. Variáveis de ambiente relacionadas:"
echo "----------------------------------------"
env | grep -i "chromium\|chrome\|kiosk\|display\|player" || echo "   Nenhuma variável encontrada"
echo ""

# 8. Verificar se há múltiplas chamadas no mesmo script
echo "📋 8. Verificando múltiplas chamadas ao Chromium:"
echo "----------------------------------------"
if [ -f ~/.config/autostart/kiosk.sh ]; then
    echo "Contagem de chamadas ao chromium no kiosk.sh:"
    grep -c "chromium\|chrome" ~/.config/autostart/kiosk.sh || echo "   0"
    echo ""
    echo "Linhas com chromium:"
    grep -n "chromium\|chrome" ~/.config/autostart/kiosk.sh || echo "   Nenhuma encontrada"
fi
echo ""

# 9. Verificar IPs hardcoded
echo "📋 9. Verificando IPs hardcoded:"
echo "----------------------------------------"
echo "IPs encontrados nos scripts:"
find ~/.config/autostart/ -type f -exec grep -l "192\.168\|10\.0\|172\.16" {} \; 2>/dev/null | while read file; do
    echo "--- $file ---"
    grep -n "192\.168\|10\.0\|172\.16" "$file" || echo "   Nenhum IP encontrado"
    echo ""
done
echo ""

# 10. Resumo
echo "✅ Verificação concluída!"
echo ""
echo "💡 Dicas:"
echo "  - Se houver múltiplas instâncias do Chromium, verifique os scripts de autostart"
echo "  - Se houver IP fixo (192.168.1.102), execute: ./scripts/fix-kiosk-url.sh"
echo "  - Para ver logs do kiosk: cat /tmp/kiosk.log"
echo "  - Para reiniciar o kiosk: sudo systemctl restart lightdm"


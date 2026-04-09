#!/bin/bash

# ================================================================
# Script de Diagnóstico - Verificar Redirecionamento do Player
# ================================================================
# Verifica possíveis causas do redirecionamento para IP 192.168.1.102
# ================================================================

echo "🔍 Verificando possíveis causas do redirecionamento para IP 192.168.1.102..."
echo ""

# 1. Verificar scripts de inicialização
echo "📋 1. Verificando scripts de inicialização..."
echo "----------------------------------------"
echo "Systemd services relacionados ao Smart Signage:"
systemctl list-unit-files | grep -i smart | grep -i signage || echo "   Nenhum serviço encontrado"
echo ""

echo "Autostart do usuário:"
if [ -d ~/.config/autostart/ ]; then
    ls -la ~/.config/autostart/ | grep -i "smart\|signage\|player" || echo "   Nenhum arquivo encontrado"
else
    echo "   Diretório ~/.config/autostart/ não existe"
fi
echo ""

echo "Crontab:"
crontab -l 2>/dev/null | grep -i "192.168.1.102\|smart\|signage\|player" || echo "   Nenhuma entrada encontrada"
echo ""

# 2. Verificar configurações do navegador
echo "🌐 2. Verificando configurações do navegador..."
echo "----------------------------------------"
echo "Chromium/Chrome:"
if [ -d ~/.config/chromium/ ]; then
    grep -r "192.168.1.102" ~/.config/chromium/ 2>/dev/null | head -5 || echo "   Nenhuma referência encontrada"
fi
if [ -d ~/.config/google-chrome/ ]; then
    grep -r "192.168.1.102" ~/.config/google-chrome/ 2>/dev/null | head -5 || echo "   Nenhuma referência encontrada"
fi
echo ""

echo "Firefox:"
if [ -d ~/.mozilla/ ]; then
    grep -r "192.168.1.102" ~/.mozilla/ 2>/dev/null | head -5 || echo "   Nenhuma referência encontrada"
fi
echo ""

# 3. Verificar configurações de rede
echo "🌐 3. Verificando configurações de rede..."
echo "----------------------------------------"
echo "/etc/hosts:"
grep -i "192.168.1.102" /etc/hosts 2>/dev/null || echo "   Nenhuma entrada encontrada"
echo ""

echo "/etc/resolv.conf:"
cat /etc/resolv.conf 2>/dev/null | grep -i "192.168.1.102" || echo "   Nenhuma referência encontrada"
echo ""

echo "Netplan:"
if [ -d /etc/netplan/ ]; then
    grep -r "192.168.1.102" /etc/netplan/ 2>/dev/null || echo "   Nenhuma referência encontrada"
fi
echo ""

# 4. Verificar scripts do projeto
echo "📁 4. Verificando scripts do projeto..."
echo "----------------------------------------"
echo "Scripts que mencionam IP 192.168.1.102:"
find . -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" -o -name "*.html" -o -name "*.conf" \) \
    -exec grep -l "192.168.1.102" {} \; 2>/dev/null || echo "   Nenhum arquivo encontrado"
echo ""

# 5. Verificar processos em execução
echo "⚙️ 5. Verificando processos relacionados..."
echo "----------------------------------------"
echo "Processos do navegador:"
ps aux | grep -E "chromium|chrome|firefox" | grep -v grep | head -5 || echo "   Nenhum processo encontrado"
echo ""

# 6. Verificar variáveis de ambiente
echo "🔧 6. Verificando variáveis de ambiente..."
echo "----------------------------------------"
env | grep -i "192.168.1.102\|PLAYER\|SMART\|SIGNAGE" || echo "   Nenhuma variável encontrada"
echo ""

echo "✅ Verificação concluída!"
echo ""
echo "💡 Dicas:"
echo "  - Se encontrou o IP 192.168.1.102 em algum arquivo, verifique o contexto"
echo "  - Verifique scripts de inicialização do sistema operacional"
echo "  - Verifique configurações do kiosk mode do navegador"
echo "  - Verifique se há algum redirecionamento DNS ou proxy"


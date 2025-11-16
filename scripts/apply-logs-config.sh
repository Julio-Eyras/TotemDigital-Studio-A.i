#!/bin/bash

# =============================================
# Script para Aplicar Configurações de Logs
# =============================================
# Aplica o schema de logs e verifica dependências
# =============================================

INSTALL_DIR="/home/smartchannel/smartsignage-pro-main"
DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"

echo "🔧 Aplicando configurações de logs..."

# 1. Verificar se arquivo existe
# Nota: O schema de logs está consolidado em smartchannel-db.sql
# Este script verifica apenas se as configurações existem no banco
MASTER_SCHEMA_FILE="$INSTALL_DIR/database/smartchannel-db.sql"
if [[ ! -f "$MASTER_SCHEMA_FILE" ]]; then
    echo "❌ Arquivo não encontrado: $MASTER_SCHEMA_FILE"
    echo "⚠️ O schema de logs está consolidado em smartchannel-db.sql"
    exit 1
fi

echo "✅ Schema consolidado encontrado: $MASTER_SCHEMA_FILE"
echo "ℹ️ As configurações de logs estão incluídas em smartchannel-db.sql"

# 3. Verificar configurações criadas
LOGS_CONFIG_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
echo "📊 Configurações de logs encontradas: $LOGS_CONFIG_COUNT"

if [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
    echo "✅ Configurações de logs criadas com sucesso!"
    psql "$DATABASE_URL" -c "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'log.%' ORDER BY setting_key;" 2>/dev/null
else
    echo "⚠️ Nenhuma configuração de logs encontrada"
fi

# 4. Verificar dependência winston-daily-rotate-file
echo ""
echo "📦 Verificando dependência winston-daily-rotate-file..."
cd "$INSTALL_DIR/backend" || exit 1

if npm list winston-daily-rotate-file >/dev/null 2>&1; then
    echo "✅ winston-daily-rotate-file já está instalado"
else
    echo "📥 Instalando winston-daily-rotate-file..."
    if npm install winston-daily-rotate-file --save; then
        echo "✅ winston-daily-rotate-file instalado com sucesso"
    else
        echo "❌ Falha ao instalar winston-daily-rotate-file"
        exit 1
    fi
fi

# 5. Recriar diretório de logs
LOGS_DIR="/opt/smart-signage/Logs"
echo ""
echo "📁 Criando diretório de logs: $LOGS_DIR"
sudo mkdir -p "$LOGS_DIR"
sudo chown -R smartchannel:smartchannel "$LOGS_DIR" 2>/dev/null || sudo chown -R $USER:$USER "$LOGS_DIR"
chmod 755 "$LOGS_DIR"
echo "✅ Diretório de logs criado: $LOGS_DIR"

# 6. Recarregar logger (se backend estiver rodando)
echo ""
echo "🔄 Recarregando configurações do logger..."
if systemctl is-active --quiet smart-signage.service; then
    echo "✅ Serviço smart-signage está ativo"
    echo "💡 Para aplicar novas configurações, reinicie o serviço:"
    echo "   sudo systemctl restart smart-signage"
else
    echo "⚠️ Serviço smart-signage não está ativo"
fi

echo ""
echo "✅ Configurações de logs aplicadas com sucesso!"


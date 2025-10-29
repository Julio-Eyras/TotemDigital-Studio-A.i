#!/bin/bash
# =====================================================
# SmartSignage-Pro Installer / Updater
# =====================================================

set -e  # Interrompe em caso de erro

# Diretórios alvo
DIR1="$HOME/smartsignage-pro"
DIR2="/opt/smartsignage-pro"

echo "=============================================="
echo " SmartSignage-Pro - Instalação / Atualização"
echo "=============================================="
echo

# --- Confirmação de remoção de diretórios ---
for DIR in "$DIR1" "$DIR2"; do
    if [ -d "$DIR" ]; then
        echo "O diretório '$DIR' existe."
        read -p "Deseja removê-lo antes de reinstalar? (s/n): " RESPOSTA
        if [[ "$RESPOSTA" =~ ^[Ss]$ ]]; then
            echo "→ Removendo $DIR ..."
            sudo rm -rf "$DIR"
        else
            echo "→ Mantendo $DIR."
        fi
    else
        echo "O diretório '$DIR' não existe, nada a remover."
    fi
    echo
done

# --- Baixar ou atualizar o repositório ---
if [ -d "$DIR1/.git" ]; then
    echo "→ Repositório já existe. Atualizando via git pull..."
    cd "$DIR1"
    git pull origin main
else
    echo "→ Clonando o repositório SmartSignage-Pro..."
    git clone https://julio-eyras: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@github.com/Julio-Eyras/smartsignage-pro.git  "$DIR1"

fi

# --- Ajustar permissões ---
echo "→ Ajustando permissões de scripts..."
chmod 754 "$DIR1"/*.sh 2>/dev/null || true
chmod 754 "$DIR1"/scripts/*.sh 2>/dev/null || true

# --- Executar instalador principal ---
echo "→ Iniciando instalação..."
"$DIR1/install-smartsignage.sh"

echo
echo "✅ Instalação concluída com sucesso!"


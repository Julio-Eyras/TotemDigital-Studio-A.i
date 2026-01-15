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

# --- Atualizar o repositório (sempre usa git pull, nunca clone) ---
if [ -d "$DIR1/.git" ]; then
    echo "→ Repositório existe. Atualizando via git pull..."
    cd "$DIR1"
    git fetch origin
    git pull origin main
    echo "✅ Repositório atualizado"
elif [ -d "$DIR1" ]; then
    echo "→ Diretório existe mas não é um repositório Git."
    echo "→ Convertendo para repositório Git..."
    cd "$DIR1"
    git init
    git remote add origin https://julio-eyras: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@github.com/Julio-Eyras/smartsignage-pro.git 2>/dev/null || git remote set-url origin https://julio-eyras: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@github.com/Julio-Eyras/smartsignage-pro.git
    git fetch origin
    git checkout -b main origin/main 2>/dev/null || git pull origin main
    echo "✅ Diretório convertido e atualizado"
else
    echo "❌ Erro: Diretório $DIR1 não existe!"
    echo "→ Para primeira instalação, clone manualmente:"
    echo "   git clone https://github.com/Julio-Eyras/smartsignage-pro.git $DIR1"
    echo "→ Depois execute este script novamente para atualizar."
    exit 1
fi

# --- Ajustar permissões ---
echo "→ Ajustando permissões de scripts..."
chmod 754 "$DIR1"/*.sh 2>/dev/null || true
chmod 754 "$DIR1"/scripts/*.sh 2>/dev/null || true

# --- Executar instalador principal ---
echo "→ Iniciando instalação..."
"$DIR1/scripts/install-smartsignage.sh"

echo
echo "✅ Instalação concluída com sucesso!"


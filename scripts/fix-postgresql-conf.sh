#!/bin/bash
# Script para corrigir postgresql.conf corrompido

PG_VERSION="${1:-16}"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

if [[ ! -f "$PG_CONF" ]]; then
    echo "❌ Arquivo $PG_CONF não encontrado"
    exit 1
fi

echo "🔧 Corrigindo postgresql.conf..."

# Fazer backup
sudo cp "$PG_CONF" "${PG_CONF}.backup-$(date +%Y%m%d-%H%M%S)"
echo "📋 Backup criado: ${PG_CONF}.backup-*"

# Verificar linha 130 (onde está o erro)
echo "Verificando linha 130..."
line130=$(sudo sed -n '130p' "$PG_CONF" 2>/dev/null)
echo "Linha 130 atual: '$line130'"

# Verificar contexto ao redor da linha 130
echo "Contexto (linhas 125-135):"
sudo sed -n '125,135p' "$PG_CONF" | cat -n

# Se a linha 130 contém listen_addresses inválido, remover
if echo "$line130" | grep -qi "listen_addresses"; then
    echo "⚠️  Linha 130 contém listen_addresses - removendo..."
    sudo sed -i '130d' "$PG_CONF"
    echo "✅ Linha 130 removida"
fi

# Verificar se há múltiplas ocorrências de listen_addresses
echo ""
echo "Verificando todas as ocorrências de listen_addresses:"
listen_count=$(sudo grep -c "listen_addresses" "$PG_CONF" 2>/dev/null || echo "0")
echo "Total de ocorrências: $listen_count"

if [[ "$listen_count" -gt 1 ]]; then
    echo "⚠️  Múltiplas ocorrências encontradas:"
    sudo grep -n "listen_addresses" "$PG_CONF"
    echo "Removendo duplicatas (mantendo apenas a primeira válida)..."
    # Manter apenas a primeira ocorrência não comentada
    first_line=$(sudo grep -n "^[[:space:]]*listen_addresses[[:space:]]*=" "$PG_CONF" 2>/dev/null | grep -v "^[[:space:]]*#" | head -1 | cut -d: -f1 || echo "")
    if [[ -n "$first_line" ]]; then
        # Remover todas as outras ocorrências não comentadas
        sudo awk -v keep_line="$first_line" '
            /^[[:space:]]*listen_addresses[[:space:]]*=/ && !/^[[:space:]]*#/ {
                if (NR == keep_line) {
                    print
                } else {
                    next
                }
            }
            { print }
        ' "$PG_CONF" > "${PG_CONF}.tmp" && sudo mv "${PG_CONF}.tmp" "$PG_CONF"
        echo "✅ Duplicatas removidas"
    fi
fi

# Remover TODAS as linhas inválidas de listen_addresses (vazias ou mal formatadas)
echo "Removendo linhas inválidas de listen_addresses..."
sudo sed -i '/^[[:space:]]*listen_addresses[[:space:]]*=[[:space:]]*$/d' "$PG_CONF" 2>/dev/null || true

# Verificar se listen_addresses existe e está correto (não comentado)
has_listen=$(grep -E "^[[:space:]]*listen_addresses[[:space:]]*=" "$PG_CONF" 2>/dev/null | grep -v "^[[:space:]]*#" | head -1 || echo "")

if [[ -n "$has_listen" ]]; then
    echo "✅ listen_addresses já existe: '$has_listen'"
    # Verificar se está correto
    if echo "$has_listen" | grep -qE "listen_addresses[[:space:]]*=[[:space:]]*'\\*'"; then
        echo "✅ listen_addresses está configurado corretamente"
    else
        echo "Corrigindo listen_addresses..."
        sudo sed -i "s/^[[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '*'/" "$PG_CONF"
        echo "✅ listen_addresses corrigido"
    fi
else
    echo "Adicionando listen_addresses corretamente..."
    # Procurar comentário sobre listen_addresses
    comment_line=$(grep -n "^[[:space:]]*#listen_addresses\|^[[:space:]]*#.*listen_addresses" "$PG_CONF" 2>/dev/null | head -1 | cut -d: -f1 || echo "")
    
    if [[ -n "$comment_line" ]]; then
        echo "Adicionando após linha $comment_line (comentário sobre listen_addresses)..."
        sudo sed -i "${comment_line}a listen_addresses = '*'" "$PG_CONF"
    else
        # Procurar seção de conexões
        conn_line=$(grep -n "^[[:space:]]*#.*CONNECTION\|^[[:space:]]*#.*Connection" "$PG_CONF" 2>/dev/null | head -1 | cut -d: -f1 || echo "")
        if [[ -n "$conn_line" ]]; then
            echo "Adicionando após linha $conn_line (seção de conexões)..."
            sudo sed -i "${conn_line}a listen_addresses = '*'" "$PG_CONF"
        else
            # Adicionar após primeira linha de configuração não comentada (geralmente ~60)
            first_line=$(grep -n "^[^#]" "$PG_CONF" 2>/dev/null | head -1 | cut -d: -f1 || echo "60")
            echo "Adicionando após linha $first_line..."
            sudo sed -i "${first_line}i listen_addresses = '*'" "$PG_CONF"
        fi
    fi
    echo "✅ listen_addresses adicionado"
fi

echo ""
echo "✅ postgresql.conf corrigido"
echo ""
echo "⚠️  Tente iniciar o PostgreSQL:"
echo "   sudo pg_ctlcluster ${PG_VERSION} main start"
echo ""
echo "Se ainda não funcionar, verifique os logs:"
echo "   sudo journalctl -u postgresql@${PG_VERSION}-main -n 50"


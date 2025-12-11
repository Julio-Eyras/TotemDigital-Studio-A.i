#!/bin/bash
# Script de verificação do pacote de distribuição

echo "Verificando integridade do pacote..."

ERRORS=0

# Verificar diretórios essenciais
for dir in backend frontend database docker nginx monitoring scripts; do
    if [[ ! -d "$dir" ]]; then
        echo "❌ Diretório faltando: $dir"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $dir"
    fi
done

# Verificar arquivos essenciais
for file in docker-compose.yml Dockerfile.app env.example install-smartsignage.sh; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Arquivo faltando: $file"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $file"
    fi
done

# Verificar backend
if [[ ! -f "backend/package.json" ]] || [[ ! -d "backend/src" ]]; then
    echo "❌ Backend incompleto"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Backend completo"
fi

# Verificar frontend
if [[ ! -f "frontend/package.json" ]] || [[ ! -d "frontend/src" ]]; then
    echo "❌ Frontend incompleto"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Frontend completo"
fi

if [[ $ERRORS -eq 0 ]]; then
    echo ""
    echo "✅ Pacote completo e pronto para distribuição!"
    exit 0
else
    echo ""
    echo "❌ Pacote incompleto! $ERRORS erro(s) encontrado(s)."
    exit 1
fi

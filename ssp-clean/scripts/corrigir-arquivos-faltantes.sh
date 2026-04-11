#!/bin/bash
# Script de Correção Rápida - Arquivos Faltantes na Distribuição
# Execute este script no servidor Ubuntu para copiar arquivos que faltam

set -e

SOURCE_DIR="${HOME}/SmartSignage-Pro"
DIST_DIR="${HOME}/SmartSignage-Pro-install"

echo "========================================"
echo "  Correção de Arquivos Faltantes"
echo "========================================"
echo ""

# Verificar se diretórios existem
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ ERRO: Diretório origem não encontrado: $SOURCE_DIR"
    echo "   Se você não tem o projeto original, baixe novamente ou copie os arquivos manualmente."
    exit 1
fi

if [ ! -d "$DIST_DIR" ]; then
    echo "❌ ERRO: Diretório de distribuição não encontrado: $DIST_DIR"
    exit 1
fi

echo "Origem: $SOURCE_DIR"
echo "Destino: $DIST_DIR"
echo ""

# Garantir que diretórios existem
mkdir -p "$DIST_DIR/backend/src/routes"
mkdir -p "$DIST_DIR/backend/src/services"
mkdir -p "$DIST_DIR/backend/src/middleware"
mkdir -p "$DIST_DIR/backend/src/config"
mkdir -p "$DIST_DIR/backend/src/utils"
mkdir -p "$DIST_DIR/backend/src/workers"
mkdir -p "$DIST_DIR/backend/src/types"

echo "Copiando arquivos do backend/src..."

# Copiar routes
if [ -d "$SOURCE_DIR/backend/src/routes" ]; then
    echo "  - Copiando routes..."
    rsync -av --delete \
        --exclude '*.test.ts' \
        --exclude '*.spec.ts' \
        "$SOURCE_DIR/backend/src/routes/" "$DIST_DIR/backend/src/routes/"
    echo "    ✅ Routes copiados"
else
    echo "    ⚠️  Diretório routes não encontrado na origem"
fi

# Copiar services
if [ -d "$SOURCE_DIR/backend/src/services" ]; then
    echo "  - Copiando services..."
    rsync -av --delete \
        --exclude '*.test.ts' \
        --exclude '*.spec.ts' \
        "$SOURCE_DIR/backend/src/services/" "$DIST_DIR/backend/src/services/"
    echo "    ✅ Services copiados"
else
    echo "    ⚠️  Diretório services não encontrado na origem"
fi

# Copiar middleware
if [ -d "$SOURCE_DIR/backend/src/middleware" ]; then
    echo "  - Copiando middleware..."
    rsync -av --delete \
        --exclude '*.test.ts' \
        --exclude '*.spec.ts' \
        "$SOURCE_DIR/backend/src/middleware/" "$DIST_DIR/backend/src/middleware/"
    echo "    ✅ Middleware copiado"
fi

# Copiar config
if [ -d "$SOURCE_DIR/backend/src/config" ]; then
    echo "  - Copiando config..."
    rsync -av --delete \
        "$SOURCE_DIR/backend/src/config/" "$DIST_DIR/backend/src/config/"
    echo "    ✅ Config copiado"
fi

# Copiar utils
if [ -d "$SOURCE_DIR/backend/src/utils" ]; then
    echo "  - Copiando utils..."
    rsync -av --delete \
        "$SOURCE_DIR/backend/src/utils/" "$DIST_DIR/backend/src/utils/"
    echo "    ✅ Utils copiado"
fi

# Copiar workers
if [ -d "$SOURCE_DIR/backend/src/workers" ]; then
    echo "  - Copiando workers..."
    rsync -av --delete \
        "$SOURCE_DIR/backend/src/workers/" "$DIST_DIR/backend/src/workers/"
    echo "    ✅ Workers copiados"
fi

# Copiar types
if [ -d "$SOURCE_DIR/backend/src/types" ]; then
    echo "  - Copiando types..."
    rsync -av --delete \
        "$SOURCE_DIR/backend/src/types/" "$DIST_DIR/backend/src/types/"
    echo "    ✅ Types copiados"
fi

# Verificar arquivos críticos
echo ""
echo "Verificando arquivos críticos..."

CRITICAL_FILES=(
    "backend/src/routes/auth.ts"
    "backend/src/routes/users.ts"
    "backend/src/routes/clients.ts"
    "backend/src/routes/totems.ts"
    "backend/src/routes/media.ts"
    "backend/src/services/eventLogService.ts"
    "backend/src/services/totemLogService.ts"
)

ALL_OK=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$DIST_DIR/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - FALTANDO"
        ALL_OK=false
    fi
done

# Contar arquivos
echo ""
echo "Estatísticas:"
ROUTES_COUNT=$(find "$DIST_DIR/backend/src/routes" -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" 2>/dev/null | wc -l)
SERVICES_COUNT=$(find "$DIST_DIR/backend/src/services" -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" 2>/dev/null | wc -l)

echo "  Routes: $ROUTES_COUNT arquivos .ts"
echo "  Services: $SERVICES_COUNT arquivos .ts"

if [ "$ALL_OK" = true ]; then
    echo ""
    echo "✅ Todos os arquivos críticos estão presentes!"
    echo "   Você pode tentar compilar novamente:"
    echo "   cd $DIST_DIR/backend && npm run build"
else
    echo ""
    echo "⚠️  Alguns arquivos ainda estão faltando."
    echo "   Verifique se o diretório de origem está correto."
fi


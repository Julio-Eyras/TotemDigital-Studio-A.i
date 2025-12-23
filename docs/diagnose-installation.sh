#!/bin/bash
# Script de diagnóstico para problemas de instalação

echo "🔍 DIAGNÓSTICO DO SMART SIGNAGE PRO v2.0"
echo "========================================"

# Verificar diretório atual
echo "📁 Diretório atual: $(pwd)"
echo "📁 Conteúdo do diretório atual:"
ls -la

echo ""
echo "🔍 Verificando estrutura do projeto..."

# Verificar se estamos no diretório correto
if [ -d "frontend" ]; then
    echo "✅ Diretório frontend encontrado"
    
    if [ -d "frontend/public" ]; then
        echo "✅ Diretório frontend/public encontrado"
        
        if [ -f "frontend/public/index.html" ]; then
            echo "✅ Arquivo frontend/public/index.html encontrado"
        else
            echo "❌ Arquivo frontend/public/index.html NÃO encontrado"
            echo "📁 Conteúdo de frontend/public/:"
            ls -la frontend/public/ 2>/dev/null || echo "Diretório não existe"
        fi
    else
        echo "❌ Diretório frontend/public NÃO encontrado"
    fi
    
    if [ -f "frontend/package.json" ]; then
        echo "✅ Arquivo frontend/package.json encontrado"
    else
        echo "❌ Arquivo frontend/package.json NÃO encontrado"
    fi
else
    echo "❌ Diretório frontend NÃO encontrado"
fi

echo ""
echo "🔍 Verificando diretório de instalação..."

INSTALL_DIR="/opt/smart-signage"
if [ -d "$INSTALL_DIR" ]; then
    echo "✅ Diretório de instalação encontrado: $INSTALL_DIR"
    
    if [ -d "$INSTALL_DIR/frontend" ]; then
        echo "✅ Diretório $INSTALL_DIR/frontend encontrado"
        
        if [ -d "$INSTALL_DIR/frontend/public" ]; then
            echo "✅ Diretório $INSTALL_DIR/frontend/public encontrado"
            
            if [ -f "$INSTALL_DIR/frontend/public/index.html" ]; then
                echo "✅ Arquivo $INSTALL_DIR/frontend/public/index.html encontrado"
            else
                echo "❌ Arquivo $INSTALL_DIR/frontend/public/index.html NÃO encontrado"
                echo "📁 Conteúdo de $INSTALL_DIR/frontend/public/:"
                ls -la "$INSTALL_DIR/frontend/public/" 2>/dev/null || echo "Diretório não existe"
            fi
        else
            echo "❌ Diretório $INSTALL_DIR/frontend/public NÃO encontrado"
        fi
        
        if [ -f "$INSTALL_DIR/frontend/package.json" ]; then
            echo "✅ Arquivo $INSTALL_DIR/frontend/package.json encontrado"
        else
            echo "❌ Arquivo $INSTALL_DIR/frontend/package.json NÃO encontrado"
        fi
    else
        echo "❌ Diretório $INSTALL_DIR/frontend NÃO encontrado"
    fi
else
    echo "❌ Diretório de instalação NÃO encontrado: $INSTALL_DIR"
fi

echo ""
echo "🔍 Verificando permissões..."

if [ -w "/opt" ]; then
    echo "✅ Permissão de escrita em /opt"
else
    echo "❌ Sem permissão de escrita em /opt"
fi

if [ -w "/opt/smart-signage" ]; then
    echo "✅ Permissão de escrita em /opt/smart-signage"
else
    echo "❌ Sem permissão de escrita em /opt/smart-signage"
fi

echo ""
echo "🔍 Verificando usuário atual..."
echo "👤 Usuário: $(whoami)"
echo "👤 UID: $(id -u)"
echo "👤 GID: $(id -g)"

echo ""
echo "🔍 Verificando grupos do usuário..."
groups

echo ""
echo "📋 RESUMO DO DIAGNÓSTICO:"
echo "========================="

# Contar problemas
PROBLEMS=0

if [ ! -f "frontend/public/index.html" ]; then
    echo "❌ Problema 1: index.html não encontrado no projeto local"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ ! -d "/opt/smart-signage" ]; then
    echo "❌ Problema 2: Instalação não encontrada"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ ! -f "/opt/smart-signage/frontend/public/index.html" ]; then
    echo "❌ Problema 3: index.html não encontrado na instalação"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ $PROBLEMS -eq 0 ]; then
    echo "✅ Nenhum problema detectado!"
else
    echo "⚠️  $PROBLEMS problema(s) detectado(s)"
fi

echo ""
echo "💡 SOLUÇÕES SUGERIDAS:"
echo "======================"

if [ ! -f "frontend/public/index.html" ]; then
    echo "1. Execute: git checkout frontend/public/index.html"
fi

if [ ! -d "/opt/smart-signage" ]; then
    echo "2. Execute: sudo ./install-smartsignage.sh"
fi

if [ ! -f "/opt/smart-signage/frontend/public/index.html" ]; then
    echo "3. Execute: sudo cp frontend/public/index.html /opt/smart-signage/frontend/public/"
fi

echo ""
echo "🔧 Script de correção automática disponível:"
echo "   ./fix-frontend-build.sh"

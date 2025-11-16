#!/bin/bash

# Script de Preparação para Migração v2.0 → v2.1
# Este script preserva a versão atual e prepara o ambiente para a nova versão

set -e

echo "🚀 Preparando migração v2.0 → v2.1"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar se estamos no diretório raiz do projeto
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Erro: Execute este script no diretório raiz do projeto${NC}"
    exit 1
fi

# Verificar se há mudanças não commitadas
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Há mudanças não commitadas. Deseja continuar mesmo assim? (s/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Ss]$ ]]; then
        echo "Operação cancelada."
        exit 1
    fi
fi

echo -e "${BLUE}📋 FASE 1: Preservando versão atual (v2.0.0)${NC}"

# Verificar se a tag v2.0.0 já existe
if git rev-parse "v2.0.0" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Tag v2.0.0 já existe. Deseja atualizá-la? (s/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        git tag -d v2.0.0 2>/dev/null || true
        git push origin :refs/tags/v2.0.0 2>/dev/null || true
    else
        echo "Operação cancelada."
        exit 1
    fi
fi

# Garantir que tudo está commitado
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}📝 Commitando mudanças pendentes...${NC}"
    git add -A
    git commit -m "chore: Finalizar v2.0.0 antes da migração para v2.1.0" || true
fi

# Criar tag v2.0.0
echo -e "${GREEN}📌 Criando tag v2.0.0...${NC}"
git tag -a v2.0.0 -m "Versão 2.0.0 - Última versão com Prisma e suporte a SQLite

Características desta versão:
- Usa Prisma como ORM
- Suporte a PostgreSQL e SQLite
- Schema Prisma incompleto (15 modelos vs 40 tabelas do modelo E.R.)
- DatabaseWrapper para compatibilidade com SQL raw queries

Esta versão é preservada antes da migração para v2.1.0 que:
- Remove Prisma completamente
- Usa PostgreSQL diretamente via pg
- Remove suporte ao SQLite
- Garante que todas as 40 tabelas do modelo E.R. tenham seeds"

echo -e "${GREEN}✅ Tag v2.0.0 criada${NC}"

# Push da tag (opcional)
echo -e "${BLUE}📤 Enviando tag v2.0.0 para o repositório remoto...${NC}"
if git push origin v2.0.0 2>/dev/null; then
    echo -e "${GREEN}✅ Tag v2.0.0 enviada para o repositório remoto${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível enviar a tag (pode não haver remote configurado)${NC}"
fi

echo ""
echo -e "${BLUE}📋 FASE 2: Criando branch para v2.1.0${NC}"

# Verificar se a branch já existe
if git show-ref --verify --quiet refs/heads/release/v2.1.0; then
    echo -e "${YELLOW}⚠️  Branch release/v2.1.0 já existe. Deseja fazer checkout? (s/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        git checkout release/v2.1.0
        echo -e "${GREEN}✅ Branch release/v2.1.0 já existe e foi selecionada${NC}"
    else
        echo "Operação cancelada."
        exit 1
    fi
else
    # Criar nova branch
    echo -e "${GREEN}🌿 Criando branch release/v2.1.0...${NC}"
    git checkout -b release/v2.1.0
    echo -e "${GREEN}✅ Branch release/v2.1.0 criada${NC}"
fi

echo ""
echo -e "${BLUE}📋 FASE 3: Atualizando versões nos package.json${NC}"

# Atualizar versão no package.json raiz
if [[ -f "package.json" ]]; then
    echo -e "${GREEN}📝 Atualizando package.json...${NC}"
    # Usar sed para atualizar versão (funciona em Linux, macOS e Git Bash no Windows)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/"version": "2.0.0"/"version": "2.1.0"/' package.json
    else
        # Linux/Git Bash
        sed -i 's/"version": "2.0.0"/"version": "2.1.0"/' package.json
    fi
    echo -e "${GREEN}✅ Versão atualizada para 2.1.0 no package.json${NC}"
fi

# Atualizar versão no backend/package.json
if [[ -f "backend/package.json" ]]; then
    echo -e "${GREEN}📝 Atualizando backend/package.json...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/"version": "2.0.0"/"version": "2.1.0"/' backend/package.json
    else
        sed -i 's/"version": "2.0.0"/"version": "2.1.0"/' backend/package.json
    fi
    echo -e "${GREEN}✅ Versão atualizada para 2.1.0 no backend/package.json${NC}"
fi

# Atualizar versão no frontend/package.json (se existir)
if [[ -f "frontend/package.json" ]]; then
    echo -e "${GREEN}📝 Atualizando frontend/package.json...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/"version": "2.0.0"/"version": "2.1.0"/' frontend/package.json
    else
        sed -i 's/"version": "2.0.0"/"version": "2.1.0"/' frontend/package.json
    fi
    echo -e "${GREEN}✅ Versão atualizada para 2.1.0 no frontend/package.json${NC}"
fi

echo ""
echo -e "${BLUE}📋 FASE 4: Criando arquivo CHANGELOG.md${NC}"

# Criar ou atualizar CHANGELOG.md
if [[ ! -f "CHANGELOG.md" ]]; then
    cat > CHANGELOG.md << 'EOF'
# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.1.0] - 2025-11-03 (Em Desenvolvimento)

### 🚀 Migração Major: Remoção do Prisma

#### Adicionado
- Suporte direto ao PostgreSQL via `pg` client
- Novo módulo `database-pg.ts` com connection pooling
- Interfaces TypeScript para type safety manual
- Scripts de validação de seeds para todas as 40 tabelas

#### Removido
- Prisma ORM (`@prisma/client`, `prisma`)
- Schema Prisma (`prisma/schema.prisma`)
- Suporte ao SQLite completamente removido
- DatabaseWrapper que convertia SQL para Prisma
- Opção SQLite do instalador

#### Alterado
- Todas as queries agora usam PostgreSQL diretamente
- Schema agora é gerenciado exclusivamente via `smartchannel-db.sql`
- Seeds agora são gerenciados exclusivamente via `init-data.sql`
- Melhor performance com connection pooling nativo do PostgreSQL

#### Corrigido
- Todas as 40 tabelas do modelo E.R. agora são criadas corretamente
- Seeds para todas as tabelas agora são populados corretamente
- Conflitos entre schema SQL e Prisma resolvidos

---

## [2.0.0] - 2025-11-03

### Estado Preservado
- Última versão com Prisma ORM
- Suporte a PostgreSQL e SQLite
- DatabaseWrapper para compatibilidade com SQL raw queries

---

EOF
    echo -e "${GREEN}✅ CHANGELOG.md criado${NC}"
else
    echo -e "${YELLOW}⚠️  CHANGELOG.md já existe. Adicione manualmente as mudanças da v2.1.0${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ PREPARAÇÃO CONCLUÍDA! ✅                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Resumo:${NC}"
echo -e "  ✅ Tag v2.0.0 criada (versão preservada)"
echo -e "  ✅ Branch release/v2.1.0 criada/selecionada"
echo -e "  ✅ Versões atualizadas para 2.1.0"
echo -e "  ✅ CHANGELOG.md criado/verificado"
echo ""
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo -e "  1. Revisar o arquivo PLANO_MIGRACAO_V2.1.md"
echo -e "  2. Iniciar a migração seguindo o plano"
echo -e "  3. Testar todas as mudanças antes de fazer merge"
echo ""
echo -e "${GREEN}🎯 Você está pronto para iniciar a migração!${NC}"


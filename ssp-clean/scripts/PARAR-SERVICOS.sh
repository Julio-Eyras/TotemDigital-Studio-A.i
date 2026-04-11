#!/bin/bash

# ============================================
# Smart Signage Pro - Parar Servicos
# Linux/macOS
# ============================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

function print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

function print_error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

function print_info() {
    echo -e "${GRAY}  $1${NC}"
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"

print_header "Parando Servicos Smart Signage Pro"

# Parar processos usando PIDs salvos
if [ -f "$ROOT_DIR/.backend.pid" ]; then
    BACKEND_PID=$(cat "$ROOT_DIR/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_info "Parando Backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || kill -9 $BACKEND_PID 2>/dev/null || true
        print_success "Backend parado (PID: $BACKEND_PID)"
    fi
    rm -f "$ROOT_DIR/.backend.pid"
fi

if [ -f "$ROOT_DIR/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$ROOT_DIR/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_info "Parando Frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || kill -9 $FRONTEND_PID 2>/dev/null || true
        print_success "Frontend parado (PID: $FRONTEND_PID)"
    fi
    rm -f "$ROOT_DIR/.frontend.pid"
fi

# Parar processos nas portas (fallback)
print_info "Verificando processos nas portas..."

# Backend
BACKEND_PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null || true)
if [ -n "$BACKEND_PID" ]; then
    print_info "Encontrado processo na porta $BACKEND_PORT com PID: $BACKEND_PID"
    kill -9 $BACKEND_PID 2>/dev/null || true
    print_success "Processo na porta $BACKEND_PORT (PID: $BACKEND_PID) parado"
else
    print_info "Nenhum processo encontrado na porta $BACKEND_PORT"
fi

# Frontend
FRONTEND_PID=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || true)
if [ -n "$FRONTEND_PID" ]; then
    print_info "Encontrado processo na porta $FRONTEND_PORT com PID: $FRONTEND_PID"
    kill -9 $FRONTEND_PID 2>/dev/null || true
    print_success "Processo na porta $FRONTEND_PORT (PID: $FRONTEND_PID) parado"
else
    print_info "Nenhum processo encontrado na porta $FRONTEND_PORT"
fi

echo ""
print_header "Verificando Status Final"

ALL_STOPPED=true

# Verificar Backend
if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
    print_error "Servico na porta $BACKEND_PORT ainda esta ativo."
    ALL_STOPPED=false
else
    print_success "Servico na porta $BACKEND_PORT esta parado."
fi

# Verificar Frontend
if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
    print_error "Servico na porta $FRONTEND_PORT ainda esta ativo."
    ALL_STOPPED=false
else
    print_success "Servico na porta $FRONTEND_PORT esta parado."
fi

echo ""
if [ "$ALL_STOPPED" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Todos os servicos foram parados com sucesso!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Alguns servicos podem nao ter parado. Verifique manualmente.${NC}"
    echo -e "${YELLOW}========================================${NC}"
fi
echo ""


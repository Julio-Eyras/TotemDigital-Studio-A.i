#!/usr/bin/env bash
# =============================================================================
# Smart Signage Pro — gestão single-server (systemd + Nginx)
# Instalador copia este ficheiro para <raiz-do-projeto>/manage.sh
# INSTALL_DIR = pasta onde este script está (raiz do repo / deploy).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
INSTALL_DIR="$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; }
warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

run_sudo() {
    if command -v sudo &>/dev/null && [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
        sudo "$@"
    else
        "$@"
    fi
}

ensure_unit_exists() {
    if [[ -f /etc/systemd/system/smart-signage.service ]]; then
        return 0
    fi
    local helper="$INSTALL_DIR/scripts/create-smart-signage-service.sh"
    if [[ ! -f "$helper" ]]; then
        error "Unit systemd em falta e helper não encontrado: $helper"
        return 1
    fi
    warning "A criar smart-signage.service via $helper ..."
    run_sudo bash "$helper" "$INSTALL_DIR" || return 1
    run_sudo systemctl daemon-reload
    return 0
}

case "${1:-}" in
    start)
        log "A iniciar backend (smart-signage) e Nginx..."
        ensure_unit_exists || exit 1
        run_sudo systemctl enable smart-signage.service 2>/dev/null || true
        run_sudo systemctl start smart-signage.service || {
            error "Falha ao iniciar smart-signage. Ver: journalctl -u smart-signage -n 50"
            exit 1
        }
        run_sudo systemctl start nginx 2>/dev/null || true
        log "✅ Backend e Nginx iniciados (ou já ativos)."
        ;;
    stop)
        log "A parar backend (smart-signage)..."
        if systemctl list-unit-files --type=service 2>/dev/null | grep -q '^smart-signage\.service'; then
            run_sudo systemctl stop smart-signage.service 2>/dev/null || true
        else
            warning "Unit smart-signage não encontrado — nada a parar."
        fi
        log "✅ Backend parado (Nginx mantido-se; use 'systemctl stop nginx' se precisar)."
        ;;
    restart)
        log "A reiniciar smart-signage..."
        ensure_unit_exists || exit 1
        run_sudo systemctl restart smart-signage.service || exit 1
        run_sudo systemctl reload nginx 2>/dev/null || run_sudo systemctl restart nginx 2>/dev/null || true
        log "✅ Reinício concluído."
        ;;
    status)
        log "Estado do Smart Signage (single-server)"
        echo ""
        if [[ -f /etc/systemd/system/smart-signage.service ]]; then
            info "smart-signage.service: $(systemctl is-enabled smart-signage.service 2>/dev/null || echo '?')"
            systemctl is-active --quiet smart-signage.service 2>/dev/null && info "smart-signage: ativo" || warning "smart-signage: inativo"
            run_sudo systemctl status smart-signage.service --no-pager -l 2>/dev/null | head -45 || true
        else
            warning "Ficheiro /etc/systemd/system/smart-signage.service em falta."
        fi
        echo ""
        SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        [[ -z "$SERVER_IP" ]] && SERVER_IP="127.0.0.1"
        echo "📊 URLs (ajuste firewall/DNS se necessário):"
        echo "  Painel / API (via Nginx): http://$SERVER_IP/"
        echo "  Backend directo:        http://$SERVER_IP:3000/health"
        ;;
    logs)
        log "Logs do backend (Ctrl+C para sair)..."
        run_sudo journalctl -u smart-signage.service -f
        ;;
    update)
        log "Atualizar código, dependências e rebuild (local)..."
        cd "$INSTALL_DIR" || exit 1
        git pull origin main || warning "git pull falhou ou não é repo git"
        (cd "$INSTALL_DIR/backend" && npm install --include=dev && npm run build) || {
            error "Build do backend falhou."
            exit 1
        }
        (cd "$INSTALL_DIR/frontend" && npm install --legacy-peer-deps && npm run build) || {
            error "Build do frontend falhou."
            exit 1
        }
        log "A reiniciar smart-signage..."
        ensure_unit_exists || exit 1
        run_sudo systemctl restart smart-signage.service
        run_sudo systemctl reload nginx 2>/dev/null || true
        log "✅ Update local concluído. Se o Nginx servir build de /opt/smart-signage, copie o build ou volte a correr o instalador para sincronizar."
        ;;
    backup)
        log "Backup de data/logs (se existirem)..."
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "$BACKUP_FILE" -C "$INSTALL_DIR" data logs 2>/dev/null || tar -czf "$BACKUP_FILE" -C "$INSTALL_DIR" . --exclude=node_modules --exclude=.git 2>/dev/null || {
            warning "Nada compactado (pastas data/logs podem não existir)."
        }
        log "✅ $BACKUP_FILE"
        ;;
    autostart)
        log "Habilitar smart-signage no arranque (NÃO substitui o unit Node por Docker)."
        ensure_unit_exists || exit 1
        run_sudo systemctl daemon-reload
        run_sudo systemctl enable smart-signage.service || exit 1
        run_sudo systemctl start smart-signage.service 2>/dev/null || true
        log "✅ smart-signage.service enabled. Estado: $(systemctl is-enabled smart-signage.service 2>/dev/null)"
        log "Para desabilitar: $0 disable-autostart"
        ;;
    disable-autostart)
        log "A desabilitar smart-signage no boot..."
        if systemctl list-unit-files --type=service 2>/dev/null | grep -q '^smart-signage\.service'; then
            run_sudo systemctl disable smart-signage.service 2>/dev/null || true
            log "✅ Autostart desligado (o unit mantém-se em disco)."
        else
            warning "Unit smart-signage não encontrado."
        fi
        ;;
    *)
        echo "Smart Signage Pro — manage.sh (single-server)"
        echo "Uso: $0 {start|stop|restart|status|logs|update|backup|autostart|disable-autostart}"
        echo ""
        echo "  start              — systemctl start smart-signage (+ nginx)"
        echo "  stop               — systemctl stop smart-signage"
        echo "  restart            — restart backend + reload nginx"
        echo "  status             — systemd + URLs"
        echo "  logs               — journalctl -f do backend"
        echo "  update             — git pull + build backend/frontend + restart"
        echo "  backup             — tar.gz na raiz do projeto"
        echo "  autostart          — enable smart-signage (cria unit se faltar)"
        echo "  disable-autostart  — disable smart-signage no boot"
        exit 1
        ;;
esac

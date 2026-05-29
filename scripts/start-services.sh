#!/usr/bin/env bash
# =============================================================================
# SmartSignage Pro - Iniciar serviços (Nginx + Backend) e validar portas 80 e 3000
# Uso: sudo bash scripts/start-services.sh
#      ou, a partir do repo: bash scripts/start-services.sh
# =============================================================================

set -e

INSTALL_DIR="${INSTALL_DIR:-/opt/smart-signage}"
# Se o script está no repo (não em /opt), usar diretório do script como base para backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ -d "$SCRIPT_DIR/../backend" ]] && [[ -f "$SCRIPT_DIR/../backend/dist/index.js" ]]; then
    INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

echo "=== SmartSignage Pro - Iniciar serviços ==="
echo "INSTALL_DIR (backend): $INSTALL_DIR"

# 1. PostgreSQL
if command -v systemctl &>/dev/null; then
    for svc in postgresql "postgresql@14-main" "postgresql@16-main"; do
        if systemctl list-unit-files --state=enabled,generated 2>/dev/null | grep -q "$svc"; then
            if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
                echo "Iniciando $svc..."
                sudo systemctl start "$svc" 2>/dev/null || true
            fi
            break
        fi
    done
fi

# 2. Redis (opcional)
if command -v systemctl &>/dev/null && systemctl list-unit-files 2>/dev/null | grep -q redis-server; then
    if ! systemctl is-active --quiet redis-server 2>/dev/null; then
        echo "Iniciando redis-server..."
        sudo systemctl start redis-server 2>/dev/null || true
    fi
fi

# 3. Backend (systemd) — criar unit se não existir e iniciar
if [[ ! -f /etc/systemd/system/smart-signage.service ]]; then
    echo "Unit smart-signage.service não encontrado. A criar automaticamente..."
    if [[ -f "$SCRIPT_DIR/create-smart-signage-service.sh" ]]; then
        bash "$SCRIPT_DIR/create-smart-signage-service.sh" "$INSTALL_DIR"
    else
        echo "ERRO: scripts/create-smart-signage-service.sh não encontrado. Execute: sudo bash scripts/install-smartsignage.sh --skip-menu --mode single-server"
        exit 1
    fi
fi
echo "Iniciando serviço smart-signage (backend)..."
sudo systemctl daemon-reload
sudo systemctl enable smart-signage 2>/dev/null || true
sudo systemctl start smart-signage
for i in 1 2 3 4 5 6 7 8 9 10; do
    if systemctl is-active --quiet smart-signage; then
        echo "Backend (smart-signage) está ativo."
        break
    fi
    if [[ $i -eq 10 ]]; then
        echo "AVISO: Serviço smart-signage não ficou ativo. Logs:"
        sudo journalctl -u smart-signage --no-pager -n 30 || true
        echo "Verifique: sudo systemctl status smart-signage"
    fi
    sleep 2
done

# 4. Nginx
if command -v nginx &>/dev/null; then
    echo "Iniciando Nginx..."
    sudo systemctl enable nginx 2>/dev/null || true
    sudo systemctl start nginx 2>/dev/null || true
    sudo systemctl restart nginx 2>/dev/null || true
    sleep 2
    if systemctl is-active --quiet nginx; then
        echo "Nginx está ativo."
    else
        echo "AVISO: Nginx não iniciou. Verifique: sudo nginx -t && sudo systemctl status nginx"
        # Fallback: só em modo porta-80 exclusiva do painel (não com site corporativo na :80)
        _ss_env=""
        for _cand in /opt/smart-signage/.env "${INSTALL_DIR:-}/.env" "$SCRIPT_DIR/../.env"; do
            [[ -f "$_cand" ]] && _ss_env="$_cand" && break
        done
        if [[ -n "$_ss_env" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "$_ss_env" 2>/dev/null; then
            echo "AVISO: layout dividido (site corporativo na :80). Não aplicar fix-nginx-and-port80."
            echo "       Corrija Nginx: sudo nginx -t && sudo systemctl reload nginx"
        elif [[ -f "$SCRIPT_DIR/fix-nginx-and-port80.sh" ]]; then
            echo "Tentando aplicar fix-nginx-and-port80.sh..."
            bash "$SCRIPT_DIR/fix-nginx-and-port80.sh" || true
        fi
    fi
else
    echo "AVISO: Nginx não instalado. Instale: sudo apt-get install -y nginx"
fi

# 5. Verificar portas
echo ""
echo "=== Estado das portas ==="
ok=0
if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "OK: Backend a escutar na porta 3000"
    ok=$((ok+1))
else
    echo "FALTA: Nada na porta 3000 (backend). Comandos: sudo systemctl status smart-signage; sudo journalctl -u smart-signage -n 50"
fi
if ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo "OK: Nginx (ou outro) a escutar na porta 80"
    ok=$((ok+1))
else
    echo "FALTA: Nada na porta 80 (Nginx). Comandos: sudo systemctl status nginx; sudo nginx -t"
fi

echo ""
if [[ $ok -eq 2 ]]; then
    echo "Serviços em execução. Aceda: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
    exit 0
else
    echo "Nem todas as portas estão ativas. Corrija os avisos acima e execute novamente:"
    echo "  sudo bash $SCRIPT_DIR/start-services.sh"
    exit 1
fi

#!/usr/bin/env bash
# Instala e configura DuckDNS no Ubuntu (cliente + timer systemd).
#
# O token NUNCA deve ficar no repositório. Define antes de executar:
#   export DUCKDNS_TOKEN='...'   # obrigatório
#   export DUCKDNS_DOMAIN=totemdigital.duckdns.org   # opcional (default abaixo)
#   sudo -E ./scripts/install_duckdns.sh
#
# Se o token chegou a ser exposto num ficheiro antigo, gera um novo em duckdns.org.

set -euo pipefail

# Domínio DuckDNS (subdomínio ou FQDN — normaliza-se para o nome em duckdns.org)
DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-totemdigital.duckdns.org}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"

if [[ -z "${DUCKDNS_TOKEN}" ]]; then
  echo "Defina DUCKDNS_TOKEN (token da conta DuckDNS). Ex.: sudo -E env DUCKDNS_TOKEN='...' $0" >&2
  exit 1
fi

INSTALL_DIR="${DUCKDNS_INSTALL_DIR:-/opt/duckdns}"
SERVICE_NAME="${DUCKDNS_SERVICE_NAME:-duckdns}"

normalize_domain() {
    local d="$1"
    d="${d%.duckdns.org}"
    d="${d#https://}"
    d="${d#http://}"
    d="${d%%/*}"
    echo "$d"
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Este script precisa de permissões de root (ex.: sudo $0)." >&2
    exit 1
fi

DOMAIN_API="$(normalize_domain "$DUCKDNS_DOMAIN")"
if [[ -z "$DOMAIN_API" || "$DOMAIN_API" == *.* ]]; then
    echo "Domínio inválido após normalização: '$DUCKDNS_DOMAIN' -> '$DOMAIN_API'" >&2
    echo "Usa o nome do subdomínio (ex.: totemdigital) ou totemdigital.duckdns.org" >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
if ! command -v curl >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y curl
fi

mkdir -p "$INSTALL_DIR"

cat >"$INSTALL_DIR/duck.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DOMAIN="$DOMAIN_API"
TOKEN="$DUCKDNS_TOKEN"
LOG="$INSTALL_DIR/duck.log"
echo url="https://www.duckdns.org/update?domains=\${DOMAIN}&token=\${TOKEN}&ip=" \\
  | curl --silent --show-error --fail -k -o "\$LOG" -K -
EOF
chmod 700 "$INSTALL_DIR/duck.sh"

cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=DuckDNS updater (${DOMAIN_API}.duckdns.org)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$INSTALL_DIR/duck.sh
EOF

cat >"/etc/systemd/system/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=Executar atualização DuckDNS a cada 5 minutos

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"

echo "----------------------------------------------------------------"
echo "DuckDNS configurado."
echo "  API domain: ${DOMAIN_API}"
echo "  URL pública: https://${DOMAIN_API}.duckdns.org"
echo "  Script: $INSTALL_DIR/duck.sh"
echo "  Log:    $INSTALL_DIR/duck.log"
echo "  Timer:  systemctl status ${SERVICE_NAME}.timer"
echo "  Teste:  $INSTALL_DIR/duck.sh && cat $INSTALL_DIR/duck.log"
echo "----------------------------------------------------------------"

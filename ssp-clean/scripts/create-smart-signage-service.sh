#!/usr/bin/env bash
# Cria o unit systemd smart-signage.service (backend Node) quando o install termina
# antes de create_systemd_service (ex.: serviço foi removido). Uso:
#   ./scripts/create-smart-signage-service.sh [INSTALL_DIR]
#   sudo systemctl daemon-reload && sudo systemctl enable --now smart-signage

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="${1:-$REPO_DIR}"
USER="${SUDO_USER:-$(whoami)}"

if [[ ! -d "$INSTALL_DIR/backend" ]]; then
  echo "Erro: $INSTALL_DIR/backend não encontrado. Use: $0 /caminho/para/SmartSignage-Pro"
  exit 1
fi

if [[ ! -f "$INSTALL_DIR/backend/dist/index.js" ]]; then
  echo "Erro: backend não compilado. Execute: cd $INSTALL_DIR/backend && npm run build"
  exit 1
fi

ENV_FILE="$INSTALL_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Aviso: $ENV_FILE não encontrado. O serviço usará variáveis padrão."
fi

SERVICE_FILE="/etc/systemd/system/smart-signage.service"
echo "Criando $SERVICE_FILE (INSTALL_DIR=$INSTALL_DIR, User=$USER)..."

sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Smart Signage Pro Backend
After=network.target postgresql.service
Wants=network.target postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStartPre=/bin/sh -c 'PGPASSWORD=smartsignage123 pg_isready -h 127.0.0.1 -p 5432 -U smartsignage -d smartsignage -t 10 || exit 0'
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PLAYER_DIR=/opt/smart-signage/player-web
EnvironmentFile=-$INSTALL_DIR/.env
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo "✅ Serviço criado. Para iniciar: sudo systemctl enable --now smart-signage"

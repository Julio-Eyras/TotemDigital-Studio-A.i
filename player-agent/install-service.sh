#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=smartplayer-agent
WORKDIR=$(cd "$(dirname "$0")" && pwd)

echo "[install] Instalando dependências do agent (nenhuma obrigatória)"

echo "[install] Criando unit systemd..."
sudo bash -c "cat > /etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SmartSignage SmartPlayer Agent
After=network.target
Wants=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
WorkingDirectory=${WORKDIR}
ExecStart=/usr/bin/node ${WORKDIR}/agent.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "[install] Recarregando systemd..."
sudo systemctl daemon-reload
echo "[install] Pronto. Habilite e inicie com:"
echo "  sudo systemctl enable ${SERVICE_NAME}"
echo "  sudo systemctl start ${SERVICE_NAME}"



[Unit]
Description=TotemDigital Backend (@@TDI_LABEL@@ — @@TDI_DOMAIN@@)
After=network.target postgresql.service
Wants=network.target postgresql.service

[Service]
Type=simple
User=@@TDI_RUN_USER@@
Group=@@TDI_RUN_USER@@
WorkingDirectory=@@TDI_CLONE_DIR@@/backend
ExecStartPre=/bin/sh -c 'pg_isready -h 127.0.0.1 -p 5432 -t 10 || exit 0'
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PLAYER_DIR=@@TDI_OPT_ROOT@@/player-web
Environment=UPLOAD_PATH=@@TDI_OPT_ROOT@@/public/assets/uploads
Environment=ASSETS_BASE_PATH=@@TDI_OPT_ROOT@@/public/assets
EnvironmentFile=-@@TDI_CLONE_DIR@@/.env
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target

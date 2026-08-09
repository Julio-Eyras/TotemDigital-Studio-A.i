cd ~/TotemDigital-Studio

git fetch origin
git checkout TotemDigital-MultiAgencia
git pull --ff-only origin TotemDigital-MultiAgencia

export TOTEMDIGITAL_INSTALL_PRESET=true
export INSTALL_TOTEMDIGITAL_COMPACT=true
export SYSTEM_OWNER_ADMIN_USERNAME=ismael
export SYSTEM_OWNER_NAME="Totem Digital"
export SYSTEM_OWNER_EMAIL=admin@totemdigital.app.br

export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_PUBLIC_HOST=totemdigital.app.br
export SMARTSIGNAGE_DOMAIN_NAME=totemdigital.app.br
export SMARTSIGNAGE_SSL_EMAIL=admin@totemdigital.app.br
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080

bash scripts/install-smartsignage.sh \
  --fresh \
  --mode single-server-prod \
  --totemdigital-preset \
  --totemdigital-compact \
  --direct-totem \
  --split-corporate-system \
  --public-host totemdigital.app.br \
  --corporate-http-port 80 \
  --system-http-port 8080 \
  --mqtt-mode dev \
  --skip-players \
  --no-seeds \
  --skip-menu


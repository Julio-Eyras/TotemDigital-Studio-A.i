#!/usr/bin/env bash
set -euo pipefail

# Reemite o certificado Let's Encrypt em RSA para compatibilidade com Android/TV boxes antigas,
# depois reaplica o Nginx HTTPS unificado do projeto.
#
# Uso:
#   cd ~/TotemDigital-Studio
#   bash scripts/reissue-letsencrypt-rsa.sh

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  if [[ -n "${SUDO_USER:-}" ]] && [[ "${SUDO_USER}" != "root" ]]; then
    exec sudo -u "$SUDO_USER" -H bash "$0" "$@"
  fi
  echo "[ERRO] Nao execute como root. Use: bash scripts/reissue-letsencrypt-rsa.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

env_file="$ROOT/.env"
[[ -f "$ROOT/backend/.env" ]] && backend_env="$ROOT/backend/.env" || backend_env=""

domain="$(grep -E '^DOMAIN_NAME=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
if [[ -z "$domain" && -n "$backend_env" ]]; then
  domain="$(grep -E '^DOMAIN_NAME=' "$backend_env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
fi
email="$(grep -E '^SSL_EMAIL=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
if [[ -z "$email" && -n "$backend_env" ]]; then
  email="$(grep -E '^SSL_EMAIL=' "$backend_env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
fi

if [[ -z "$domain" ]]; then
  echo "[ERRO] DOMAIN_NAME nao encontrado no .env"
  exit 1
fi
if [[ -z "$email" ]]; then
  echo "[ERRO] SSL_EMAIL nao encontrado no .env"
  echo "       Adicione SSL_EMAIL=seu-email@dominio no .env e tente novamente."
  exit 1
fi

www_dns=""
if command -v dig >/dev/null 2>&1; then
  www_dns="$(dig +short "www.$domain" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)"
elif command -v host >/dev/null 2>&1; then
  www_dns="$(host -t A "www.$domain" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
fi

domains=(-d "$domain")
if [[ -n "$www_dns" ]]; then
  domains+=(-d "www.$domain")
  echo "[INFO] Incluindo www.$domain no certificado RSA."
else
  echo "[INFO] www.$domain sem DNS publico; certificado RSA so para $domain."
fi

echo "[INFO] A emitir/renovar certificado RSA para $domain ..."
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo certbot certonly --webroot -w /var/www/certbot \
  "${domains[@]}" \
  --non-interactive --agree-tos --email "$email" --expand \
  --key-type rsa --rsa-key-size 2048 --preferred-challenges http

echo "[INFO] A reaplicar Nginx HTTPS unificado..."
bash "$ROOT/scripts/apply-https-unified-443.sh"

echo
echo "[OK] Certificado RSA aplicado."
echo "Verificar:"
echo "  sudo openssl x509 -in /etc/letsencrypt/live/$domain/cert.pem -noout -text | grep 'Public Key Algorithm' -m 1"
echo "  curl -I https://$domain/"

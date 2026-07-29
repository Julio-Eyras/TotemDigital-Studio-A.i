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
# Fallbacks: env SMARTSIGNAGE_SSL_EMAIL, SYSTEM_OWNER_EMAIL, renewal conf do Certbot, admin@dominio
if [[ -z "$email" ]]; then
  email="${SMARTSIGNAGE_SSL_EMAIL:-}"
fi
if [[ -z "$email" ]]; then
  email="$(grep -E '^SYSTEM_OWNER_EMAIL=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
fi
if [[ -z "$email" && -n "${domain:-}" ]] && sudo test -f "/etc/letsencrypt/renewal/${domain}.conf" 2>/dev/null; then
  email="$(sudo grep -E '^email\s*=' "/etc/letsencrypt/renewal/${domain}.conf" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
fi
if [[ -z "$email" && -n "${domain:-}" ]]; then
  email="admin@${domain}"
  echo "[INFO] SSL_EMAIL ausente — a usar fallback: $email"
fi

if [[ -z "$domain" ]]; then
  echo "[ERRO] DOMAIN_NAME nao encontrado no .env"
  exit 1
fi
if [[ -z "$email" ]]; then
  echo "[ERRO] Nao foi possivel determinar e-mail SSL."
  echo "       Defina: export SMARTSIGNAGE_SSL_EMAIL=seu@email.com"
  echo "       Ou adicione SSL_EMAIL=... no .env"
  exit 1
fi

# Persistente no .env para proximas corridas
if [[ -f "$env_file" ]] && ! grep -qE '^SSL_EMAIL=' "$env_file" 2>/dev/null; then
  if [[ -w "$env_file" ]]; then
    echo "SSL_EMAIL=${email}" >> "$env_file"
  else
    echo "SSL_EMAIL=${email}" | sudo tee -a "$env_file" >/dev/null
    sudo chown "$(id -u):$(id -g)" "$env_file" 2>/dev/null || true
  fi
  echo "[INFO] SSL_EMAIL=${email} gravado em .env"
fi
echo "[INFO] Domínio: $domain | e-mail LE: $email"

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

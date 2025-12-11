#!/bin/bash
# Script para corrigir comando do Nginx no docker-compose.yml

DOCKER_COMPOSE_FILE="/opt/smart-signage/docker-compose.yml"

if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    echo "ERRO: docker-compose.yml não encontrado em $DOCKER_COMPOSE_FILE"
    exit 1
fi

echo "Corrigindo comando do Nginx no docker-compose.yml..."

# Criar backup
cp "$DOCKER_COMPOSE_FILE" "$DOCKER_COMPOSE_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Verificar se já está correto (verifica se tem COUNT ao invés de WAIT_COUNT)
if grep -q "COUNT=0" "$DOCKER_COMPOSE_FILE"; then
    echo "✅ docker-compose.yml já está atualizado"
    exit 0
fi

# Remover seção antiga do comando nginx e adicionar nova
sed -i '/# Garantir que nosso default.conf seja usado/,/^[[:space:]]*"[[:space:]]*$/d' "$DOCKER_COMPOSE_FILE"

# Adicionar comando corrigido antes do serviço prometheus
sed -i '/^[[:space:]]*# Monitoring (Prometheus)/i\
    # Garantir que nosso default.conf seja usado e validar antes de iniciar\
    entrypoint: ["/bin/sh"]\
    command:\
      - -c\
      - |\
        echo "[NGINX] Iniciando verificacao..."\
        sleep 4\
        if [ -f /etc/nginx/nginx.conf ]; then\
          echo "[NGINX] nginx.conf encontrado"\
        else\
          echo "[NGINX] ERRO: nginx.conf nao encontrado"\
          exit 1\
        fi\
        ls -la /etc/nginx/conf.d/ || true\
        echo "[NGINX] Verificando default.conf..."\
        COUNT=0\
        while [ $$COUNT -lt 10 ]; do\
          if [ -f /etc/nginx/conf.d/default.conf ]; then\
            echo "[NGINX] default.conf encontrado"\
            break\
          fi\
          COUNT=$$((COUNT + 1))\
          echo "[NGINX] Aguardando... ($$COUNT/10)"\
          sleep 1\
        done\
        if [ ! -f /etc/nginx/conf.d/default.conf ]; then\
          echo "[NGINX] AVISO: default.conf nao encontrado apos espera"\
          ls -la /etc/nginx/conf.d/ || true\
        fi\
        echo "[NGINX] Testando configuracao..."\
        if nginx -t 2>&1; then\
          echo "[NGINX] Configuracao valida"\
          echo "[NGINX] Iniciando Nginx..."\
          exec nginx -g "daemon off;"\
        else\
          echo "[NGINX] ERRO: Configuracao invalida"\
          exit 1\
        fi
' "$DOCKER_COMPOSE_FILE"

echo "✅ docker-compose.yml corrigido!"
echo "Execute: docker compose down nginx && docker compose up -d nginx"


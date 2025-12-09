#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST_OVERRIDE:-localhost}"
API="http://$HOST:3000"
GRAFANA="http://$HOST:3002"
PROM="http://$HOST:9090"

echo "===> 1) Containers e portas"
docker compose ps || true
ss -tulpen | grep -E ":3000|:3002|:9090|:80|:443" || true

echo "===> 2) Health e OpenAPI"
curl -fsS "$API/health" | jq . || true
curl -fsS "$API/api/docs.json" | jq '.info,.paths | keys | length' || true

echo "===> 3) Login admin e token"
TOKEN=$(curl -fsS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token' || echo "")
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then echo "TOKEN OK"; else echo "TOKEN FALHOU"; fi

echo "===> 4) CRUD rápido - criar cliente e checar lista"
curl -fsS -X POST "$API/api/clients" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Cliente Teste","email":"cliente@teste.com"}' | jq '.id,.name' || true
curl -fsS -X GET "$API/api/clients?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.items | length' || true

echo "===> 5) Upload de mídia (se houver arquivo ./banner.jpg)"
if [ -f "./banner.jpg" ]; then
  curl -fsS -X POST "$API/api/media/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F file=@./banner.jpg -F name=banner_loja | jq '.id,.name' || true
else
  echo "Arquivo banner.jpg não encontrado - pulando upload"
fi

echo "===> 6) Campanha simples"
curl -fsS -X POST "$API/api/campaigns" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"clientId":1,"title":"Campanha Teste","description":"Demo","campaignType":"general","isActive":true}' \
  | jq '.id,.title' || true

echo "===> 7) MQTT Broker (SmartDisplayFX)"
if command -v mosquitto_sub &> /dev/null; then
  timeout 2 mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -C 1 >/dev/null 2>&1 && echo "MQTT Broker OK" || echo "MQTT Broker não respondeu"
elif docker ps | grep -q smartsignage-mqtt; then
  echo "MQTT Broker (Docker) está rodando"
else
  echo "MQTT Broker não encontrado (opcional para SmartDisplayFX)"
fi

echo "===> 8) Players e heartbeat"
PID=$(curl -fsS -X POST "$API/api/players" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Totem 1","location":"Loja Central","clientId":1}' | jq -r '.id' || echo "")
if [ -n "$PID" ] && [ "$PID" != "null" ]; then
  curl -fsS -X POST "$API/api/totems/$PID/heartbeat" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"status":"online","uptime":120,"memoryUsage":30.5}' | jq . || true
else
  echo "Falha ao criar player - pulando heartbeat"
fi

echo "===> 9) Grafana e Prometheus"
curl -fsS "$PROM/-/healthy" && echo "Prometheus OK" || echo "Prometheus não respondeu"
curl -fsS "$GRAFANA/login" >/dev/null && echo "Grafana UP" || echo "Grafana não respondeu"
echo "Acesse $GRAFANA (admin/admin) e verifique dashboard 'SmartSignage – Operação'"

echo "===> 10) HTTPS (se habilitado)"
if curl -fsS "https://$HOST/health" -k >/dev/null 2>&1; then
  echo "HTTPS OK (cert autoassinado ou Let's Encrypt)"
else
  echo "HTTPS não ativo (ok se você escolheu HTTP)."
fi

echo "===> 11) Logs rápidos"
docker compose logs --tail 20 backend | tail -n +1 || true
docker compose logs --tail 20 nginx | tail -n +1 || true
docker compose logs --tail 20 mqtt | tail -n +1 || true
docker compose logs --tail 20 prometheus | tail -n +1 || true
docker compose logs --tail 20 grafana | tail -n +1 || true

echo "✓ Checklist concluído"

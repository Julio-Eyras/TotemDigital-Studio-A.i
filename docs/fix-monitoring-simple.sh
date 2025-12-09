#!/bin/bash

# Script simples para corrigir monitoramento
# Execute com sudo no servidor Ubuntu

echo "🔧 Corrigindo configuração de monitoramento..."

INSTALL_DIR="/opt/smart-signage"

# Limpar tudo e recriar
echo "🗑️ Limpando estrutura existente..."
sudo rm -rf "$INSTALL_DIR/monitoring"

echo "📁 Criando nova estrutura..."
sudo mkdir -p "$INSTALL_DIR/monitoring/prometheus"
sudo mkdir -p "$INSTALL_DIR/monitoring/grafana/dashboards"
sudo mkdir -p "$INSTALL_DIR/monitoring/grafana/datasources"

echo "📝 Criando prometheus.yml..."
sudo tee "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" > /dev/null << 'EOF'
# Smart Signage Pro v2.0 - Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Smart Signage Backend
  - job_name: 'smart-signage-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # PostgreSQL Database
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  # Redis Cache
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  # Ollama AI Service
  - job_name: 'ollama'
    static_configs:
      - targets: ['ollama:11434']
    scrape_interval: 30s

  # Nginx Reverse Proxy
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    scrape_interval: 30s
EOF

echo "📝 Criando grafana.ini..."
sudo tee "$INSTALL_DIR/monitoring/grafana/grafana.ini" > /dev/null << 'EOF'
# Smart Signage Pro v2.0 - Grafana Configuration

[server]
http_port = 3002
root_url = http://localhost:3002/

[security]
admin_user = admin
admin_password = admin

[database]
type = sqlite3
path = grafana.db

[log]
mode = console
level = info

[metrics]
enabled = true
interval_seconds = 10
EOF

echo "📝 Criando datasource do Grafana..."
sudo tee "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" > /dev/null << 'EOF'
# Smart Signage Pro v2.0 - Grafana Datasource Configuration
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Ajustar permissões
echo "🔐 Ajustando permissões..."
sudo chown -R 1000:1000 "$INSTALL_DIR/monitoring"

echo "✅ Verificando arquivos criados..."
if [[ -f "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" ]] && \
   [[ -f "$INSTALL_DIR/monitoring/grafana/grafana.ini" ]] && \
   [[ -f "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" ]]; then
    echo "✅ Todos os arquivos foram criados com sucesso!"
    echo ""
    echo "📋 Arquivos criados:"
    ls -la "$INSTALL_DIR/monitoring/prometheus/"
    ls -la "$INSTALL_DIR/monitoring/grafana/"
    ls -la "$INSTALL_DIR/monitoring/grafana/datasources/"
    echo ""
    echo "🎉 Configuração de monitoramento concluída!"
else
    echo "❌ Erro: Alguns arquivos não foram criados"
    exit 1
fi

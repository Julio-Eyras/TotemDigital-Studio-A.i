#!/bin/bash

# Script para corrigir problemas de monitoramento (Prometheus/Grafana)
# Execute este script no servidor Ubuntu

echo "🔧 Corrigindo configuração de monitoramento..."

INSTALL_DIR="/opt/smart-signage"

# Verificar se o diretório de instalação existe
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

# Criar estrutura de diretórios de monitoramento
echo "📁 Criando estrutura de monitoramento..."
mkdir -p "$INSTALL_DIR/monitoring/prometheus"
mkdir -p "$INSTALL_DIR/monitoring/grafana/dashboards"
mkdir -p "$INSTALL_DIR/monitoring/grafana/datasources"

# Remover arquivos/diretórios conflitantes
echo "🗑️ Removendo conflitos existentes..."
rm -rf "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" 2>/dev/null || true
rm -rf "$INSTALL_DIR/monitoring/grafana/grafana.ini" 2>/dev/null || true
rm -rf "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" 2>/dev/null || true

# Criar arquivo de configuração do Prometheus
echo "📝 Criando configuração do Prometheus..."
cat > "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" << 'EOF'
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

# Criar arquivo de configuração do Grafana
echo "📝 Criando configuração do Grafana..."
cat > "$INSTALL_DIR/monitoring/grafana/grafana.ini" << 'EOF'
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

# Criar configuração de datasource do Grafana
echo "📝 Criando datasource do Grafana..."
cat > "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" << 'EOF'
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

# Verificar se os arquivos foram criados
echo "✅ Verificando arquivos criados..."
if [[ -f "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" ]] && \
   [[ -f "$INSTALL_DIR/monitoring/grafana/grafana.ini" ]] && \
   [[ -f "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" ]]; then
    echo "✅ Todos os arquivos de monitoramento foram criados com sucesso!"
    echo ""
    echo "📋 Arquivos criados:"
    echo "   - prometheus.yml: $(ls -lh "$INSTALL_DIR/monitoring/prometheus/prometheus.yml" | awk '{print $5}')"
    echo "   - grafana.ini: $(ls -lh "$INSTALL_DIR/monitoring/grafana/grafana.ini" | awk '{print $5}')"
    echo "   - prometheus.yml (datasource): $(ls -lh "$INSTALL_DIR/monitoring/grafana/datasources/prometheus.yml" | awk '{print $5}')"
    echo ""
    echo "🎉 Configuração de monitoramento concluída!"
    echo "💡 Agora você pode tentar iniciar o Prometheus e Grafana novamente."
else
    echo "❌ Erro: Alguns arquivos não foram criados corretamente"
    exit 1
fi

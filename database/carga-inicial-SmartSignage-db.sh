#!/bin/bash

# =============================================
# SmartSignage Pro - Script de Carga Inicial
# =============================================
# Este script insere dados demonstrativos e de teste
# em todas as tabelas do sistema, respeitando foreign keys
# =============================================

# set -e  # Desabilitado para continuar mesmo com erros em algumas inserções

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações do banco de dados
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-smartsignage}"
DB_PASSWORD="${DB_PASSWORD:-smartsignage123}"

# Função para executar SQL
execute_sql() {
    local sql="$1"
    local description="$2"
    local output_file=$(mktemp)
    local error_file=$(mktemp)
    
    echo -e "${BLUE}→ ${description}...${NC}"
    
    if [ -z "$DB_PASSWORD" ]; then
        PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" > "$output_file" 2> "$error_file"
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" > "$output_file" 2> "$error_file"
    fi
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ ${description}${NC}"
        rm -f "$output_file" "$error_file"
    else
        echo -e "${RED}✗ Erro ao executar: ${description}${NC}"
        if [ -s "$error_file" ]; then
            echo -e "${RED}Detalhes do erro:${NC}"
            cat "$error_file"
        fi
        rm -f "$output_file" "$error_file"
        # Não retornar erro para não parar o script completamente
        # return 1
    fi
}

# Função para executar SQL de arquivo
execute_sql_file() {
    local file="$1"
    local description="$2"
    
    echo -e "${BLUE}→ ${description}...${NC}"
    
    if [ -z "$DB_PASSWORD" ]; then
        PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" > /dev/null 2>&1
    else
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${description}${NC}"
    else
        echo -e "${RED}✗ Erro ao executar: ${description}${NC}"
        return 1
    fi
}

echo -e "${YELLOW}=============================================${NC}"
echo -e "${YELLOW}SmartSignage Pro - Carga Inicial de Dados${NC}"
echo -e "${YELLOW}=============================================${NC}"
echo ""

# Verificar conexão
echo -e "${BLUE}Verificando conexão com o banco de dados...${NC}"
if [ -z "$DB_PASSWORD" ]; then
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro: Não foi possível conectar ao banco de dados${NC}"
    echo "Verifique as variáveis de ambiente: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

echo -e "${GREEN}✓ Conexão estabelecida${NC}"
echo ""

# =============================================
# 1. TABELAS BASE (Sem Foreign Keys)
# =============================================

echo -e "${YELLOW}=== 1. Inserindo dados em tabelas base ===${NC}"

# Subscribers
execute_sql "
INSERT INTO subscribers (subscriber_id, name, contact_name, email, phone, whatsapp, address, description, is_active) VALUES
(1, 'Shopping Center Norte', 'Maria Silva', 'maria.silva@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Av. Cruzeiro do Sul, 1100 - Santana, São Paulo/SP - CEP 02013-000', 'Shopping center localizado na zona norte de São Paulo', true),
(2, 'Rede de Farmácias Saúde+', 'João Santos', 'joao.santos@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Rua XV de Novembro, 250 - Centro, São Paulo/SP - CEP 01010-000', 'Rede de farmácias com múltiplas unidades', true),
(3, 'Supermercado Econômico', 'Ana Costa', 'ana.costa@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Av. Paulista, 1500 - Bela Vista, São Paulo/SP - CEP 01310-100', 'Supermercado com foco em economia', true),
(4, 'Restaurante Sabor & Arte', 'Carlos Oliveira', 'carlos.oliveira@saborearte.com.br', '+55 11 4567-8901', '+55 11 65432-1098', 'Rua Oscar Freire, 200 - Jardins, São Paulo/SP - CEP 01426-000', 'Restaurante gourmet especializado em culinária brasileira', true),
(5, 'Clínica Médica Vida Saudável', 'Dr. Roberto Lima', 'roberto.lima@vidasaudavel.com.br', '+55 11 5678-9012', '+55 11 54321-0987', 'Rua do Carmo, 45 - Centro, São Paulo/SP - CEP 01310-100', 'Clínica médica com foco em prevenção', true)
ON CONFLICT DO NOTHING;
" "Inserindo Subscribers"

# Publishers
execute_sql "
INSERT INTO publishers (publisher_id, name, contact_name, email, phone, whatsapp, description, is_subscriber, is_publisher, client_type, active) VALUES
(1, 'Shopping Center Norte - Administração', 'Maria Silva', 'admin@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Administração do shopping center', false, true, 'publisher', true),
(2, 'Farmácia Central - Matriz', 'João Santos', 'matriz@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Matriz da rede de farmácias', false, true, 'publisher', true),
(3, 'Supermercado Econômico - Filial Centro', 'Ana Costa', 'centro@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Filial central do supermercado', false, true, 'publisher', true),
(4, 'Rede de Totens Urbanos', 'Pedro Almeida', 'pedro@totensurbanos.com.br', '+55 11 9999-8888', '+55 11 99999-8888', 'Rede de totens em pontos estratégicos da cidade', false, true, 'publisher', true)
ON CONFLICT DO NOTHING;
" "Inserindo Publishers"

# Roles
execute_sql "
INSERT INTO roles (role_id, name, description, is_active) VALUES
(1, 'owner_system', 'Proprietário do sistema', true),
(2, 'admin_sql', 'Administrador SQL', true),
(3, 'admin', 'Administrador', true),
(4, 'publisher_user', 'Usuário Publisher', true),
(5, 'subscriber_user', 'Usuário Subscriber', true),
(6, 'operator', 'Operador', true),
(7, 'viewer', 'Visualizador', true)
ON CONFLICT DO NOTHING;
" "Inserindo Roles"

# Permissions
execute_sql "
INSERT INTO permissions (permission_id, name, resource, action, description) VALUES
(1, 'media.create', 'media', 'create', 'Criar mídias'),
(2, 'media.read', 'media', 'read', 'Visualizar mídias'),
(3, 'media.update', 'media', 'update', 'Editar mídias'),
(4, 'media.delete', 'media', 'delete', 'Excluir mídias'),
(5, 'campaign.create', 'campaign', 'create', 'Criar campanhas'),
(6, 'campaign.read', 'campaign', 'read', 'Visualizar campanhas'),
(7, 'campaign.update', 'campaign', 'update', 'Editar campanhas'),
(8, 'campaign.delete', 'campaign', 'delete', 'Excluir campanhas'),
(9, 'totem.read', 'totem', 'read', 'Visualizar totens'),
(10, 'totem.update', 'totem', 'update', 'Editar totens')
ON CONFLICT DO NOTHING;
" "Inserindo Permissions"

# Plans
FEATURES_BASICO='{"campaigns": 5, "storage_gb": 10}'
LIMITS_BASICO='{"totems": 3, "campaigns": 5, "storage_gb": 10}'
FEATURES_PROF='{"campaigns": 20, "storage_gb": 50}'
LIMITS_PROF='{"totems": 10, "campaigns": 20, "storage_gb": 50}'
FEATURES_ENT='{"campaigns": 100, "storage_gb": 500}'
LIMITS_ENT='{"totems": 50, "campaigns": 100, "storage_gb": 500}'

execute_sql "INSERT INTO plans (plan_id, name, slug, description, price_monthly, price_yearly, currency, billing_interval, features, limits, is_active, is_popular, sort_order) VALUES
(1, 'Plano Básico', 'plano-basico', 'Plano básico para pequenos anunciantes', 99.00, 990.00, 'BRL', 'month', '$FEATURES_BASICO'::jsonb, '$LIMITS_BASICO'::jsonb, true, false, 1),
(2, 'Plano Profissional', 'plano-profissional', 'Plano profissional para médias empresas', 299.00, 2990.00, 'BRL', 'month', '$FEATURES_PROF'::jsonb, '$LIMITS_PROF'::jsonb, true, true, 2),
(3, 'Plano Enterprise', 'plano-enterprise', 'Plano enterprise para grandes empresas', 999.00, 9990.00, 'BRL', 'month', '$FEATURES_ENT'::jsonb, '$LIMITS_ENT'::jsonb, true, false, 3)
ON CONFLICT DO NOTHING;" "Inserindo Plans"

# System Settings (já inseridos no schema, mas adicionando mais)
execute_sql "
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('app.name', 'SmartSignage Pro', 'string', 'system', 'Nome da aplicação'),
('app.version', '2.0.0', 'string', 'system', 'Versão da aplicação'),
('dispatcher.cache_ttl_seconds', '300', 'number', 'dispatcher', 'TTL do cache do dispatcher em segundos'),
('dispatcher.cache_enabled', 'true', 'boolean', 'dispatcher', 'Habilitar cache do dispatcher')
ON CONFLICT (setting_key) DO NOTHING;
" "Inserindo System Settings"

echo ""

# =============================================
# 2. USUÁRIOS E PERMISSÕES
# =============================================

echo -e "${YELLOW}=== 2. Inserindo usuários e permissões ===${NC}"

# Users (senha padrão: admin123 - hash bcrypt)
execute_sql "
INSERT INTO users (id, username, email, password_hash, first_name, last_name, name, phone, role, user_type, is_tenant_user, publisher_id, subscriber_id, is_active, email_verified) VALUES
(1, 'admin', 'admin@smartsignage.local', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Admin', 'Sistema', 'Admin Sistema', '+55 11 0000-0000', 'admin', 'system_user', true, NULL, NULL, true, true),
(2, 'maria.silva', 'maria.silva@shoppingnorte.com.br', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Maria', 'Silva', 'Maria Silva', '+55 11 3456-7890', 'manager', 'publisher_user', false, 1, NULL, true, true),
(3, 'joao.santos', 'joao.santos@saudemais.com.br', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'João', 'Santos', 'João Santos', '+55 11 2345-6789', 'manager', 'publisher_user', false, 2, NULL, true, true),
(4, 'ana.costa', 'ana.costa@economico.com.br', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Ana', 'Costa', 'Ana Costa', '+55 11 1234-5678', 'manager', 'subscriber_user', false, NULL, 3, true, true),
(5, 'carlos.oliveira', 'carlos.oliveira@saborearte.com.br', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Carlos', 'Oliveira', 'Carlos Oliveira', '+55 11 4567-8901', 'manager', 'subscriber_user', false, NULL, 4, true, true)
ON CONFLICT DO NOTHING;
" "Inserindo Users"

# User Flags
execute_sql "
INSERT INTO user_flags (user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
(1, true, true, true, true, true, true, true, true, true, true),
(2, true, false, false, true, false, true, true, false, true, false),
(3, true, false, false, true, false, true, true, false, true, false),
(4, false, false, false, false, false, false, true, false, false, true),
(5, false, false, false, false, false, false, true, false, false, true)
ON CONFLICT (user_id) DO NOTHING;
" "Inserindo User Flags"

# Role Flags Default
execute_sql "
INSERT INTO role_flags_default (role, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
('owner_system', true, true, true, true, true, true, true, true, true, true),
('admin_sql', true, true, true, true, true, true, true, true, true, true),
('admin', true, false, true, true, true, true, true, true, true, true),
('publisher_user', true, false, false, true, false, true, true, false, true, false),
('subscriber_user', false, false, false, false, false, false, true, false, false, true),
('operator', true, false, false, false, false, false, false, false, false, false),
('viewer', false, false, false, false, false, false, true, false, false, false)
ON CONFLICT (role) DO NOTHING;
" "Inserindo Role Flags Default"

# User Roles
execute_sql "
INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 1, 1),
(2, 4, 1),
(3, 4, 1),
(4, 5, 1),
(5, 5, 1)
ON CONFLICT DO NOTHING;
" "Inserindo User Roles"

# Role Permissions
execute_sql "
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10),
(4, 2), (4, 6), (4, 9),
(5, 2), (5, 5), (5, 6)
ON CONFLICT DO NOTHING;
" "Inserindo Role Permissions"

echo ""

# =============================================
# 3. LOCAIS E DISPOSITIVOS
# =============================================

echo -e "${YELLOW}=== 3. Inserindo locais e dispositivos ===${NC}"

# Locals
execute_sql "
INSERT INTO locals (local_id, publisher_id, name, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active) VALUES
(1, 1, 'Entrada Principal', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5000, -46.6333, 'America/Sao_Paulo', 'Entrada principal do shopping', true),
(2, 1, 'Praça de Alimentação', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5001, -46.6334, 'America/Sao_Paulo', 'Praça de alimentação do shopping', true),
(3, 1, 'Área do Cinema', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5002, -46.6335, 'America/Sao_Paulo', 'Área do cinema', true),
(4, 2, 'Farmácia Matriz - Centro', 'Rua XV de Novembro, 250', 'São Paulo', 'SP', '01010-000', 'BR', -23.5500, -46.6333, 'America/Sao_Paulo', 'Farmácia matriz no centro', true),
(5, 2, 'Farmácia Filial - Zona Sul', 'Av. Paulista, 1000', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Farmácia filial zona sul', true),
(6, 3, 'Área de Caixas', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Área dos caixas do supermercado', true),
(7, 3, 'Seção de Açougue', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Seção de açougue', true),
(8, 4, 'Ponto Estratégico 1', 'Av. Brigadeiro Faria Lima, 2000', 'São Paulo', 'SP', '01452-000', 'BR', -23.5775, -46.6910, 'America/Sao_Paulo', 'Totem em ponto estratégico', true)
ON CONFLICT DO NOTHING;
" "Inserindo Locals"

# Totems - JSONs
NETWORK_INFO_1='{"ip": "192.168.1.100", "mac": "00:11:22:33:44:55"}'
NETWORK_INFO_2='{"ip": "192.168.1.101", "mac": "00:11:22:33:44:56"}'
NETWORK_INFO_3='{"ip": "192.168.1.102", "mac": "00:11:22:33:44:57"}'
NETWORK_INFO_4='{"ip": "192.168.2.100", "mac": "00:11:22:33:44:58"}'
NETWORK_INFO_5='{"ip": "192.168.2.101", "mac": "00:11:22:33:44:59"}'
NETWORK_INFO_6='{"ip": "192.168.3.100", "mac": "00:11:22:33:44:60"}'
NETWORK_INFO_7='{"ip": "192.168.3.101", "mac": "00:11:22:33:44:61"}'
NETWORK_INFO_8='{"ip": "192.168.4.100", "mac": "00:11:22:33:44:62"}'
CAPABILITIES_PORTRAIT='{"resolution": "1920x1080", "orientation": "portrait"}'
CAPABILITIES_LANDSCAPE='{"resolution": "1920x1080", "orientation": "landscape"}'

execute_sql "INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active) VALUES
(1, 'TOTEM-SHOPPING-001', 'UIN-SHOPPING-001-2024', 'DEVICE-001', 1, 'Totem Shopping Entrada', 'Totem na entrada principal', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_1'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true),
(2, 'TOTEM-SHOPPING-002', 'UIN-SHOPPING-002-2024', 'DEVICE-002', 2, 'Totem Shopping Praça', 'Totem na praça de alimentação', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_2'::jsonb, '$CAPABILITIES_LANDSCAPE'::jsonb, true),
(3, 'TOTEM-SHOPPING-003', 'UIN-SHOPPING-003-2024', 'DEVICE-003', 3, 'Totem Shopping Cinema', 'Totem na área do cinema', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_3'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true),
(4, 'TOTEM-FARMACIA-001', 'UIN-FARMACIA-001-2024', 'DEVICE-004', 4, 'Totem Farmácia Matriz', 'Totem na farmácia matriz', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_4'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true),
(5, 'TOTEM-FARMACIA-002', 'UIN-FARMACIA-002-2024', 'DEVICE-005', 5, 'Totem Farmácia Filial', 'Totem na farmácia filial', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_5'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true),
(6, 'TOTEM-SUPER-001', 'UIN-SUPER-001-2024', 'DEVICE-006', 6, 'Totem Supermercado Caixas', 'Totem na área dos caixas', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_6'::jsonb, '$CAPABILITIES_LANDSCAPE'::jsonb, true),
(7, 'TOTEM-SUPER-002', 'UIN-SUPER-002-2024', 'DEVICE-007', 7, 'Totem Supermercado Açougue', 'Totem na seção de açougue', 'Totem Pro v2', 'SmartSignage', '2.0.0', '1.2.2', 'Linux 5.15', 'offline', NOW() - INTERVAL '2 hours', 60, '$NETWORK_INFO_7'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true),
(8, 'TOTEM-URBANO-001', 'UIN-URBANO-001-2024', 'DEVICE-008', 8, 'Totem Urbano 1', 'Totem em ponto estratégico', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW(), 60, '$NETWORK_INFO_8'::jsonb, '$CAPABILITIES_PORTRAIT'::jsonb, true)
ON CONFLICT DO NOTHING;" "Inserindo Totems"

# Smart TVs - JSONs
TV_CAPABILITIES_HDR='{"hdr": true, "refresh_rate": 60}'
TV_CAPABILITIES_NO_HDR='{"hdr": false, "refresh_rate": 60}'
TV_SETTINGS_70='{"brightness": 70}'
TV_SETTINGS_75='{"brightness": 75}'
TV_SETTINGS_80='{"brightness": 80}'
TV_SETTINGS_85='{"brightness": 85}'

execute_sql "INSERT INTO smart_tvs (tv_id, totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_seen, capabilities, settings, is_active) VALUES
(1, 1, 'TV-SHOPPING-001', 'TV-DEVICE-001', 'Smart TV Shopping Entrada', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW(), '$TV_CAPABILITIES_HDR'::jsonb, '$TV_SETTINGS_80'::jsonb, true),
(2, 2, 'TV-SHOPPING-002', 'TV-DEVICE-002', 'Smart TV Shopping Praça', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW(), '$TV_CAPABILITIES_HDR'::jsonb, '$TV_SETTINGS_75'::jsonb, true),
(3, 3, 'TV-SHOPPING-003', 'TV-DEVICE-003', 'Smart TV Shopping Cinema', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW(), '$TV_CAPABILITIES_HDR'::jsonb, '$TV_SETTINGS_70'::jsonb, true),
(4, 4, 'TV-FARMACIA-001', 'TV-DEVICE-004', 'Smart TV Farmácia Matriz', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', NOW(), '$TV_CAPABILITIES_NO_HDR'::jsonb, '$TV_SETTINGS_85'::jsonb, true),
(5, 5, 'TV-FARMACIA-002', 'TV-DEVICE-005', 'Smart TV Farmácia Filial', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', NOW(), '$TV_CAPABILITIES_NO_HDR'::jsonb, '$TV_SETTINGS_85'::jsonb, true),
(6, 6, 'TV-SUPER-001', 'TV-DEVICE-006', 'Smart TV Supermercado Caixas', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'landscape', 'online', NOW(), '$TV_CAPABILITIES_NO_HDR'::jsonb, '$TV_SETTINGS_80'::jsonb, true),
(7, 7, 'TV-SUPER-002', 'TV-DEVICE-007', 'Smart TV Supermercado Açougue', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'portrait', 'offline', NOW() - INTERVAL '2 hours', '$TV_CAPABILITIES_NO_HDR'::jsonb, '$TV_SETTINGS_75'::jsonb, true),
(8, 8, 'TV-URBANO-001', 'TV-DEVICE-008', 'Smart TV Urbano 1', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW(), '$TV_CAPABILITIES_HDR'::jsonb, '$TV_SETTINGS_80'::jsonb, true)
ON CONFLICT DO NOTHING;" "Inserindo Smart TVs"

echo ""

# =============================================
# 4. CONTEÚDO (SUBSCRIBERS)
# =============================================

echo -e "${YELLOW}=== 4. Inserindo conteúdo (mídias, playlists, campanhas) ===${NC}"

# Medias
execute_sql "
INSERT INTO medias (media_id, subscriber_id, name, description, file_path, file_name, file_size_bytes, media_type, mime_type, duration_seconds, width, height, thumbnail_url, preview_url, status, approval_status, tags, is_active) VALUES
(1, 1, 'black-friday-banner.jpg', 'Banner principal da Black Friday', '/media/shopping/black-friday-banner.jpg', 'black-friday-banner.jpg', 2048576, 'image', 'image/jpeg', NULL, 1920, 1080, '/thumbnails/black-friday-banner.jpg', '/previews/black-friday-banner.jpg', 'approved', 'approved', ARRAY['promocao', 'black-friday', 'ofertas'], true),
(2, 1, 'ofertas-video.mp4', 'Vídeo com as principais ofertas', '/media/shopping/ofertas-video.mp4', 'ofertas-video.mp4', 15728640, 'video', 'video/mp4', 30, 1920, 1080, '/thumbnails/ofertas-video.jpg', '/previews/ofertas-video.mp4', 'approved', 'approved', ARRAY['promocao', 'video', 'ofertas'], true),
(3, 2, 'medicamentos-banner.jpg', 'Banner promocional de medicamentos', '/media/farmacia/medicamentos-banner.jpg', 'medicamentos-banner.jpg', 1536000, 'image', 'image/jpeg', NULL, 1920, 1080, '/thumbnails/medicamentos-banner.jpg', '/previews/medicamentos-banner.jpg', 'approved', 'approved', ARRAY['medicamentos', 'genericos', 'promocao'], true),
(4, 3, 'ofertas-dia.jpg', 'Banner com ofertas diárias', '/media/supermercado/ofertas-dia.jpg', 'ofertas-dia.jpg', 1024000, 'image', 'image/jpeg', NULL, 1920, 1080, '/thumbnails/ofertas-dia.jpg', '/previews/ofertas-dia.jpg', 'approved', 'approved', ARRAY['ofertas', 'diarias', 'supermercado'], true),
(5, 4, 'menu-executivo.jpg', 'Cardápio do menu executivo', '/media/restaurante/menu-executivo.jpg', 'menu-executivo.jpg', 2560000, 'image', 'image/jpeg', NULL, 1920, 1080, '/thumbnails/menu-executivo.jpg', '/previews/menu-executivo.jpg', 'approved', 'approved', ARRAY['menu', 'executivo', 'restaurante'], true),
(6, 5, 'check-up-video.mp4', 'Vídeo educativo sobre check-up', '/media/clinica/check-up-video.mp4', 'check-up-video.mp4', 25165824, 'video', 'video/mp4', 45, 1920, 1080, '/thumbnails/check-up-video.jpg', '/previews/check-up-video.mp4', 'approved', 'approved', ARRAY['saude', 'prevencao', 'check-up'], true)
ON CONFLICT DO NOTHING;
" "Inserindo Medias"

# Playlists - JSONs
SCHEDULE_BF='{"start_time": "08:00", "end_time": "22:00", "days_of_week": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}'
SCHEDULE_MED='{"start_time": "08:00", "end_time": "20:00", "days_of_week": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]}'
SCHEDULE_SUPER='{"start_time": "06:00", "end_time": "23:00", "days_of_week": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}'
METADATA_EMPTY='{}'

# Desabilitar trigger temporariamente (trigger tenta acessar campaign_id que não existe na tabela)
execute_sql "ALTER TABLE playlists DISABLE TRIGGER trigger_derive_playlist_ids;" "Desabilitando trigger playlists"

execute_sql "INSERT INTO playlists (playlist_id, subscriber_id, name, description, is_active, schedule_config, metadata) VALUES
(1, 1, 'Playlist Black Friday - Entrada', 'Playlist principal da Black Friday na entrada', true, '$SCHEDULE_BF'::jsonb, '$METADATA_EMPTY'::jsonb),
(2, 1, 'Playlist Black Friday - Praça', 'Playlist da Black Friday na praça de alimentação', true, '$SCHEDULE_BF'::jsonb, '$METADATA_EMPTY'::jsonb),
(3, 2, 'Playlist Medicamentos', 'Playlist promocional de medicamentos', true, '$SCHEDULE_MED'::jsonb, '$METADATA_EMPTY'::jsonb),
(4, 3, 'Playlist Ofertas Supermercado', 'Playlist de ofertas do supermercado', true, '$SCHEDULE_SUPER'::jsonb, '$METADATA_EMPTY'::jsonb)
ON CONFLICT DO NOTHING;" "Inserindo Playlists"

# Playlist Items - JSONs
TRANSITION_FADE_2000='{"type": "fade", "duration_ms": 2000}'
TRANSITION_FADE_2500='{"type": "fade", "duration_ms": 2500}'
TRANSITION_FADE_3000='{"type": "fade", "duration_ms": 3000}'
TRANSITION_SLIDE_1500='{"type": "slide", "duration_ms": 1500}'

execute_sql "INSERT INTO playlist_items (item_id, playlist_id, media_id, display_seconds, order_index, start_time, end_time, days_of_week, transitions, is_active) VALUES
(1, 1, 1, 10, 0, NULL, NULL, NULL, '$TRANSITION_FADE_2000'::jsonb, true),
(2, 1, 2, 30, 1, NULL, NULL, NULL, '$TRANSITION_SLIDE_1500'::jsonb, true),
(3, 2, 1, 10, 0, NULL, NULL, NULL, '$TRANSITION_FADE_2000'::jsonb, true),
(4, 2, 2, 30, 1, NULL, NULL, NULL, '$TRANSITION_SLIDE_1500'::jsonb, true),
(5, 3, 3, 15, 0, NULL, NULL, NULL, '$TRANSITION_FADE_3000'::jsonb, true),
(6, 4, 4, 12, 0, NULL, NULL, NULL, '$TRANSITION_FADE_2500'::jsonb, true)
ON CONFLICT DO NOTHING;" "Inserindo Playlist Items"

# Campaigns
execute_sql "
INSERT INTO campaigns (campaign_id, subscriber_id, title, description, campaign_type, priority, commercial_tier, default_time_share_percent, max_consecutive_slots, start_date, end_date, start_time, end_time, days_of_week, timezone, status, is_active, target_audience, metadata) VALUES
(1, 1, 'Promoção Black Friday', 'Campanha especial para Black Friday com ofertas imperdíveis', 'scheduled', 10, 'premium', 50.00, 2, '2024-11-20 00:00:00', '2024-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(2, 2, 'Campanha Medicamentos', 'Promoção de medicamentos genéricos', 'general', 8, 'standard', 30.00, 2, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(3, 3, 'Ofertas do Dia', 'Ofertas especiais diárias do supermercado', 'general', 7, 'standard', 40.00, 3, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(4, 4, 'Menu Executivo', 'Promoção do menu executivo', 'scheduled', 6, 'standard', 20.00, 1, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '11:30', '14:30', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(5, 5, 'Check-up Preventivo', 'Campanha de conscientização sobre check-up', 'general', 5, 'standard', 15.00, 1, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '08:00', '18:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Campaigns"

echo ""

# =============================================
# 5. RELACIONAMENTOS N:N
# =============================================

echo -e "${YELLOW}=== 5. Inserindo relacionamentos N:N ===${NC}"

# Campaign Playlists
execute_sql "
INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active) VALUES
(1, 1, 1, true),
(1, 2, 2, true),
(2, 3, 1, true),
(3, 4, 1, true)
ON CONFLICT DO NOTHING;
" "Inserindo Campaign Playlists"

# Campaign Medias - JSONs
TRANSITION_FADE='{"type": "fade"}'
TRANSITION_SLIDE='{"type": "slide"}'

execute_sql "INSERT INTO campaign_medias (campaign_id, media_id, display_seconds, order_index, priority, start_time, end_time, days_of_week, transitions, is_active) VALUES
(1, 1, 10, 0, 10, NULL, NULL, NULL, '$TRANSITION_FADE'::jsonb, true),
(1, 2, 30, 1, 10, NULL, NULL, NULL, '$TRANSITION_SLIDE'::jsonb, true),
(2, 3, 15, 0, 8, NULL, NULL, NULL, '$TRANSITION_FADE'::jsonb, true),
(3, 4, 12, 0, 7, NULL, NULL, NULL, '$TRANSITION_FADE'::jsonb, true),
(4, 5, 20, 0, 6, NULL, NULL, NULL, '$TRANSITION_FADE'::jsonb, true),
(5, 6, 45, 0, 5, NULL, NULL, NULL, '$TRANSITION_FADE'::jsonb, true)
ON CONFLICT DO NOTHING;
" "Inserindo Campaign Medias"

# Campaign Totems
execute_sql "
INSERT INTO campaign_totems (campaign_id, totem_id, start_date, end_date, start_time, end_time, days_of_week, priority, is_active) VALUES
(1, 1, '2024-11-20 00:00:00', '2024-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 2, '2024-11-20 00:00:00', '2024-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 3, '2024-11-20 00:00:00', '2024-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 4, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
(2, 5, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
(3, 6, '2024-10-01 00:00:00', '2024-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 7, true)
ON CONFLICT DO NOTHING;
" "Inserindo Campaign Totems"

# Campaign Publishers
execute_sql "
INSERT INTO campaign_publishers (campaign_id, publisher_id, revenue_share_percentage, time_share_percent, daypart_config, min_impressions_per_hour, max_impressions_per_hour, is_active) VALUES
(1, 1, 70.00, 50.00, '{}'::jsonb, 10, 20, true),
(2, 2, 65.00, 30.00, '{}'::jsonb, 5, 15, true),
(3, 3, 60.00, 40.00, '{}'::jsonb, 8, 18, true),
(4, 1, 70.00, 20.00, '{}'::jsonb, 3, 10, true),
(5, 1, 70.00, 15.00, '{}'::jsonb, 2, 8, true)
ON CONFLICT DO NOTHING;
" "Inserindo Campaign Publishers"

# Campaign Locals
execute_sql "
INSERT INTO campaign_locals (campaign_id, local_id, is_active) VALUES
(1, 1, true),
(1, 2, true),
(1, 3, true),
(2, 4, true),
(2, 5, true),
(3, 6, true),
(3, 7, true),
(4, 1, true),
(4, 2, true),
(5, 1, true)
ON CONFLICT DO NOTHING;
" "Inserindo Campaign Locals"

echo ""

# =============================================
# 6. CONTRATOS E BILLING
# =============================================

echo -e "${YELLOW}=== 6. Inserindo contratos e billing ===${NC}"

# Subscriber Contracts
execute_sql "
INSERT INTO subscriber_contracts (contract_id, subscriber_id, plan_id, contract_number, contract_type, title, description, start_date, end_date, total_amount, currency, payment_terms, status, signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata) VALUES
(1, 1, 2, 'SUB-CONT-001', 'advertising', 'Contrato Publicitário Shopping Center Norte', 'Contrato de publicidade para Black Friday', '2024-11-01', '2024-11-30', 50000.00, 'BRL', 'Pagamento em 30 dias', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(2, 2, 1, 'SUB-CONT-002', 'advertising', 'Contrato Publicitário Farmácias Saúde+', 'Contrato de publicidade para campanha de medicamentos', '2024-10-01', '2024-12-31', 15000.00, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(3, 3, 1, 'SUB-CONT-003', 'advertising', 'Contrato Publicitário Supermercado Econômico', 'Contrato de publicidade para ofertas do dia', '2024-10-01', '2024-12-31', 20000.00, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(4, 4, 1, 'SUB-CONT-004', 'advertising', 'Contrato Publicitário Restaurante Sabor & Arte', 'Contrato de publicidade para menu executivo', '2024-10-01', '2024-12-31', 8000.00, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(5, 5, 1, 'SUB-CONT-005', 'advertising', 'Contrato Publicitário Clínica Vida Saudável', 'Contrato de publicidade para check-up preventivo', '2024-10-01', '2024-12-31', 10000.00, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Subscriber Contracts"

# Publisher Contracts
execute_sql "
INSERT INTO publisher_contracts (contract_id, publisher_id, contract_number, contract_type, title, description, start_date, end_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount, subscription_amount, subscription_interval, currency, payment_terms, status, signed_by_publisher_at, signed_by_tenant_at, created_by, metadata) VALUES
(1, 1, 'PUB-CONT-001', 'revenue_share', 'Contrato Revenue Share Shopping Center Norte', 'Contrato de revenue share com 70% para o publisher', '2024-01-01', NULL, 70.00, '{}'::jsonb, 1000.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(2, 2, 'PUB-CONT-002', 'revenue_share', 'Contrato Revenue Share Farmácia Central', 'Contrato de revenue share com 65% para o publisher', '2024-01-01', NULL, 65.00, '{}'::jsonb, 500.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(3, 3, 'PUB-CONT-003', 'revenue_share', 'Contrato Revenue Share Supermercado Econômico', 'Contrato de revenue share com 60% para o publisher', '2024-01-01', NULL, 60.00, '{}'::jsonb, 500.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb),
(4, 4, 'PUB-CONT-004', 'hybrid', 'Contrato Híbrido Rede de Totens Urbanos', 'Contrato híbrido: revenue share + subscription', '2024-01-01', NULL, 75.00, '{}'::jsonb, 2000.00, 299.00, 'month', 'BRL', 'Pagamento mensal', 'active', NOW(), NOW(), 1, '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Publisher Contracts"

# Atualizar campaigns com contract_id
execute_sql "
UPDATE campaigns SET contract_id = 1 WHERE campaign_id = 1;
UPDATE campaigns SET contract_id = 2 WHERE campaign_id = 2;
UPDATE campaigns SET contract_id = 3 WHERE campaign_id = 3;
UPDATE campaigns SET contract_id = 4 WHERE campaign_id = 4;
UPDATE campaigns SET contract_id = 5 WHERE campaign_id = 5;
" "Atualizando Campaigns com contract_id"

# Subscriber Billing
execute_sql "
INSERT INTO subscriber_billing (billing_id, subscriber_id, campaign_id, billing_type, amount, currency, direction, description, invoice_number, payment_method, payment_status, payment_date, due_date, metadata) VALUES
(1, 1, 1, 'campaign', 50000.00, 'BRL', 'incoming', 'Faturamento campanha Black Friday', 'INV-2024-001', 'bank_transfer', 'paid', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', '{}'::jsonb),
(2, 2, 2, 'campaign', 5000.00, 'BRL', 'incoming', 'Faturamento campanha Medicamentos - Outubro', 'INV-2024-002', 'credit_card', 'paid', NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', '{}'::jsonb),
(3, 3, 3, 'campaign', 6666.67, 'BRL', 'incoming', 'Faturamento campanha Ofertas do Dia - Outubro', 'INV-2024-003', 'credit_card', 'pending', NULL, NOW() + INTERVAL '7 days', '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Subscriber Billing"

# Publisher Billing
execute_sql "
INSERT INTO publisher_billing (billing_id, publisher_id, campaign_id, totem_id, billing_type, amount, currency, direction, revenue_share_percentage, original_campaign_amount, platform_fee_amount, publisher_share_amount, description, invoice_number, payment_status, payment_date, due_date, approved_by, approved_at, payment_method, metadata) VALUES
(1, 1, 1, NULL, 'revenue_share', 35000.00, 'BRL', 'outgoing', 70.00, 50000.00, 15000.00, 35000.00, 'Revenue share campanha Black Friday', 'PAY-2024-001', 'pending_payout', NULL, NOW() + INTERVAL '5 days', 1, NOW(), 'bank_transfer', '{}'::jsonb),
(2, 2, 2, NULL, 'revenue_share', 3250.00, 'BRL', 'outgoing', 65.00, 5000.00, 1750.00, 3250.00, 'Revenue share campanha Medicamentos', 'PAY-2024-002', 'pending_payout', NULL, NOW() + INTERVAL '5 days', 1, NOW(), 'bank_transfer', '{}'::jsonb),
(3, 3, 3, NULL, 'revenue_share', 4000.00, 'BRL', 'outgoing', 60.00, 6666.67, 2666.67, 4000.00, 'Revenue share campanha Ofertas do Dia', 'PAY-2024-003', 'pending_payout', NULL, NOW() + INTERVAL '5 days', 1, NOW(), 'bank_transfer', '{}'::jsonb),
(4, 4, NULL, NULL, 'subscription', 299.00, 'BRL', 'incoming', NULL, NULL, NULL, NULL, 'Assinatura mensal Rede de Totens Urbanos', 'SUB-2024-001', 'paid', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', NULL, NULL, 'credit_card', '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Publisher Billing"

# Subscriptions
execute_sql "
INSERT INTO subscriptions (subscription_id, publisher_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, trial_start, trial_end, metadata) VALUES
(1, 4, 2, 'sub_test_001', 'cus_test_001', 'active', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', false, NULL, NULL, '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Subscriptions"

echo ""

# =============================================
# 7. ACESSO E PLAYLISTS GERADAS
# =============================================

echo -e "${YELLOW}=== 7. Inserindo acesso e playlists geradas ===${NC}"

# Plan Publisher Access - JSONs (definir antes se ainda não estiver)
if [ -z "$RESTRICTIONS_BASICO" ]; then
    RESTRICTIONS_BASICO='{"max_campaigns": 5, "revenue_share_min": 50}'
    RESTRICTIONS_PROF='{"max_campaigns": 20, "revenue_share_min": 60}'
    RESTRICTIONS_ENT='{"max_campaigns": 100, "revenue_share_min": 70}'
fi

execute_sql "INSERT INTO plan_publisher_access (plan_id, publisher_id, is_allowed, restrictions, notes) VALUES
(1, 1, true, '$RESTRICTIONS_BASICO'::jsonb, 'Acesso básico'),
(1, 2, true, '$RESTRICTIONS_BASICO'::jsonb, 'Acesso básico'),
(1, 3, true, '$RESTRICTIONS_BASICO'::jsonb, 'Acesso básico'),
(2, 1, true, '$RESTRICTIONS_PROF'::jsonb, 'Acesso profissional'),
(2, 2, true, '$RESTRICTIONS_PROF'::jsonb, 'Acesso profissional'),
(3, 1, true, '$RESTRICTIONS_ENT'::jsonb, 'Acesso enterprise'),
(3, 4, true, '$RESTRICTIONS_ENT'::jsonb, 'Acesso enterprise')
ON CONFLICT DO NOTHING;" "Inserindo Plan Publisher Access"

# Subscriber Publisher Access - Corrigir data (end_date deve ser depois de start_date)
execute_sql "INSERT INTO subscriber_publisher_access (access_id, subscriber_id, publisher_id, contract_id, plan_id, access_type, granted_at, expires_at, is_active, granted_by, notes, metadata) VALUES
(1, 1, 1, 1, 2, 'contract', NOW(), '2025-11-30', true, 1, 'Acesso via contrato Black Friday', '$METADATA_EMPTY'::jsonb),
(2, 2, 2, 2, 1, 'contract', NOW(), '2025-12-31', true, 1, 'Acesso via contrato Medicamentos', '$METADATA_EMPTY'::jsonb),
(3, 3, 3, 3, 1, 'contract', NOW(), '2025-12-31', true, 1, 'Acesso via contrato Ofertas do Dia', '$METADATA_EMPTY'::jsonb),
(4, 4, 1, 4, 1, 'contract', NOW(), '2025-12-31', true, 1, 'Acesso via contrato Menu Executivo', '$METADATA_EMPTY'::jsonb),
(5, 5, 1, 5, 1, 'contract', NOW(), '2025-12-31', true, 1, 'Acesso via contrato Check-up', '$METADATA_EMPTY'::jsonb)
ON CONFLICT DO NOTHING;" "Inserindo Subscriber Publisher Access"

# Totem Playlists - JSONs
GEN_LOG_1='{"campaigns_included": [1, 4, 5], "playlists_included": [1]}'
GEN_LOG_2='{"campaigns_included": [1, 4, 5], "playlists_included": [2]}'
GEN_LOG_3='{"campaigns_included": [2], "playlists_included": [3]}'
GEN_LOG_4='{"campaigns_included": [3], "playlists_included": [4]}'

execute_sql "INSERT INTO totem_playlists (totem_playlist_id, totem_id, smart_tv_id, publisher_id, playlist_hash, version, total_items, total_duration_seconds, status, is_active, generated_at, last_updated_at, expires_at, metadata, generation_log) VALUES
(1, 1, NULL, 1, 'hash_001', 1, 2, 40, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_1'::jsonb),
(2, 2, NULL, 1, 'hash_002', 1, 2, 40, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_2'::jsonb),
(3, 3, NULL, 1, 'hash_003', 1, 2, 40, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_1'::jsonb),
(4, 4, NULL, 2, 'hash_004', 1, 1, 15, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_3'::jsonb),
(5, 5, NULL, 2, 'hash_005', 1, 1, 15, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_3'::jsonb),
(6, 6, NULL, 3, 'hash_006', 1, 1, 12, 'active', true, NOW(), NOW(), NULL, '$METADATA_EMPTY'::jsonb, '$GEN_LOG_4'::jsonb)
ON CONFLICT DO NOTHING;" "Inserindo Totem Playlists"

# Totem Playlist Items
execute_sql "
INSERT INTO totem_playlist_items (item_id, totem_playlist_id, media_id, campaign_id, subscriber_id, publisher_id, order_index, priority, display_seconds, transition_type, transition_duration_ms, commercial_tier, time_share_percent, revenue_share_percent, start_time, end_time, days_of_week, is_active) VALUES
(1, 1, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(2, 1, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(3, 2, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(4, 2, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(5, 3, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(6, 3, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(7, 4, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),
(8, 5, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),
(9, 6, 4, 3, 3, 3, 0, 7, 12, 'fade', 2500, 'standard', 40.00, 60.00, NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;
" "Inserindo Totem Playlist Items"

# Totem Playlist Generation Log - JSONs
GEN_DETAILS_1='{"campaigns": [1, 4, 5], "playlists": [1]}'
GEN_DETAILS_2='{"campaigns": [1, 4, 5], "playlists": [2]}'
GEN_DETAILS_3='{"campaigns": [2], "playlists": [3]}'
GEN_DETAILS_4='{"campaigns": [3], "playlists": [4]}'

execute_sql "INSERT INTO totem_playlist_generation_log (log_id, totem_id, totem_playlist_id, publisher_id, status, error_message, campaigns_included, playlists_included, medias_included, subscribers_included, generation_time_ms, generation_details, generated_at, generated_by) VALUES
(1, 1, 1, 1, 'success', NULL, 3, 1, 2, 3, 150, '$GEN_DETAILS_1'::jsonb, NOW(), 'system'),
(2, 2, 2, 1, 'success', NULL, 3, 1, 2, 3, 145, '$GEN_DETAILS_2'::jsonb, NOW(), 'system'),
(3, 3, 3, 1, 'success', NULL, 3, 1, 2, 3, 148, '$GEN_DETAILS_1'::jsonb, NOW(), 'system'),
(4, 4, 4, 2, 'success', NULL, 1, 1, 1, 1, 80, '$GEN_DETAILS_3'::jsonb, NOW(), 'system'),
(5, 5, 5, 2, 'success', NULL, 1, 1, 1, 1, 82, '$GEN_DETAILS_3'::jsonb, NOW(), 'system'),
(6, 6, 6, 3, 'success', NULL, 1, 1, 1, 1, 75, '$GEN_DETAILS_4'::jsonb, NOW(), 'system')
ON CONFLICT DO NOTHING;" "Inserindo Totem Playlist Generation Log"

echo ""

# =============================================
# 8. ANALYTICS E LOGS
# =============================================

echo -e "${YELLOW}=== 8. Inserindo analytics e logs ===${NC}"

# Analytics Sessions
execute_sql "
INSERT INTO analytics_sessions (session_id, totem_id, start_time, end_time, duration_seconds, metadata) VALUES
(1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 3600, '{}'::jsonb),
(2, 2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 1800, '{}'::jsonb),
(3, 3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 3600, '{}'::jsonb),
(4, 4, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 3600, '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Analytics Sessions"

# Analytics Emotions
execute_sql "
INSERT INTO analytics_emotions (emotion_id, session_id, totem_id, emotion_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'happy', 0.85, NOW() - INTERVAL '2 hours', '{}'::jsonb),
(2, 1, 1, 'neutral', 0.75, NOW() - INTERVAL '1 hour 50 minutes', '{}'::jsonb),
(3, 2, 2, 'happy', 0.90, NOW() - INTERVAL '1 hour', '{}'::jsonb),
(4, 3, 3, 'surprised', 0.80, NOW() - INTERVAL '3 hours', '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Analytics Emotions"

# Analytics Gestures
execute_sql "
INSERT INTO analytics_gestures (gesture_id, session_id, totem_id, gesture_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'wave', 0.88, NOW() - INTERVAL '2 hours', '{}'::jsonb),
(2, 1, 1, 'point', 0.82, NOW() - INTERVAL '1 hour 45 minutes', '{}'::jsonb),
(3, 2, 2, 'wave', 0.90, NOW() - INTERVAL '1 hour', '{}'::jsonb),
(4, 3, 3, 'touch', 0.85, NOW() - INTERVAL '3 hours', '{}'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Analytics Gestures"

# Execution Logs - JSONs
EVENT_DATA_10='{"duration": 10}'
EVENT_DATA_30='{"duration": 30}'
EVENT_DATA_15='{"duration": 15}'

execute_sql "INSERT INTO execution_logs (log_id, totem_id, campaign_id, playlist_id, media_id, publisher_id, subscriber_id, event_type, event_data, timestamp, metadata) VALUES
(1, 1, 1, 1, 1, 1, 1, 'play_start', '$EVENT_DATA_10'::jsonb, NOW() - INTERVAL '1 hour', '$METADATA_EMPTY'::jsonb),
(2, 1, 1, 1, 1, 1, 1, 'play_end', '$EVENT_DATA_10'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '10 seconds', '$METADATA_EMPTY'::jsonb),
(3, 1, 1, 1, 2, 1, 1, 'play_start', '$EVENT_DATA_30'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '12 seconds', '$METADATA_EMPTY'::jsonb),
(4, 2, 1, 2, 1, 1, 1, 'play_start', '$EVENT_DATA_10'::jsonb, NOW() - INTERVAL '30 minutes', '$METADATA_EMPTY'::jsonb),
(5, 4, 2, 3, 3, 2, 2, 'play_start', '$EVENT_DATA_15'::jsonb, NOW() - INTERVAL '2 hours', '$METADATA_EMPTY'::jsonb)
ON CONFLICT DO NOTHING;
" "Inserindo Execution Logs"

# Event Logs
execute_sql "
INSERT INTO event_logs (log_id, event_type, entity_type, entity_id, totem_id, campaign_id, media_id, publisher_id, subscriber_id, user_id, metadata, severity, timestamp) VALUES
(1, 'create', 'campaign', 1, NULL, 1, NULL, 1, 1, 4, '{}'::jsonb, 'info', NOW() - INTERVAL '10 days'),
(2, 'approve', 'media', 1, NULL, NULL, 1, NULL, 1, 1, '{}'::jsonb, 'info', NOW() - INTERVAL '9 days'),
(3, 'update', 'totem', 1, 1, NULL, NULL, 1, NULL, 2, '{}'::jsonb, 'info', NOW() - INTERVAL '5 days'),
(4, 'play', 'campaign', 1, 1, 1, NULL, 1, 1, NULL, '{}'::jsonb, 'info', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;
" "Inserindo Event Logs"

# Dispatcher Log - JSONs (comentar se tabela não existir)
CANDIDATES_1='[{"campaign_id": 1, "priority": 10}, {"campaign_id": 4, "priority": 6}, {"campaign_id": 5, "priority": 5}]'
CANDIDATES_2='[{"campaign_id": 2, "priority": 8}]'
DISPATCH_PLAN_1='{"playlist_id": 1, "items": [1, 2]}'
DISPATCH_PLAN_2='{"playlist_id": 2, "items": [3, 4]}'
DISPATCH_PLAN_3='{"playlist_id": 3, "items": [7]}'

# Verificar se a tabela dispatcher_log existe antes de inserir
execute_sql "INSERT INTO dispatcher_log (log_id, totem_id, timestamp, selected_campaign_id, selected_playlist_id, selected_source, selected_source_id, priority, candidates_count, candidates, temporal_validation, technical_validation, integrity_validation, validation_details, from_cache, cache_key, dispatch_plan, execution_time_ms) VALUES
(1, 1, NOW() - INTERVAL '1 hour', 1, 1, 'campaign', 1, 10, 3, '$CANDIDATES_1'::jsonb, true, true, true, '$METADATA_EMPTY'::jsonb, false, NULL, '$DISPATCH_PLAN_1'::jsonb, 150),
(2, 2, NOW() - INTERVAL '30 minutes', 1, 2, 'campaign', 1, 10, 3, '$CANDIDATES_1'::jsonb, true, true, true, '$METADATA_EMPTY'::jsonb, false, NULL, '$DISPATCH_PLAN_2'::jsonb, 145),
(3, 4, NOW() - INTERVAL '2 hours', 2, 3, 'campaign', 2, 8, 1, '$CANDIDATES_2'::jsonb, true, true, true, '$METADATA_EMPTY'::jsonb, true, 'totem_4_campaign_2', '$DISPATCH_PLAN_3'::jsonb, 80)
ON CONFLICT DO NOTHING;" "Inserindo Dispatcher Log" || echo "Tabela dispatcher_log não existe, pulando..."

echo ""

# =============================================
# 9. OUTRAS TABELAS
# =============================================

echo -e "${YELLOW}=== 9. Inserindo outras tabelas ===${NC}"

# QR Codes - JSONs
QR_METADATA_BF='{"utm_params": {"utm_source": "totem", "utm_medium": "qr", "utm_campaign": "black-friday"}}'

execute_sql "INSERT INTO qr_codes (qr_id, campaign_id, code, title, description, qr_type, content, url, redirect_url, size, color, background_color, error_correction_level, margin, image_url, scan_count, last_scan_at, max_scans, tracking_enabled, expires_at, metadata, is_active) VALUES
(1, 1, 'QR-BF-2024-001', 'QR Code Black Friday', 'QR code para campanha Black Friday', 'url', 'https://shoppingnorte.com.br/black-friday', 'https://shoppingnorte.com.br/black-friday', 'https://shoppingnorte.com.br/black-friday?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-bf-2024-001.png', 0, NULL, 1000, true, '2024-11-30', '$QR_METADATA_BF'::jsonb, true),
(2, 2, 'QR-MED-2024-001', 'QR Code Medicamentos', 'QR code para campanha de medicamentos', 'url', 'https://saudemais.com.br/promocao-medicamentos', 'https://saudemais.com.br/promocao-medicamentos', 'https://saudemais.com.br/promocao-medicamentos?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-med-2024-001.png', 0, NULL, 500, true, '2024-12-31', '$METADATA_EMPTY'::jsonb, true)
ON CONFLICT DO NOTHING;" "Inserindo QR Codes"

# Short Links - JSONs
SHORT_LINK_METADATA='{"utm_source": "totem"}'

execute_sql "INSERT INTO short_links (link_id, campaign_id, short_code, original_url, click_count, last_click_at, metadata, expires_at, is_active) VALUES
(1, 1, 'BF2024', 'https://shoppingnorte.com.br/black-friday', 0, NULL, '$SHORT_LINK_METADATA'::jsonb, '2024-11-30', true),
(2, 2, 'MED2024', 'https://saudemais.com.br/promocao-medicamentos', 0, NULL, '$SHORT_LINK_METADATA'::jsonb, '2024-12-31', true),
(3, 3, 'OFERTAS', 'https://economico.com.br/ofertas-dia', 0, NULL, '$SHORT_LINK_METADATA'::jsonb, '2024-12-31', true)
ON CONFLICT DO NOTHING;" "Inserindo Short Links"

# Remote Commands - JSONs
CMD_RESPONSE_PING='{"status": "ok", "latency_ms": 15}'
CMD_RESPONSE_OK='{"status": "ok"}'
CMD_PARAMS_PLAYLIST='{"playlist_id": 1}'

execute_sql "INSERT INTO remote_commands (command_id, totem_id, user_id, command_type, status, parameters, response, sent_at, executed_at, completed_at, error_message, retry_count) VALUES
(1, 1, 2, 'ping', 'completed', '$METADATA_EMPTY'::jsonb, '$CMD_RESPONSE_PING'::jsonb, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NULL, 0),
(2, 2, 2, 'restart', 'completed', '$METADATA_EMPTY'::jsonb, '$CMD_RESPONSE_OK'::jsonb, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NULL, 0),
(3, 3, 2, 'load_playlist', 'pending', '$CMD_PARAMS_PLAYLIST'::jsonb, NULL, NULL, NULL, NULL, NULL, 0)
ON CONFLICT DO NOTHING;" "Inserindo Remote Commands"

# OTA Updates
execute_sql "
INSERT INTO ota_updates (id, version, platform, file_path, file_size, checksum, description, changelog, is_mandatory, min_version, max_version, rollout_percentage, status, created_by, released_at) VALUES
(1, '2.0.1', 'all', '/ota/updates/v2.0.1.tar.gz', 104857600, 'sha256:abc123def456', 'Atualização de segurança e correções de bugs', 'Correções de bugs críticos e melhorias de performance', false, '2.0.0', NULL, 100, 'active', 1, NOW() - INTERVAL '5 days'),
(2, '2.0.2', 'all', '/ota/updates/v2.0.2.tar.gz', 105000000, 'sha256:def456ghi789', 'Nova funcionalidade de analytics', 'Adicionado suporte para analytics avançado', false, '2.0.1', NULL, 50, 'testing', 1, NULL)
ON CONFLICT DO NOTHING;
" "Inserindo OTA Updates"

# Totem Update Status
execute_sql "
INSERT INTO totem_update_status (id, ota_update_id, totem_id, status, downloaded_at, installed_at, error_message) VALUES
(1, 1, 1, 'installed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NULL),
(2, 1, 2, 'installed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NULL),
(3, 1, 3, 'installed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NULL),
(4, 2, 1, 'downloaded', NOW() - INTERVAL '1 day', NULL, NULL),
(5, 2, 2, 'pending', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;
" "Inserindo Totem Update Status"

# Reports - JSONs (definir antes se ainda não estiver)
if [ -z "$REPORT_FILTERS_1" ]; then
    REPORT_FILTERS_1='{"campaign_id": 1, "start_date": "2024-11-20", "end_date": "2024-11-30"}'
    REPORT_FILTERS_2='{"publisher_id": 1, "start_date": "2024-11-01", "end_date": "2024-11-30"}'
fi

execute_sql "INSERT INTO reports (report_id, type, title, description, status, format, file_path, file_size, download_url, download_count, filters, template, custom_fields, ai_analysis, metadata, generated_at, expires_at, created_by) VALUES
(1, 'campaign', 'Relatório Campanha Black Friday', 'Relatório de performance da campanha Black Friday', 'completed', 'pdf', '/reports/campaign-1-2024-11.pdf', 2048576, '/api/reports/download/1', 3, '$REPORT_FILTERS_1'::jsonb, 'default', '$METADATA_EMPTY'::jsonb, false, '$METADATA_EMPTY'::jsonb, NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', 1),
(2, 'totem', 'Relatório Totens Shopping', 'Relatório de uso dos totens do shopping', 'completed', 'excel', '/reports/totems-shopping-2024-11.xlsx', 1536000, '/api/reports/download/2', 1, '$REPORT_FILTERS_2'::jsonb, 'default', '$METADATA_EMPTY'::jsonb, false, '$METADATA_EMPTY'::jsonb, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 1)
ON CONFLICT DO NOTHING;" "Inserindo Reports"

# Audit Logs
execute_sql "
INSERT INTO audit_logs (id, user_id, action, entity, entity_id, publisher_id, subscriber_id, metadata, ip_address, user_agent, timestamp) VALUES
(1, 1, 'create', 'campaign', 1, 1, 1, '{}'::jsonb, '192.168.1.100', 'Mozilla/5.0', NOW() - INTERVAL '10 days'),
(2, 1, 'approve', 'media', 1, NULL, 1, '{}'::jsonb, '192.168.1.100', 'Mozilla/5.0', NOW() - INTERVAL '9 days'),
(3, 2, 'update', 'totem', 1, 1, NULL, '{}'::jsonb, '192.168.1.101', 'Mozilla/5.0', NOW() - INTERVAL '5 days'),
(4, 4, 'create', 'campaign', 1, 1, 1, '{}'::jsonb, '192.168.1.102', 'Mozilla/5.0', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;
" "Inserindo Audit Logs"

echo ""

# =============================================
# FINALIZAÇÃO
# =============================================

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}✓ Carga inicial concluída com sucesso!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Resumo dos dados inseridos:${NC}"
echo "  • Subscribers: 5"
echo "  • Publishers: 4"
echo "  • Users: 5"
echo "  • Locals: 8"
echo "  • Totems: 8"
echo "  • Smart TVs: 8"
echo "  • Medias: 6"
echo "  • Playlists: 4"
echo "  • Campaigns: 5"
echo "  • Contracts: 9"
echo "  • Billing Records: 7"
echo "  • Analytics & Logs: Múltiplos registros"
echo ""
echo -e "${YELLOW}Credenciais padrão:${NC}"
echo "  Usuário: admin"
echo "  Senha: admin123"
echo ""
echo -e "${YELLOW}Nota:${NC} Alguns dados podem ter sido ignorados se já existirem (ON CONFLICT DO NOTHING)"
echo ""

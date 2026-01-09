-- =============================================
-- SmartSignage Pro - Otimizações de Índices
-- PARTE 8.1: Índices Adicionais para Filtros e Ordenação
-- =============================================
-- 
-- Este arquivo contém índices adicionais para otimizar queries com:
-- - Filtros de data (createdFrom, createdTo)
-- - Ordenação (sortBy, sortOrder)
-- - Combinações de filtros (is_active + created_at, etc.)
-- =============================================

-- =============================================
-- ÍNDICES COMPOSTOS PARA SUBSCRIBERS
-- =============================================

-- Índice para queries com filtro de data e ordenação
CREATE INDEX IF NOT EXISTS idx_subscribers_active_created 
    ON subscribers(is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para busca e ordenação por nome
CREATE INDEX IF NOT EXISTS idx_subscribers_name_active 
    ON subscribers(name, is_active) 
    WHERE is_active = true;

-- Índice para ordenação por updated_at
CREATE INDEX IF NOT EXISTS idx_subscribers_active_updated 
    ON subscribers(is_active, updated_at DESC) 
    WHERE is_active = true;

-- =============================================
-- ÍNDICES COMPOSTOS PARA PUBLISHERS
-- =============================================

-- Índice para queries com filtro de data e ordenação
CREATE INDEX IF NOT EXISTS idx_publishers_active_created 
    ON publishers(active, created_at DESC) 
    WHERE active = true;

-- Índice para busca e ordenação por nome
CREATE INDEX IF NOT EXISTS idx_publishers_name_active 
    ON publishers(name, active) 
    WHERE active = true;

-- Índice para ordenação por updated_at
CREATE INDEX IF NOT EXISTS idx_publishers_active_updated 
    ON publishers(active, updated_at DESC) 
    WHERE active = true;

-- Índice para filtro por client_type e ordenação
CREATE INDEX IF NOT EXISTS idx_publishers_type_active_created 
    ON publishers(client_type, active, created_at DESC) 
    WHERE active = true;

-- =============================================
-- ÍNDICES COMPOSTOS PARA CAMPAIGNS
-- =============================================

-- Índice para queries com subscriber_id, data e ordenação
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber_active_created 
    ON campaigns(subscriber_id, is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para ordenação por título
CREATE INDEX IF NOT EXISTS idx_campaigns_title_active 
    ON campaigns(title, is_active) 
    WHERE is_active = true;

-- Índice para ordenação por priority e created_at
CREATE INDEX IF NOT EXISTS idx_campaigns_priority_created 
    ON campaigns(priority DESC, created_at DESC) 
    WHERE is_active = true;

-- Índice para filtro por status e ordenação
CREATE INDEX IF NOT EXISTS idx_campaigns_status_active_created 
    ON campaigns(status, is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para filtro por contract_id e ordenação
CREATE INDEX IF NOT EXISTS idx_campaigns_contract_active_created 
    ON campaigns(contract_id, is_active, created_at DESC) 
    WHERE contract_id IS NOT NULL AND is_active = true;

-- =============================================
-- ÍNDICES COMPOSTOS PARA MEDIAS
-- =============================================

-- Índice para queries com subscriber_id, data e ordenação
CREATE INDEX IF NOT EXISTS idx_medias_subscriber_active_created 
    ON medias(subscriber_id, is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para ordenação por nome
CREATE INDEX IF NOT EXISTS idx_medias_name_active 
    ON medias(name, is_active) 
    WHERE is_active = true;

-- Índice para ordenação por tipo de mídia e data
CREATE INDEX IF NOT EXISTS idx_medias_type_active_created 
    ON medias(media_type, is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para ordenação por tamanho de arquivo
CREATE INDEX IF NOT EXISTS idx_medias_size_active 
    ON medias(file_size_bytes, is_active) 
    WHERE is_active = true;

-- Índice para filtro por status e ordenação
CREATE INDEX IF NOT EXISTS idx_medias_status_active_created 
    ON medias(status, is_active, created_at DESC) 
    WHERE is_active = true;

-- =============================================
-- ÍNDICES COMPOSTOS PARA PLAYLISTS
-- =============================================

-- Índice para queries com subscriber_id, data e ordenação
CREATE INDEX IF NOT EXISTS idx_playlists_subscriber_active_created 
    ON playlists(subscriber_id, is_active, created_at DESC) 
    WHERE is_active = true;

-- Índice para ordenação por nome
CREATE INDEX IF NOT EXISTS idx_playlists_name_active 
    ON playlists(name, is_active) 
    WHERE is_active = true;

-- Índice para ordenação por updated_at
CREATE INDEX IF NOT EXISTS idx_playlists_active_updated 
    ON playlists(is_active, updated_at DESC) 
    WHERE is_active = true;

-- =============================================
-- ÍNDICES PARA CAMPANHAS COM MÍDIAS E PLAYLISTS
-- =============================================

-- Índice para ordenação de mídias em campanhas (já existe, mas vamos garantir)
CREATE INDEX IF NOT EXISTS idx_campaign_medias_campaign_order 
    ON campaign_medias(campaign_id, order_index) 
    WHERE is_active = true;

-- Índice para ordenação de playlists em campanhas (usando priority)
CREATE INDEX IF NOT EXISTS idx_campaign_playlists_campaign_priority 
    ON campaign_playlists(campaign_id, priority DESC) 
    WHERE is_active = true;

-- =============================================
-- ÍNDICES PARA BUSCA TEXTUAL (ILIKE)
-- =============================================

-- Índices GIN para busca textual (se usar PostgreSQL full-text search no futuro)
-- Por enquanto, os índices B-tree acima já ajudam com ILIKE em campos indexados

-- Índice para busca em nome de subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_name_trgm 
    ON subscribers USING gin(name gin_trgm_ops);

-- Índice para busca em nome de publishers
CREATE INDEX IF NOT EXISTS idx_publishers_name_trgm 
    ON publishers USING gin(name gin_trgm_ops);

-- Índice para busca em título de campanhas
CREATE INDEX IF NOT EXISTS idx_campaigns_title_trgm 
    ON campaigns USING gin(title gin_trgm_ops);

-- Índice para busca em nome de mídias
CREATE INDEX IF NOT EXISTS idx_medias_name_trgm 
    ON medias USING gin(name gin_trgm_ops);

-- Índice para busca em nome de playlists
CREATE INDEX IF NOT EXISTS idx_playlists_name_trgm 
    ON playlists USING gin(name gin_trgm_ops);

-- NOTA: Para usar índices gin_trgm_ops, é necessário ter a extensão pg_trgm instalada:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- ÍNDICES PARA QUERIES DE AGRUPAMENTO
-- =============================================

-- Índice para contagem de recursos por subscriber
CREATE INDEX IF NOT EXISTS idx_medias_subscriber_active_count 
    ON medias(subscriber_id, is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_playlists_subscriber_active_count 
    ON playlists(subscriber_id, is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber_active_count 
    ON campaigns(subscriber_id, is_active) 
    WHERE is_active = true;

-- =============================================
-- ÍNDICES PARA VALIDAÇÃO DE LIMITES DE PLANO
-- =============================================

-- Índice para buscar contratos ativos de um subscriber
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_subscriber_active_dates 
    ON subscriber_contracts(subscriber_id, status, start_date, end_date) 
    WHERE status = 'active' AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP);

-- Índice para buscar planos de contratos ativos
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_plan_active 
    ON subscriber_contracts(plan_id, status) 
    WHERE status = 'active' AND plan_id IS NOT NULL;

-- =============================================
-- COMENTÁRIOS SOBRE PERFORMANCE
-- =============================================

-- Estes índices melhoram significativamente:
-- 1. Queries com filtros de data (createdFrom, createdTo)
-- 2. Queries com ordenação (sortBy, sortOrder)
-- 3. Queries combinando múltiplos filtros
-- 4. Busca textual (com pg_trgm)
-- 5. Validação de limites de plano

-- IMPORTANTE: 
-- - Índices compostos são mais eficientes quando a ordem das colunas corresponde à ordem de uso na query
-- - Índices parciais (WHERE) reduzem o tamanho do índice e melhoram performance
-- - Índices GIN para busca textual requerem extensão pg_trgm
-- - Monitore o uso de espaço em disco após criar estes índices

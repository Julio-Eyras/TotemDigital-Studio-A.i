-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- SCRIPT MASTER: Aplica todos os scripts na ordem correta
-- =============================================
-- Data: 2025-12-21
-- Uso: Execute este script para criar o schema completo do zero
-- =============================================

-- Nota: Este script assume que você está executando em uma sessão psql
-- ou pode usar \i para incluir cada arquivo.

\echo '========================================='
\echo 'SmartSignage Pro - Aplicando Schema v2.0'
\echo '========================================='
\echo ''

\echo '[1/15] Criando schema e tabela de versionamento...'
\i smartchannel-db-v2-refactored-part1-schema-setup.sql

\echo '[2/15] Criando tabelas base (subscribers, publishers, users, etc.)...'
\i smartchannel-db-v2-refactored-part2-tables-base.sql

\echo '[3/15] Criando tabelas dependentes (locals, totems, campaigns, etc.)...'
\i smartchannel-db-v2-refactored-part3-tables-dependent.sql

\echo '[4/15] Criando tabelas de billing e contratos...'
\i smartchannel-db-v2-refactored-part4-billing-contracts.sql

\echo '[5/15] Criando tabelas de relacionamento N:N...'
\i smartchannel-db-v2-refactored-part5-tables-relationships.sql

\echo '[6/15] Criando outras tabelas (analytics, logs, OTA, etc.)...'
\i smartchannel-db-v2-refactored-part6-tables-other.sql

\echo '[7/15] Seeds: Configurações Padrão do Sistema...'
\i seeds-default-settings.sql

\echo '[8/15] Criando Foreign Keys...'
\i smartchannel-db-v2-refactored-part7-foreign-keys.sql

\echo '[9/15] Criando índices (incluindo parciais e compostos)...'
\i smartchannel-db-v2-refactored-part8-indexes.sql

\echo '[10/15] Criando triggers e funções SQL...'
\i smartchannel-db-v2-refactored-part9-triggers-functions.sql

\echo '[11/15] Criando views e materialized views...'
\i smartchannel-db-v2-refactored-part10-views.sql

\echo '[12/15] Criando Playlist Mix (Tabelas)...'
\i smartchannel-db-v2-refactored-part11-playlist-mix.sql

\echo '[13/15] Criando Playlist Mix (Funções e Triggers)...'
\i smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql

\echo '[14/15] Criando Dispatcher Views...'
\i smartchannel-db-v2-refactored-part13-dispatcher-views.sql

\echo '[15/15] Seeds: Dados Iniciais Playlist Mix...'
\i seeds-playlist-mix.sql

\echo '[FINAL] Verificando schema...'
-- Validação final
DO $$
DECLARE
    table_count INTEGER;
    fk_count INTEGER;
BEGIN
    -- Contar tabelas
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    -- Contar Foreign Keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND constraint_type = 'FOREIGN KEY';
    
    RAISE NOTICE 'Schema criado com sucesso!';
    RAISE NOTICE 'Tabelas criadas: %', table_count;
    RAISE NOTICE 'Foreign Keys criadas: %', fk_count;
END $$;

\echo ''
\echo '========================================='
\echo 'Schema v2.0 aplicado com sucesso!'
\echo '========================================='
\echo ''
\echo 'NOTA: Materialized Views devem ser atualizadas periodicamente:'
\echo '  REFRESH MATERIALIZED VIEW mv_publisher_revenue_share_consolidated;'
\echo '  REFRESH MATERIALIZED VIEW mv_totem_executions_last_24h;'
\echo ''


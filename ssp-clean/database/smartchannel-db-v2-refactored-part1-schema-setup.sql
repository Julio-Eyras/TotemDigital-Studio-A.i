-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 1: Setup do Schema e Tabela de Versionamento
-- =============================================
-- Data: 2025-12-21
-- Baseado em: Plano de Ação Meticuloso
-- =============================================

-- SCHEMA SETUP
CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

-- =============================================
-- TABELA DE VERSIONAMENTO DE SCHEMA
-- =============================================

CREATE TABLE IF NOT EXISTS schema_version (
    version_id SERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by TEXT
);

COMMENT ON TABLE schema_version IS 'Histórico de versões do schema aplicadas';
COMMENT ON COLUMN schema_version.version IS 'Versão do schema (ex: 2.0.0)';
COMMENT ON COLUMN schema_version.description IS 'Descrição das mudanças nesta versão';
COMMENT ON COLUMN schema_version.applied_at IS 'Quando a versão foi aplicada';
COMMENT ON COLUMN schema_version.applied_by IS 'Usuário/script que aplicou a versão';

-- Inserir versão inicial
INSERT INTO schema_version (version, description, applied_by)
VALUES ('2.0.0', 'Refatoração completa: clients→subscribers, hosts→publishers', 'smartchannel-db-v2-refactored')
ON CONFLICT (version) DO NOTHING;


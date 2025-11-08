-- =============================================
-- EXPORT QUERIES AND SCHEDULES SCHEMA
-- =============================================
-- Tabelas para gerenciamento de exportações DB → Excel
-- Usando Bull + Redis para gerenciamento de filas

-- Export Queries
CREATE TABLE IF NOT EXISTS export_queries (
    query_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('PostgreSQL', 'Redis', 'Grafana', 'Prometheus')),
    sql_query TEXT NOT NULL,
    database_config JSONB NOT NULL,
    export_config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT export_queries_name_unique UNIQUE (name)
);

-- Export Schedules (Agendamentos)
CREATE TABLE IF NOT EXISTS export_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT export_schedules_name_unique UNIQUE (name)
);

-- Export Executions (Histórico de execuções)
CREATE TABLE IF NOT EXISTS export_executions (
    execution_id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES export_schedules(schedule_id) ON DELETE SET NULL,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    job_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_exported INTEGER DEFAULT 0,
    file_path TEXT,
    file_size BIGINT,
    error_message TEXT,
    execution_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_export_queries_provider ON export_queries(provider);
CREATE INDEX IF NOT EXISTS idx_export_queries_enabled ON export_queries(enabled);
CREATE INDEX IF NOT EXISTS idx_export_schedules_query_id ON export_schedules(query_id);
CREATE INDEX IF NOT EXISTS idx_export_schedules_enabled ON export_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_export_schedules_next_execution ON export_schedules(next_execution);
CREATE INDEX IF NOT EXISTS idx_export_executions_schedule_id ON export_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_query_id ON export_executions(query_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_status ON export_executions(status);
CREATE INDEX IF NOT EXISTS idx_export_executions_created_at ON export_executions(created_at);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_export_queries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_export_queries_timestamp
    BEFORE UPDATE ON export_queries
    FOR EACH ROW
    EXECUTE FUNCTION update_export_queries_timestamp();

CREATE OR REPLACE FUNCTION update_export_schedules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_export_schedules_timestamp
    BEFORE UPDATE ON export_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_export_schedules_timestamp();

-- Comentários
COMMENT ON TABLE export_queries IS 'Queries SQL para exportação (Excel, PDF, CSV)';
COMMENT ON TABLE export_schedules IS 'Agendamentos de exportação usando Bull/Redis';
COMMENT ON TABLE export_executions IS 'Histórico de execuções de exportações';

COMMENT ON COLUMN export_queries.provider IS 'Tipo de banco: PostgreSQL, Redis, Grafana, Prometheus (bancos do sistema)';
COMMENT ON COLUMN export_queries.database_config IS 'Configuração do banco (usar banco do sistema) - JSON com configurações específicas por provider. Se vazio, usa configuração do sistema';
COMMENT ON COLUMN export_queries.export_config IS 'Configuração de exportação (diretório, formato: xlsx/pdf/csv, formatação)';

COMMENT ON COLUMN export_schedules.cron_expression IS 'Expressão cron (ex: 0 8 * * * para diário às 8h)';
COMMENT ON COLUMN export_schedules.next_execution IS 'Próxima execução calculada baseada no cron';

COMMENT ON COLUMN export_executions.job_id IS 'ID do job no Bull/Redis';
COMMENT ON COLUMN export_executions.status IS 'Status: pending, running, completed, failed, cancelled';


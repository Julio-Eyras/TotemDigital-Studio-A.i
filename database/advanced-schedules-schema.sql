-- Advanced Schedules Schema - Smart Signage v2.1
-- Sistema de agendamento avançado para campanhas e playlists

-- Tabela de agendamentos avançados
CREATE TABLE IF NOT EXISTS advanced_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    schedule_type TEXT NOT NULL, -- 'campaign' | 'playlist' | 'campaign_activation' | 'playlist_generation'
    target_id INTEGER NOT NULL, -- campaign_id ou playlist_id dependendo do tipo
    cron_expression TEXT NOT NULL, -- Expressão cron para agendamento
    schedule_config TEXT, -- JSON com configurações específicas
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_type ON advanced_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_target_id ON advanced_schedules(target_id);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_enabled ON advanced_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_next_execution ON advanced_schedules(next_execution);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_created_by ON advanced_schedules(created_by);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_advanced_schedules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_advanced_schedules_timestamp BEFORE UPDATE ON advanced_schedules
    FOR EACH ROW EXECUTE FUNCTION update_advanced_schedules_timestamp();

-- Tabela de histórico de execuções de agendamentos
CREATE TABLE IF NOT EXISTS schedule_executions (
    execution_id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    job_id TEXT, -- ID do job no Bull
    status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'cancelled'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    execution_log TEXT,
    error_message TEXT,
    metadata TEXT, -- JSON com dados adicionais
    FOREIGN KEY (schedule_id) REFERENCES advanced_schedules(schedule_id) ON DELETE CASCADE
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule_id ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_status ON schedule_executions(status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_started_at ON schedule_executions(started_at);


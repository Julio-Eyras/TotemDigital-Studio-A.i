-- Reports Schema - Smart Signage Pro v2.1
-- Tabelas para gerenciamento de relatórios

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- campaign, totem, client, media, billing, analytics, custom
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
    format TEXT DEFAULT 'pdf', -- pdf, excel, csv, json
    file_path TEXT,
    file_size INTEGER,
    download_url TEXT,
    download_count INTEGER DEFAULT 0,
    filters TEXT, -- JSON
    template TEXT,
    custom_fields TEXT, -- JSON
    ai_analysis BOOLEAN DEFAULT false,
    metadata TEXT, -- JSON
    generated_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
    template_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- campaign, totem, client, media, billing, analytics, custom
    template_config TEXT NOT NULL, -- JSON com configuração do template
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para reports
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);

-- Índices para report_templates
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_default ON report_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_public ON report_templates(is_public);


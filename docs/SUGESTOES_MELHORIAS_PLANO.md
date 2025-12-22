# Sugestões de Melhorias e Otimizações - Plano de Ação

## 🎯 Objetivo

Este documento complementa o `PLANO_ACAO_RENOMENACOES_METICULOSO.md` com sugestões de melhorias, otimizações e considerações adicionais.

---

## 🚀 Melhorias Sugeridas

### 1. **Estratégia de Migração de Dados (Opcional)**

#### Situação Atual
- Plano prevê recriar banco do zero (sem preservar dados)
- Adequado para desenvolvimento/estágio inicial sim estamos em desenvolvimento. 

#### Sugestão no futur agora nao 
Se no futuro precisar migrar dados existentes, criar scripts de migração separados:

```sql
-- Script de migração de dados (se necessário no futuro)
-- Mapear dados de clients → subscribers
INSERT INTO subscribers (subscriber_id, name, email, ...)
SELECT client_id, name, email, ...
FROM clients;

-- Mapear dados de hosts → publishers
INSERT INTO publishers (publisher_id, name, email, ...)
SELECT host_id, name, email, ...
FROM hosts;

-- Mapear users.client_id → users.publisher_id
UPDATE users
SET publisher_id = (
    SELECT host_id FROM hosts WHERE host_id = users.client_id
)
WHERE client_id IS NOT NULL;

-- ... etc
```

**Vantagens:**
- Scripts reutilizáveis se precisar migrar dados depois
- Facilita testes com dados reais

---

### 2. **Versionamento de Schema**

#### Situação Atual
- Schema SQL não tem versionamento explícito

#### Sugestão
Adicionar tabela de versionamento: sim fazer isto mesmo implementar schema e as respectivas referencias nos sql 

```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version_id SERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('2.0.0', 'Refatoração completa: clients→subscribers, hosts→publishers');

COMMENT ON TABLE schema_version IS 'Histórico de versões do schema aplicadas';
```

**Vantagens:**
- Rastreabilidade de mudanças
- Facilita rollback se necessário
- Documentação automática

---

### 3. **Triggers para Auditoria Automática**

#### Situação Atual
- Campos `created_at` e `updated_at` devem ser atualizados manualmente

#### Sugestão
Criar função genérica e triggers: sim 

```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publishers_updated_at
    BEFORE UPDATE ON publishers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ... aplicar em todas as tabelas que têm updated_at
```

**Vantagens:**
- Garantia de atualização automática
- Menos código no backend
- Consistência garantida

---

### 4. **Indexação Parcial para Performance**

#### Situação Atual
- Índices criados em todas as linhas

#### Sugestão
Usar índices parciais para dados ativos: sim implemente 

```sql
-- Índices parciais (mais eficientes)
CREATE INDEX IF NOT EXISTS idx_subscribers_active_email 
    ON subscribers(email) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_publishers_active_email 
    ON publishers(email) 
    WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_active_subscriber 
    ON campaigns(subscriber_id, start_date, end_date) 
    WHERE is_active = true 
      AND status IN ('active', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_publisher_billing_pending 
    ON publisher_billing(publisher_id, due_date) 
    WHERE status = 'pending';
```

**Vantagens:**
- Índices menores (menos espaço)
- Consultas mais rápidas
- Manutenção mais eficiente

---

### 5. **Constraints de Negócio Adicionais**

#### Situação Atual
- Constraints básicas implementadas

#### Sugestão
Adicionar constraints de validação de negócio: sim sugerir e implementar esta pratica aplicar logica de negocio a nivel de banco 

```sql
-- Campaigns: start_date <= end_date
ALTER TABLE campaigns 
ADD CONSTRAINT chk_campaigns_dates 
CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

-- Subscriptions: current_period_start <= current_period_end
ALTER TABLE subscriptions 
ADD CONSTRAINT chk_subscriptions_period 
CHECK (
    current_period_start IS NULL OR 
    current_period_end IS NULL OR 
    current_period_start <= current_period_end
);

-- Publisher Billing: direction válido para billing_type
ALTER TABLE publisher_billing 
ADD CONSTRAINT chk_publisher_billing_direction 
CHECK (
    (billing_type = 'revenue_share' AND direction = 'outgoing') OR
    (billing_type = 'payout' AND direction = 'outgoing') OR
    (billing_type = 'subscription' AND direction = 'incoming') OR
    (billing_type = 'platform_fee' AND direction = 'incoming')
);

-- Revenue Share: percentage válido
ALTER TABLE publisher_billing 
ADD CONSTRAINT chk_revenue_share_percentage 
CHECK (
    revenue_share_percentage IS NULL OR 
    (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)
);

-- Amounts: sempre positivos
ALTER TABLE subscriber_billing 
ADD CONSTRAINT chk_subscriber_billing_amount 
CHECK (amount > 0);

ALTER TABLE publisher_billing 
ADD CONSTRAINT chk_publisher_billing_amount 
CHECK (amount > 0);
```

**Vantagens:**
- Integridade de dados garantida no banco
- Previne erros de lógica de negócio
- Mais robusto

---

### 6. **Materialized Views para Analytics**

#### Situação Atual
- Views simples criadas

#### Sugestão
Criar materialized views para queries pesadas: sim usar esta tecnica 

```sql
-- Materialized View: Estatísticas de campanhas por subscriber
CREATE MATERIALIZED VIEW mv_subscriber_campaign_stats AS
SELECT 
    s.subscriber_id,
    s.name AS subscriber_name,
    COUNT(DISTINCT c.campaign_id) AS total_campaigns,
    COUNT(DISTINCT c.campaign_id) FILTER (WHERE c.is_active = true) AS active_campaigns,
    SUM(sb.amount) FILTER (WHERE sb.status = 'paid') AS total_paid,
    AVG(sb.amount) FILTER (WHERE sb.status = 'paid') AS avg_payment
FROM subscribers s
LEFT JOIN campaigns c ON s.subscriber_id = c.subscriber_id
LEFT JOIN subscriber_billing sb ON s.subscriber_id = sb.subscriber_id
GROUP BY s.subscriber_id, s.name;

CREATE UNIQUE INDEX ON mv_subscriber_campaign_stats(subscriber_id);

-- Atualizar periodicamente (via cron job ou trigger)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_subscriber_campaign_stats;
```

**Vantagens:**
- Queries analíticas muito mais rápidas
- Reduz carga no banco principal
- Facilita relatórios

---

### 7. **Funções Úteis para Derivação de Dados**

#### Situação Atual
- Dados derivados precisam ser calculados no backend

#### Sugestão
Criar funções SQL para dados derivados:   sim faça de esta forma implemente toda a logica necessaria 

```sql
-- Função: Obter publisher_id de um totem
CREATE OR REPLACE FUNCTION get_publisher_from_totem(p_totem_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT p.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.totem_id = p_totem_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Calcular revenue share
CREATE OR REPLACE FUNCTION calculate_revenue_share(
    p_campaign_amount NUMERIC,
    p_revenue_share_percentage NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
    RETURN p_campaign_amount * (p_revenue_share_percentage / 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função: Verificar se user é tenant
CREATE OR REPLACE FUNCTION is_tenant_user(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT is_tenant_user 
        FROM users 
        WHERE id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

**Vantagens:** sim 
- Reutilização de lógica
- Consistência garantida
- Pode ser usado em triggers ou views

---

### 8. **Segurança: Row Level Security (RLS)**

#### Situação Atual
- Segurança via backend/application layer

#### Sugestão sim faça de esta forma 
Adicionar Row Level Security para segurança adicional:

```sql
-- Habilitar RLS
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users só veem seus próprios dados (se não forem tenant)
CREATE POLICY subscriber_isolation ON subscribers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id')::INTEGER
            AND (u.is_tenant_user = true OR u.publisher_id = publishers.publisher_id)
        )
    );

-- Policy: Tenant users veem tudo
CREATE POLICY tenant_full_access ON subscribers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id')::INTEGER
            AND u.is_tenant_user = true
        )
    );
```

**Vantagens:**
- Segurança adicional no nível do banco
- Previne acesso não autorizado mesmo se houver bug no backend
- Compliance com boas práticas

**NOTA:** Requer configuração de `current_setting` no backend.

---

### 9. **Otimização de Consultas Frequentes**

#### Situação Atual
- Índices básicos criados

#### Sugestão
Análise de queries frequentes e otimização: sim implemente 

```sql
-- Exemplo: Query frequente - campanhas ativas de um subscriber
-- Criar índice específico
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber_active_scheduled
    ON campaigns(subscriber_id, start_date, end_date)
    WHERE is_active = true 
      AND status IN ('active', 'scheduled')
      AND start_date <= CURRENT_TIMESTAMP
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP);

-- Query frequente: Totens ativos de um publisher
CREATE INDEX IF NOT EXISTS idx_totems_publisher_active
    ON totems(local_id)
    INCLUDE (totem_id, name, status, last_heartbeat)
    WHERE is_active = true;
```

**Vantagens:**
- Performance otimizada para casos de uso reais
- Consultas mais rápidas

---

### 10. **Logging e Auditoria Aprimorados**

#### Situação Atual
- Campos básicos de auditoria

#### Sugestão
Adicionar campos de auditoria consistentes: sim implemente 

```sql
-- Adicionar campos de auditoria em todas as tabelas importantes
ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS created_by INTEGER,
ADD COLUMN IF NOT EXISTS updated_by INTEGER;

ALTER TABLE publishers 
ADD COLUMN IF NOT EXISTS created_by INTEGER,
ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- Trigger para capturar updated_by
CREATE OR REPLACE FUNCTION capture_updated_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_by = current_setting('app.current_user_id')::INTEGER;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER capture_subscribers_updated_by
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION capture_updated_by();
```

**Vantagens:**
- Rastreabilidade completa
- Auditoria automática
- Compliance

---

### 11. **Configuração de Path para Documentos**

#### Situação Atual
- Path de documentos hardcoded ou em variável de ambiente

#### Sugestão
Tabela de configuração centralizada: sim esta opcao no mesmo local onde se configura o sistema smartsignage 

```sql
-- Adicionar configuração de path de documentos
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('contracts.storage_path', '/opt/smart-signage/contracts', 'string', 
     'Caminho base para armazenamento de contratos (PDF, DOC, DOCX)'),
    ('contracts.max_file_size_mb', '10', 'number', 
     'Tamanho máximo de arquivo de contrato em MB'),
    ('contracts.allowed_mime_types', '["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]', 'json',
     'Tipos MIME permitidos para contratos');
```

**Vantagens:**
- Configurável sem mudar código
- Pode ser alterado em runtime
- Centralizado

---

### 12. **Validação de JSONB**

#### Situação Atual
- JSONB sem validação explícita

#### Sugestão
Criar funções de validação: sim implementar 

```sql
-- Função para validar metadata de subscriber_billing
CREATE OR REPLACE FUNCTION validate_subscriber_billing_metadata(
    p_billing_type TEXT,
    p_metadata JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    CASE p_billing_type
        WHEN 'exhibition_lot' THEN
            RETURN p_metadata ? 'lot_size' AND p_metadata ? 'exhibitions_used';
        WHEN 'totem_quantity' THEN
            RETURN p_metadata ? 'totem_count' AND p_metadata ? 'days';
        WHEN 'time_based' THEN
            RETURN p_metadata ? 'start_date' AND p_metadata ? 'end_date' AND p_metadata ? 'hourly_rate';
        ELSE
            RETURN true;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para validar antes de inserir
CREATE OR REPLACE FUNCTION check_subscriber_billing_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT validate_subscriber_billing_metadata(NEW.billing_type, NEW.metadata) THEN
        RAISE EXCEPTION 'Invalid metadata for billing_type %', NEW.billing_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_subscriber_billing_metadata_trigger
    BEFORE INSERT OR UPDATE ON subscriber_billing
    FOR EACH ROW
    EXECUTE FUNCTION check_subscriber_billing_metadata();
```

**Vantagens:**
- Validação garantida no banco
- Previne dados inválidos
- Mensagens de erro claras

---

### 13. **Particionamento de Tabelas Grandes**

#### Situação Atual
- Tabelas sem particionamento

#### Sugestão sim aplique esta aqui. 
Para tabelas grandes (logs, analytics), considerar particionamento:

```sql
-- Exemplo: Particionar execution_logs por mês
CREATE TABLE execution_logs (
    log_id BIGSERIAL,
    totem_id INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    ...
    PRIMARY KEY (log_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Criar partições mensais
CREATE TABLE execution_logs_2025_01 PARTITION OF execution_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE execution_logs_2025_02 PARTITION OF execution_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... etc

-- Criar função para criar partições automaticamente
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_month DATE
)
RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_start_date := date_trunc('month', p_month);
    v_end_date := v_start_date + interval '1 month';
    v_partition_name := p_table_name || '_' || to_char(v_start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        v_partition_name,
        p_table_name,
        v_start_date,
        v_end_date
    );
END;
$$ LANGUAGE plpgsql;
```

**Vantagens:**
- Performance melhorada em tabelas grandes
- Manutenção mais fácil (pode dropar partições antigas)
- Queries mais rápidas com filtro de data

**NOTA:** Implementar apenas se tabelas forem muito grandes (>1M registros). sim 

---

### 14. **Documentação SQL (COMMENTs)**

#### Situação Atual
- Alguns COMMENTs criados

#### Sugestão
Adicionar COMMENTs em TODAS as colunas importantes: sim 

```sql
-- Exemplo completo
COMMENT ON TABLE subscribers IS 'Anunciantes/Assinantes que compram espaço publicitário no SmartSignage';
COMMENT ON COLUMN subscribers.subscriber_id IS 'ID único do assinante (PK)';
COMMENT ON COLUMN subscribers.name IS 'Nome/razão social do assinante';
COMMENT ON COLUMN subscribers.email IS 'Email único do assinante (usado para login)';
COMMENT ON COLUMN subscribers.is_active IS 'Se false, assinante está inativo';

-- ... aplicar em todas as tabelas e colunas importantes
```

**Vantagens:**
- Documentação sempre sincronizada
- Facilita onboarding de novos desenvolvedores
- Ferramentas SQL mostram comentários automaticamente

---

### 15. **Scripts de Validação Automatizados**

#### Situação Atual
- Validação manual

#### Sugestão
Criar scripts SQL de validação automatizados: sim implemente 

```sql
-- Script: validate_schema.sql
-- Verificar integridade completa do schema

DO $$
DECLARE
    v_error_count INTEGER := 0;
BEGIN
    -- Verificar se todas as tabelas foram criadas
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscribers') THEN
        RAISE NOTICE 'ERRO: Tabela subscribers não existe!';
        v_error_count := v_error_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'publishers') THEN
        RAISE NOTICE 'ERRO: Tabela publishers não existe!';
        v_error_count := v_error_count + 1;
    END IF;
    
    -- Verificar se não há mais client_id ou host_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE column_name LIKE '%client_id%' 
          AND column_name != 'subscriber_id'
    ) THEN
        RAISE NOTICE 'ERRO: Ainda existem colunas com client_id!';
        v_error_count := v_error_count + 1;
    END IF;
    
    -- ... mais verificações
    
    IF v_error_count = 0 THEN
        RAISE NOTICE '✅ Validação passou! Schema está correto.';
    ELSE
        RAISE EXCEPTION '❌ Validação falhou! % erros encontrados.', v_error_count;
    END IF;
END $$;
```

**Vantagens:**
- Validação automatizada
- Pode ser executada em CI/CD
- Detecção precoce de problemas

---

## 📋 Priorização das Melhorias

### 🔴 Alta Prioridade (Implementar Agora)
1. ✅ Constraints de negócio adicionais (#5)
2. ✅ Indexação parcial (#4)
3. ✅ Triggers para updated_at (#3)
4. ✅ Documentação SQL (#14)
5. ✅ Scripts de validação (#15)

### 🟡 Média Prioridade (Implementar Depois)
6. ⚠️ Versionamento de schema (#2)
7. ⚠️ Funções úteis (#7)
8. ⚠️ Configuração de path (#11)
9. ⚠️ Validação de JSONB (#12)

### 🟢 Baixa Prioridade (Otimizações Futuras)
10. 📝 Materialized views (#6)
11. 📝 Row Level Security (#8)
12. 📝 Auditoria aprimorada (#10)
13. 📝 Particionamento (#13)

---

## 🎯 Recomendações Finais

### Implementação Gradual
- **Fase 1:** Implementar melhorias de alta prioridade
- **Fase 2:** Implementar melhorias de média prioridade após estabilização
- **Fase 3:** Avaliar necessidade de otimizações avançadas baseado em uso real

### Monitoramento
- Monitorar performance após implementação
- Coletar métricas de queries lentas
- Ajustar índices baseado em uso real

### Testes
- Testar todas as melhorias em ambiente de desenvolvimento primeiro
- Validar impacto em performance
- Garantir que não quebrou funcionalidades existentes

---

**Status:** Sugestões documentadas e prontas para avaliação.


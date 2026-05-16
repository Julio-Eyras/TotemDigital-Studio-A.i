-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 4: Billing e Contratos
-- (Compat legacy de contratos no final do arquivo, após CREATE TABLE)
-- =============================================

-- =============================================
-- SUBSCRIBER_BILLING (Billing de Anunciantes)
-- =============================================

CREATE TABLE IF NOT EXISTS subscriber_billing (
    billing_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- FK para subscribers
    
    campaign_id INTEGER, -- FK para campaigns (opcional - billing pode ser de campanha específica)
    contract_id INTEGER, -- FK para subscriber_contracts (cobrança recorrente do contrato)
    period_start DATE, -- Início do período faturado (mensal/anual conforme plano)
    period_end DATE, -- Fim do período faturado
    
    billing_type TEXT NOT NULL, 
        -- 'advertisement' (publicidade geral)
        -- 'campaign' (campanha específica)
        -- 'media_upload' (upload de mídia)
        -- 'storage' (armazenamento)
        -- 'subscription' (se subscriber também tem plano)
    
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    
    direction TEXT DEFAULT 'incoming', -- Sempre 'incoming' (plataforma recebe do subscriber)
    
    description TEXT,
    invoice_number TEXT UNIQUE,
    payment_method TEXT, -- credit_card, bank_transfer, pix, etc.
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded, cancelled, overdue
    
    payment_date TIMESTAMP,
    due_date TIMESTAMP,
    
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    stripe_invoice_id TEXT,
    
    is_active BOOLEAN DEFAULT true,
    metadata JSONB, -- Dados adicionais
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_subscriber_billing_type 
        CHECK (billing_type IN (
            'advertisement', 'campaign', 'media_upload', 'storage', 'subscription',
            'exhibition_lot', 'totem_quantity', 'time_based', 'custom'
        )),
    CONSTRAINT chk_subscriber_billing_direction 
        CHECK (direction = 'incoming'),
    CONSTRAINT chk_subscriber_billing_amount 
        CHECK (amount > 0),
    CONSTRAINT chk_subscriber_billing_payment_status 
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'overdue'))
);

COMMENT ON TABLE subscriber_billing IS 'Cobranças de subscribers (anunciantes que pagam por publicidade)';
COMMENT ON COLUMN subscriber_billing.subscriber_id IS 'Subscriber (anunciante) que está sendo cobrado';
COMMENT ON COLUMN subscriber_billing.campaign_id IS 'Campanha relacionada (se billing_type = campaign)';
COMMENT ON COLUMN subscriber_billing.direction IS 'Sempre incoming (plataforma recebe)';

-- Compat pós-CREATE (instalação nova + upgrades; só se a tabela existir)
ALTER TABLE IF EXISTS subscriber_billing ADD COLUMN IF NOT EXISTS contract_id INTEGER;
ALTER TABLE IF EXISTS subscriber_billing ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE IF EXISTS subscriber_billing ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE IF EXISTS subscriber_billing ADD COLUMN IF NOT EXISTS notes TEXT;

DO $subscriber_billing_post$
BEGIN
  IF to_regclass('public.subscriber_billing') IS NULL THEN
    RETURN;
  END IF;
  CREATE INDEX IF NOT EXISTS idx_subscriber_billing_contract ON subscriber_billing(contract_id);
  CREATE INDEX IF NOT EXISTS idx_subscriber_billing_period ON subscriber_billing(subscriber_id, period_start, period_end);
  ALTER TABLE subscriber_billing DROP CONSTRAINT IF EXISTS chk_subscriber_billing_type;
  ALTER TABLE subscriber_billing ADD CONSTRAINT chk_subscriber_billing_type
    CHECK (billing_type IN (
      'advertisement', 'campaign', 'media_upload', 'storage', 'subscription',
      'exhibition_lot', 'totem_quantity', 'time_based', 'custom'
    ));
  ALTER TABLE subscriber_billing DROP CONSTRAINT IF EXISTS chk_subscriber_billing_payment_status;
  ALTER TABLE subscriber_billing ADD CONSTRAINT chk_subscriber_billing_payment_status
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'overdue'));
END
$subscriber_billing_post$;

-- =============================================
-- PUBLISHER_BILLING (Billing de Publishers)
-- =============================================

CREATE TABLE IF NOT EXISTS publisher_billing (
    billing_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers
    
    campaign_id INTEGER, -- FK para campaigns (se revenue share)
    totem_id INTEGER, -- FK para totems (se billing específico de totem)
    subscription_id INTEGER, -- FK para subscriptions (se subscription)
    
    billing_type TEXT NOT NULL,
        -- 'revenue_share' (publisher recebe % por exibir anúncios)
        -- 'payout' (pagamento ao publisher)
        -- 'subscription' (publisher paga para usar sistema)
        -- 'platform_fee' (taxa da plataforma)
    
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    
    direction TEXT NOT NULL, 
        -- 'outgoing' (publisher recebe - revenue share)
        -- 'incoming' (publisher paga - subscription)
    
    -- Campos específicos de revenue share
    revenue_share_percentage NUMERIC(5, 2), -- % que publisher recebe (ex: 70.00)
    original_campaign_amount NUMERIC(12, 2), -- Valor original da campanha
    platform_fee_amount NUMERIC(12, 2), -- Valor retido pela plataforma
    publisher_share_amount NUMERIC(12, 2), -- Valor que publisher recebe
    
    description TEXT,
    invoice_number TEXT UNIQUE,
    payment_status TEXT DEFAULT 'pending', 
        -- Para outgoing: pending_payout, paid, failed
        -- Para incoming: pending, paid, failed, overdue
    
    payment_date TIMESTAMP,
    due_date TIMESTAMP,
    
    -- Aprovação de payout (por tenant user)
    approved_by INTEGER, -- FK para users (tenant user que aprovou payout)
    approved_at TIMESTAMP,
    
    payment_method TEXT,
    payment_reference TEXT, -- Referência do pagamento (comprovante)
    
    stripe_payment_intent_id TEXT,
    stripe_transfer_id TEXT,
    stripe_invoice_id TEXT,
    
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_publisher_billing_type 
        CHECK (billing_type IN ('revenue_share', 'payout', 'subscription', 'platform_fee')),
    CONSTRAINT chk_publisher_billing_direction 
        CHECK (direction IN ('incoming', 'outgoing')),
    CONSTRAINT chk_publisher_billing_amount 
        CHECK (amount > 0),
    CONSTRAINT chk_publisher_billing_revenue_share 
        CHECK (
            (billing_type != 'revenue_share') OR
            (revenue_share_percentage IS NOT NULL AND 
             revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)
        ),
    CONSTRAINT chk_publisher_billing_payment_status 
        CHECK (payment_status IN ('pending', 'pending_payout', 'paid', 'failed', 'refunded', 'cancelled', 'overdue'))
);

COMMENT ON TABLE publisher_billing IS 'Cobranças/pagamentos de publishers (podem receber % OU pagar subscription)';
COMMENT ON COLUMN publisher_billing.direction IS 'outgoing = publisher recebe, incoming = publisher paga';
COMMENT ON COLUMN publisher_billing.revenue_share_percentage IS '% que publisher recebe (ex: 70 = 70%)';
COMMENT ON COLUMN publisher_billing.approved_by IS 'User (tenant) que aprovou o payout';

DO $publisher_billing_post$
BEGIN
  IF to_regclass('public.publisher_billing') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE publisher_billing DROP CONSTRAINT IF EXISTS chk_publisher_billing_payment_status;
  ALTER TABLE publisher_billing ADD CONSTRAINT chk_publisher_billing_payment_status
    CHECK (payment_status IN ('pending', 'pending_payout', 'paid', 'failed', 'refunded', 'cancelled', 'overdue'));
END
$publisher_billing_post$;

-- =============================================
-- SUBSCRIBER_CONTRACTS (Contratos de Subscribers)
-- =============================================

CREATE TABLE IF NOT EXISTS subscriber_contracts (
    contract_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER, -- FK para subscribers (NULL temporariamente até subscriber ser criado)
    plan_id INTEGER, -- FK para plans - Plano associado ao contrato
    
    contract_number TEXT NOT NULL,
    contract_type TEXT NOT NULL, 
        -- 'advertising' (contrato de publicidade)
        -- 'subscription' (contrato de assinatura)
        -- 'partnership' (parceria)
    
    title TEXT NOT NULL,
    description TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Valores contratuais
    total_amount NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    billing_interval TEXT DEFAULT 'month', -- month, four_month, semester, year (período acordado)
    payment_terms TEXT, -- Rótulo legado / condições adicionais (ex.: Mensal)
    
    -- Arquivo do contrato
    document_path TEXT, -- Caminho do arquivo PDF/DOC/DOCX
    document_filename TEXT,
    document_mime_type TEXT,
    document_size_bytes BIGINT,
    
    status TEXT DEFAULT 'draft', -- draft, active, expired, terminated, cancelled
    is_active BOOLEAN DEFAULT true,
    
    signed_by_subscriber_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    
    metadata JSONB, -- Termos adicionais, cláusulas, etc.
    
    created_by INTEGER, -- FK para users (tenant user que criou)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_subscriber_contract_type 
        CHECK (contract_type IN ('advertising', 'subscription', 'partnership')),
    CONSTRAINT chk_subscriber_contract_status 
        CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'cancelled')),
    CONSTRAINT chk_subscriber_contract_dates 
        CHECK (end_date IS NULL OR start_date <= end_date),
    CONSTRAINT chk_subscriber_contract_creation
        CHECK (subscriber_id IS NOT NULL)
);

COMMENT ON TABLE subscriber_contracts IS 'Contratos com subscribers (anunciantes)';
COMMENT ON COLUMN subscriber_contracts.plan_id IS 'FK para plans - Plano associado ao contrato do subscriber';
COMMENT ON COLUMN subscriber_contracts.document_path IS 'Caminho do arquivo do contrato (PDF/DOC/DOCX)';

-- Unicidade por (subscriber_id, contract_number) — criado após a tabela existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_contracts_subscriber_contract_number
    ON subscriber_contracts (subscriber_id, contract_number);

-- Compat upgrades: preços por periodicidade no plano + intervalo estruturado no contrato
DO $billing_interval_upgrade$
BEGIN
  IF to_regclass('public.plans') IS NOT NULL THEN
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_four_month NUMERIC(12, 2);
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_semester NUMERIC(12, 2);
    UPDATE plans
    SET price_four_month = ROUND(price_monthly * 4, 2)
    WHERE price_four_month IS NULL AND price_monthly IS NOT NULL AND price_monthly > 0;
    UPDATE plans
    SET price_semester = ROUND(price_monthly * 6, 2)
    WHERE price_semester IS NULL AND price_monthly IS NOT NULL AND price_monthly > 0;
  END IF;
  IF to_regclass('public.subscriber_contracts') IS NOT NULL THEN
    ALTER TABLE subscriber_contracts ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';
    UPDATE subscriber_contracts sc
    SET billing_interval = CASE
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%anual%' THEN 'year'
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%semestr%' THEN 'semester'
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%quadrim%'
        OR LOWER(COALESCE(sc.payment_terms, '')) LIKE '%4 mes%' THEN 'four_month'
      WHEN p.billing_interval IS NOT NULL AND p.billing_interval <> '' THEN p.billing_interval
      ELSE 'month'
    END
    FROM plans p
    WHERE sc.billing_interval IS NULL
      AND sc.plan_id = p.plan_id;
    UPDATE subscriber_contracts sc
    SET billing_interval = CASE
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%anual%' THEN 'year'
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%semestr%' THEN 'semester'
      WHEN LOWER(COALESCE(sc.payment_terms, '')) LIKE '%quadrim%'
        OR LOWER(COALESCE(sc.payment_terms, '')) LIKE '%4 mes%' THEN 'four_month'
      ELSE 'month'
    END
    WHERE sc.billing_interval IS NULL;
  END IF;
  IF to_regclass('public.plans') IS NOT NULL THEN
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_four_month TEXT;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_semester TEXT;
  END IF;
END
$billing_interval_upgrade$;

-- =============================================
-- PUBLISHER_CONTRACTS (Contratos de Publishers)
-- =============================================

CREATE TABLE IF NOT EXISTS publisher_contracts (
    contract_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers (obrigatório)
    
    contract_number TEXT NOT NULL,
    contract_type TEXT NOT NULL,
        -- 'revenue_share' (contrato de revenue share)
        -- 'subscription' (contrato de assinatura)
        -- 'partnership' (parceria)
        -- 'hybrid' (recebe % E paga subscription)
    
    title TEXT NOT NULL,
    description TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Termos de revenue share (se aplicável)
    revenue_share_percentage NUMERIC(5, 2), -- % fixo de revenue share
    revenue_share_rules JSONB, -- Regras variáveis (ex: por tipo de campanha)
    minimum_payout_amount NUMERIC(12, 2), -- Valor mínimo para payout
    
    -- Termos de subscription (se aplicável)
    subscription_amount NUMERIC(12, 2), -- Valor mensal/anual da subscription
    subscription_interval TEXT, -- month, four_month, semester, year
    
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT,
    
    -- Arquivo do contrato
    document_path TEXT,
    document_filename TEXT,
    document_mime_type TEXT,
    document_size_bytes BIGINT,
    
    status TEXT DEFAULT 'draft', -- draft, active, expired, terminated, cancelled
    is_active BOOLEAN DEFAULT true,
    
    signed_by_publisher_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    
    metadata JSONB,
    
    created_by INTEGER, -- FK para users (tenant user que criou)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_publisher_contract_type 
        CHECK (contract_type IN ('revenue_share', 'subscription', 'partnership', 'hybrid')),
    CONSTRAINT chk_publisher_contract_status 
        CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'cancelled')),
    CONSTRAINT chk_publisher_contract_revenue_share 
        CHECK (
            (revenue_share_percentage IS NULL) OR
            (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)
        ),
    CONSTRAINT chk_publisher_contract_dates 
        CHECK (end_date IS NULL OR start_date <= end_date),
    CONSTRAINT chk_publisher_contract_creation
        CHECK (publisher_id IS NOT NULL)
);

COMMENT ON TABLE publisher_contracts IS 'Contratos com publishers (revenue share, subscription ou ambos)';
COMMENT ON COLUMN publisher_contracts.revenue_share_percentage IS '% fixo de revenue share (NULL se variável)';
COMMENT ON COLUMN publisher_contracts.revenue_share_rules IS 'Regras variáveis de revenue share (JSON)';

-- Unicidade por (publisher_id, contract_number) — criado após a tabela existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_publisher_contracts_publisher_contract_number
    ON publisher_contracts (publisher_id, contract_number);

-- Compat legacy de contratos (após CREATE TABLE; idempotente)
ALTER TABLE IF EXISTS subscriber_contracts DROP COLUMN IF EXISTS created_before_subscriber CASCADE;
ALTER TABLE IF EXISTS publisher_contracts DROP COLUMN IF EXISTS created_before_publisher CASCADE;
DROP INDEX IF EXISTS idx_subscriber_contracts_created_before;
DROP INDEX IF EXISTS idx_publisher_contracts_created_before;
ALTER TABLE IF EXISTS subscriber_contracts
    DROP CONSTRAINT IF EXISTS subscriber_contracts_contract_number_key;
DROP INDEX IF EXISTS subscriber_contracts_contract_number_key;
ALTER TABLE IF EXISTS publisher_contracts
    DROP CONSTRAINT IF EXISTS publisher_contracts_contract_number_key;
DROP INDEX IF EXISTS publisher_contracts_contract_number_key;

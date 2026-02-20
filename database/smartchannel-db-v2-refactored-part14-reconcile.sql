-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 14: Reconciliation: plan_publisher_access -> subscriber_publisher_access
-- =============================================

-- Table for queued reconciliation jobs
CREATE TABLE IF NOT EXISTS reconcile_plan_publisher_jobs (
  job_id SERIAL PRIMARY KEY,
  plan_id INTEGER,
  publisher_id INTEGER,
  action TEXT, -- 'upsert'|'remove'|'full' (full = reconcile all subscribers for plan)
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITHOUT TIME ZONE NULL,
  processed_by TEXT NULL,
  result JSONB NULL
);

COMMENT ON TABLE reconcile_plan_publisher_jobs IS 'Queue de jobs para reconciliar plan_publisher_access → subscriber_publisher_access';

-- Function to enqueue a job (called by trigger or manually)
CREATE OR REPLACE FUNCTION enqueue_reconcile_plan_publisher(p_plan_id INTEGER, p_publisher_id INTEGER, p_action TEXT DEFAULT 'upsert')
RETURNS VOID AS $$
BEGIN
  INSERT INTO reconcile_plan_publisher_jobs (plan_id, publisher_id, action)
  VALUES (p_plan_id, p_publisher_id, p_action);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_reconcile_plan_publisher IS 'Enfileira job de reconciliação para plan_id/publisher_id';

-- Trigger function to enqueue job on plan_publisher_access changes
CREATE OR REPLACE FUNCTION trg_plan_publisher_access_enqueue()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id INTEGER;
  v_publisher_id INTEGER;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_plan_id := NEW.plan_id;
    v_publisher_id := NEW.publisher_id;
    PERFORM enqueue_reconcile_plan_publisher(v_plan_id, v_publisher_id, 'upsert');
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_plan_id := NEW.plan_id;
    v_publisher_id := NEW.publisher_id;
    PERFORM enqueue_reconcile_plan_publisher(v_plan_id, v_publisher_id, 'upsert');
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    v_plan_id := OLD.plan_id;
    v_publisher_id := OLD.publisher_id;
    PERFORM enqueue_reconcile_plan_publisher(v_plan_id, v_publisher_id, 'remove');
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plan_publisher_access_enqueue ON plan_publisher_access;
CREATE TRIGGER trigger_plan_publisher_access_enqueue
AFTER INSERT OR UPDATE OR DELETE ON plan_publisher_access
FOR EACH ROW EXECUTE FUNCTION trg_plan_publisher_access_enqueue();

COMMENT ON FUNCTION trg_plan_publisher_access_enqueue IS 'Trigger que enfileira job ao alterar plan_publisher_access';

-- Reconciliation executor: process one job
CREATE OR REPLACE FUNCTION execute_reconcile_job(p_job_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  job_row RECORD;
  plan_allowed BOOLEAN;
  affected_count INTEGER := 0;
BEGIN
  SELECT * INTO job_row FROM reconcile_plan_publisher_jobs WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;

  -- If action = 'full' and plan_id provided, reconcile all publishers of that plan
  IF job_row.action = 'remove' THEN
    -- Remove subscriber_publisher_access entries created by contracts referencing this plan and publisher
    DELETE FROM subscriber_publisher_access spa
    USING subscriber_contracts sc
    WHERE spa.contract_id = sc.contract_id
      AND sc.plan_id = job_row.plan_id
      AND spa.publisher_id = job_row.publisher_id
      AND spa.is_active = true;
    affected_count := COALESCE((SELECT COUNT(*) FROM subscriber_publisher_access WHERE contract_id IN (SELECT contract_id FROM subscriber_contracts WHERE plan_id = job_row.plan_id) AND publisher_id = job_row.publisher_id),0);
  ELSE
    -- Upsert: for every active contract that uses the plan, ensure subscriber_publisher_access exists when plan_publisher_access allows it.
    SELECT EXISTS(
      SELECT 1 FROM plan_publisher_access ppa
      WHERE ppa.plan_id = job_row.plan_id
        AND ppa.publisher_id = job_row.publisher_id
        AND ppa.is_allowed = true
        AND COALESCE(ppa.is_active, true) = true
    ) INTO plan_allowed;

    IF plan_allowed THEN
      WITH contracts AS (
        SELECT contract_id, subscriber_id FROM subscriber_contracts
        WHERE plan_id = job_row.plan_id
          AND status = 'active'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND start_date <= CURRENT_DATE
      )
      INSERT INTO subscriber_publisher_access (subscriber_id, publisher_id, contract_id, plan_id, access_type, is_active, created_at, updated_at)
      SELECT c.subscriber_id, job_row.publisher_id, c.contract_id, job_row.plan_id, 'contract', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM contracts c
      ON CONFLICT (subscriber_id, publisher_id) DO UPDATE
      SET contract_id = EXCLUDED.contract_id, plan_id = EXCLUDED.plan_id, is_active = true, updated_at = CURRENT_TIMESTAMP;

      GET DIAGNOSTICS affected_count = ROW_COUNT;
    ELSE
      -- If plan no longer allows, deactivate corresponding accesses (created by contracts for this plan)
      UPDATE subscriber_publisher_access spa
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      FROM subscriber_contracts sc
      WHERE spa.contract_id = sc.contract_id
        AND sc.plan_id = job_row.plan_id
        AND spa.publisher_id = job_row.publisher_id
        AND spa.is_active = true;

      GET DIAGNOSTICS affected_count = ROW_COUNT;
    END IF;
  END IF;

  UPDATE reconcile_plan_publisher_jobs
  SET processed_at = CURRENT_TIMESTAMP,
      result = jsonb_build_object('affected', affected_count),
      processed_by = current_user
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object('job_id', p_job_id, 'affected', affected_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION execute_reconcile_job IS 'Executa job de reconciliação enfileirado (upsert/remove)';

-- Utility: process N pending jobs (callable manually)
CREATE OR REPLACE FUNCTION process_pending_reconcile_jobs(p_limit INTEGER DEFAULT 100)
RETURNS SETOF JSONB AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT job_id FROM reconcile_plan_publisher_jobs WHERE processed_at IS NULL ORDER BY created_at LIMIT p_limit LOOP
    RETURN NEXT execute_reconcile_job(r.job_id);
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_pending_reconcile_jobs IS 'Processa jobs pendentes de reconciliação (até p_limit)';

-- =============================================
-- PARTE 14: Reconciliar plan_publisher_access -> subscriber_publisher_access
-- =============================================

-- Função: reconcilia acessos materializados (subscriber_publisher_access)
-- com regras declarativas em plan_publisher_access para um plano específico.
-- Esta função é idempotente e atualiza/inativa registros conforme necessário.
CREATE OR REPLACE FUNCTION reconcile_plan_publisher_access(p_plan_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- 1) Insertar acessos para contratos ativos que pertencem ao plan e para publishers permitidos
  INSERT INTO subscriber_publisher_access (subscriber_id, publisher_id, contract_id, plan_id, access_type, is_active, created_at, updated_at)
  SELECT 
    sc.subscriber_id,
    ppa.publisher_id,
    sc.contract_id,
    sc.plan_id,
    'contract'::text,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM subscriber_contracts sc
  JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
  WHERE sc.plan_id = p_plan_id
    AND sc.status = 'active'
    AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
    AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
    AND ppa.is_allowed = true
  ON CONFLICT (subscriber_id, publisher_id)
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    plan_id = EXCLUDED.plan_id,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

  -- 2) Inativar acessos materializados que passaram a ser negados pelo plano
  UPDATE subscriber_publisher_access spa
  SET is_active = false,
      updated_at = CURRENT_TIMESTAMP
  WHERE EXISTS (
    SELECT 1
    FROM subscriber_contracts sc
    WHERE sc.contract_id = spa.contract_id
      AND sc.plan_id = p_plan_id
  )
  AND spa.publisher_id NOT IN (
    SELECT publisher_id FROM plan_publisher_access WHERE plan_id = p_plan_id AND is_allowed = true
  )
  AND spa.is_active = true;

  -- 3) Opcional: registrar audit log simples (se tabela audit_logs existir)
  PERFORM
    CASE WHEN to_regclass('public.audit_logs') IS NOT NULL THEN
      (INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES (NULL, 'reconcile', 'plan_publisher_access', p_plan_id, NULL, CURRENT_TIMESTAMP))
    ELSE
      NULL
    END;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reconcile_plan_publisher_access IS 'Reconcilia subscriber_publisher_access para um plan_id baseado em plan_publisher_access / contratos ativos';

-- Função: reconcilia todos os planos (varre plan_publisher_access ativos)
CREATE OR REPLACE FUNCTION reconcile_all_plan_publisher_access()
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT plan_id FROM plan_publisher_access WHERE is_active = true LOOP
    PERFORM reconcile_plan_publisher_access(r.plan_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reconcile_all_plan_publisher_access IS 'Reconcilia todos os planos configurados em plan_publisher_access';


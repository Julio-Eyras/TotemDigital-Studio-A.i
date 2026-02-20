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


-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 15: Contracts indexes, audit and triggers
-- =============================================

-- Index to speed contract lookups for validation
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_sub_status_dates
ON subscriber_contracts (subscriber_id, status, start_date, end_date);

-- Audit table for contract changes that may impact campaigns
CREATE TABLE IF NOT EXISTS contract_change_audit (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'status_changed' | 'end_date_expired' | 'cancelled'
  old_status TEXT NULL,
  new_status TEXT NULL,
  old_end_date DATE NULL,
  new_end_date DATE NULL,
  details JSONB NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE contract_change_audit IS 'Auditoria de alterações relevantes em contratos que afetam campanhas';

-- Function to record audit and cascade effects
CREATE OR REPLACE FUNCTION trg_contract_change_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_now DATE := CURRENT_DATE;
BEGIN
  -- Only act when status or end_date changes
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.end_date IS DISTINCT FROM NEW.end_date) THEN
      -- Insert audit record
      INSERT INTO contract_change_audit (
        contract_id, action, old_status, new_status, old_end_date, new_end_date, details
      ) VALUES (
        NEW.contract_id,
        CASE
          WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed'
          WHEN OLD.end_date IS DISTINCT FROM NEW.end_date THEN 'end_date_changed'
          ELSE 'updated'
        END,
        OLD.status,
        NEW.status,
        OLD.end_date,
        NEW.end_date,
        jsonb_build_object('by', current_user)
      );

      -- If contract became non-active or cancelled, deactivate campaigns linked to it
      IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'active') OR
         (NEW.end_date IS NOT NULL AND NEW.end_date < v_now) THEN
        UPDATE campaigns
        SET is_active = false,
            status = 'paused',
            updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = NEW.contract_id
          AND is_active = true;

        -- Deactivate subscriber_publisher_access entries sourced from this contract
        UPDATE subscriber_publisher_access
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = NEW.contract_id AND is_active = true;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contract_change_audit ON subscriber_contracts;
CREATE TRIGGER trigger_contract_change_audit
AFTER UPDATE OF status, end_date ON subscriber_contracts
FOR EACH ROW EXECUTE FUNCTION trg_contract_change_audit();

COMMENT ON FUNCTION trg_contract_change_audit IS 'Trigger que registra alterações de contrato e desativa campanhas/acessos quando necessário';


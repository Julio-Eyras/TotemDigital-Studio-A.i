-- Compatibilidade: incluir 'overdue' em chk_publisher_billing_payment_status (faturas incoming vencidas).
-- Idempotente. Corrige instalações existentes onde part4 não recriou a constraint.
ALTER TABLE IF EXISTS publisher_billing DROP CONSTRAINT IF EXISTS chk_publisher_billing_payment_status;
ALTER TABLE IF EXISTS publisher_billing ADD CONSTRAINT chk_publisher_billing_payment_status
    CHECK (payment_status IN ('pending', 'pending_payout', 'paid', 'failed', 'refunded', 'cancelled', 'overdue'));

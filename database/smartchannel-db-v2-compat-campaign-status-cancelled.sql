-- Compatibilidade: incluir 'cancelled' em chk_campaign_status (API/validators/UI).
-- Idempotente. Corrige instalações existentes onde o CREATE TABLE IF NOT EXISTS de part3
-- não recriou a tabela; instalações novas recebem o mesmo CHECK em part3 e este bloco apenas reafirma.
ALTER TABLE IF EXISTS campaigns DROP CONSTRAINT IF EXISTS chk_campaign_status;
ALTER TABLE IF EXISTS campaigns ADD CONSTRAINT chk_campaign_status
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'paused', 'finished', 'cancelled', 'deleted'));

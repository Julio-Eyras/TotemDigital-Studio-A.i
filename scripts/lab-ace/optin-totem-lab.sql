-- Opt-in ACE 0.1 (lab, um totem).
-- NÃO CORRER NO INSTALADOR. Não entra em carga-inicial-v6.sql nem em apply-schema-v2.sh.
-- Default continua off. Direct e Player-AD não leem isto.
-- Se o totem 41 não existir, substituir totem_id pelo id de lab.

-- Confirmar estado actual
-- SELECT totem_id, capabilities FROM totems WHERE totem_id = 41;

-- Ligar
UPDATE totems
SET capabilities = COALESCE(capabilities, '{}'::jsonb) || '{"ace_enabled": true}'::jsonb
WHERE totem_id = 41;

-- Equivalente nested: '{"ace": {"enabled": true}}'

-- Desligar
UPDATE totems
SET capabilities = (COALESCE(capabilities, '{}'::jsonb) - 'ace_enabled')
  || '{"ace_enabled": false}'::jsonb
WHERE totem_id = 41;

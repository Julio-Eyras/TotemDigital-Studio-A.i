-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 16: Plans (compatibilidade seeds)
-- =============================================
-- Ajustes opcionais para a tabela plans antes dos seeds.
-- A tabela plans é criada em part2; a carga-inicial-v6.sql insere plan_id 1-6.
-- As sequências são corrigidas por fix-sequences-after-seed.sql após a carga.
-- Este arquivo existe para manter a ordem do apply; não altera estrutura.

COMMENT ON TABLE plans IS 'Planos de assinatura (compatível com seeds e subscriber_contracts.plan_id)';

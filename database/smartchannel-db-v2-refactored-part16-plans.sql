-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 16: Ajustes em Plans (colunas/índices compatibilidade)
-- =============================================

-- Garantir coluna is_default para compatibilidade com seeds antigos
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN plans.is_default IS 'Indica se o plano é o padrão/selecionado por default em listas';

-- Índice parcial para planos ativos populares/padrão (consulta comum em listagens)
CREATE INDEX IF NOT EXISTS idx_plans_popular_default_active
ON plans (is_popular DESC, is_default DESC)
WHERE is_active = true;


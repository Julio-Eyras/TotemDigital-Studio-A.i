-- Migração: Índices para Otimização de Analytics SmartDisplayFX
-- Data: Janeiro 2025
-- Objetivo: Melhorar performance de queries de analytics

-- Índices para fx_telemetry (tabela mais consultada)
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_created_at ON fx_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_totem_effect ON fx_telemetry(totem_id, effect_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_status ON fx_telemetry(status) WHERE status != 'success';
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_totem_date ON fx_telemetry(totem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_effect_date ON fx_telemetry(effect_id, created_at DESC);

-- Índices compostos para queries frequentes
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_site_date ON fx_telemetry(created_at DESC) 
  WHERE totem_id IN (SELECT totem_id FROM fx_totem_sites);

-- Índices para execution_logs (analytics geral)
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_date ON execution_logs(totem_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign_date ON execution_logs(campaign_id, executed_at DESC) 
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_logs_success_date ON execution_logs(executed_at DESC) 
  WHERE play_success = true;

-- Índices para campaigns (queries de campanhas ativas)
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active, start_date, end_date) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);

-- Índices para totems (heartbeat e status)
CREATE INDEX IF NOT EXISTS idx_totems_heartbeat ON totems(last_heartbeat) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_totems_status_active ON totems(status, is_active) 
  WHERE is_active = true;

-- Índices para fx_sites e relacionamentos
CREATE INDEX IF NOT EXISTS idx_fx_totem_sites_site ON fx_totem_sites(site_id);
CREATE INDEX IF NOT EXISTS idx_fx_totem_sites_totem ON fx_totem_sites(totem_id);

-- Índices para fx_rules (queries de regras ativas)
CREATE INDEX IF NOT EXISTS idx_fx_rules_active ON fx_rules(is_active, site_id) 
  WHERE is_active = true;

-- Índices para medias (queries de mídia mais visualizada)
CREATE INDEX IF NOT EXISTS idx_medias_created ON medias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medias_status ON medias(status) WHERE status = 'active';

-- Comentários sobre uso dos índices
COMMENT ON INDEX idx_fx_telemetry_created_at IS 'Otimiza queries de analytics por data';
COMMENT ON INDEX idx_fx_telemetry_totem_effect IS 'Otimiza queries de performance por totem e efeito';
COMMENT ON INDEX idx_execution_logs_totem_date IS 'Otimiza analytics geral por totem e data';
COMMENT ON INDEX idx_campaigns_active IS 'Otimiza busca de campanhas ativas';


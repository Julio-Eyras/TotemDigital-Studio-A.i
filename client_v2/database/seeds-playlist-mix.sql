-- =============================================
-- Seeds para Mix Inteligente de Playlists
-- =============================================

-- Regra padrão global (systematic)
INSERT INTO playlist_mix_rules (
  name,
  description,
  totem_id,
  rule_type,
  priority_weight,
  time_weight,
  tag_weight,
  subscriber_weight,
  ai_enabled,
  use_pedestrian_detection,
  use_sentiment_analysis,
  use_context_awareness,
  use_historical_optimization,
  max_items_per_playlist,
  rotation_strategy,
  shuffle_enabled,
  is_default,
  is_active
) VALUES (
  'Regra Padrão Systemática',
  'Regra padrão usando apenas regras sistemáticas (prioridade, horário, tags)',
  NULL,
  'systematic',
  1.0,
  1.0,
  0.5,
  0.5,
  false,
  false,
  false,
  false,
  false,
  50,
  'priority',
  false,
  true,
  true
) ON CONFLICT DO NOTHING;

-- Regra híbrida padrão (com IA)
INSERT INTO playlist_mix_rules (
  name,
  description,
  totem_id,
  rule_type,
  priority_weight,
  time_weight,
  tag_weight,
  subscriber_weight,
  ai_enabled,
  use_pedestrian_detection,
  use_sentiment_analysis,
  use_context_awareness,
  use_historical_optimization,
  max_items_per_playlist,
  rotation_strategy,
  shuffle_enabled,
  is_default,
  is_active
) VALUES (
  'Regra Híbrida com IA',
  'Regra combinando regras sistemáticas com IA (transeuntes, sentimento, histórico)',
  NULL,
  'hybrid',
  1.0,
  1.0,
  0.8,
  0.6,
  true,
  true,
  true,
  true,
  true,
  50,
  'ai_optimized',
  false,
  false,
  true
) ON CONFLICT DO NOTHING;

-- Regra apenas IA
INSERT INTO playlist_mix_rules (
  name,
  description,
  totem_id,
  rule_type,
  priority_weight,
  time_weight,
  tag_weight,
  subscriber_weight,
  ai_enabled,
  ai_provider,
  ai_model,
  use_pedestrian_detection,
  use_sentiment_analysis,
  use_context_awareness,
  use_historical_optimization,
  max_items_per_playlist,
  rotation_strategy,
  shuffle_enabled,
  is_default,
  is_active
) VALUES (
  'Regra Apenas IA',
  'Regra usando apenas inteligência artificial para ordenação',
  NULL,
  'ai',
  0.5,
  0.5,
  0.3,
  0.3,
  true,
  'ollama',
  'llama2',
  true,
  true,
  true,
  true,
  50,
  'ai_optimized',
  true,
  false,
  true
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE playlist_mix_rules IS 'Regras de mixagem criadas via seeds';


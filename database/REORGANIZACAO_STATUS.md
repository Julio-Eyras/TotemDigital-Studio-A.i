# Status da Reorganização do smartchannel-db.sql

## ✅ Correções Aplicadas

1. **Foreign Key do billing**: Corrigida - agora está inline na definição da tabela
2. **Índices do billing**: Removidos blocos DO condicionais - índices criados diretamente
3. **Migração qr_codes**: Removida (120 linhas) - tabela já definida corretamente
4. **Migração remote_commands**: Removida - colunas adicionadas na definição da tabela
5. **Backup criado**: Arquivo original salvo com timestamp

## 🔧 Problemas Identificados

1. **Ordem de criação**: Tabelas não estão na ordem correta de dependências
2. **Blocos DO condicionais**: 26 blocos DO encontrados - muitos são desnecessários (sem legados)
3. **Migrações antigas**: Bloco grande de migração para qr_codes (linhas 2919-3038) que não é mais necessário
4. **Foreign keys**: Algumas estão em blocos DO ao invés de inline nas definições

## 📋 Estrutura Proposta

### Ordem de Criação (74 tabelas)

**NÍVEL BASE (16 tabelas)** - Sem dependências
1. clients, hosts, ai_models, system_logs, webhook_configs, alert_rules
2. ml_models, roles, permissions, system_settings, plans
3. fx_effects, fx_rules, fx_timelines, webhooks, smart_tvs

**NÍVEL 1 (9 tabelas)** - Dependem apenas de base
4. users, stripe_customers, campaigns, fx_sites, locals
5. webhook_deliveries, alert_logs, role_permissions, subscriptions

**NÍVEL 2 (16 tabelas)** - Dependem de nível 1
6. export_queries, password_reset_tokens, medias, user_roles
7. audit_logs, advanced_schedules, reports, report_templates
8. user_two_factor, two_factor_attempts, ota_updates
9. dashboard_layouts, backups, export_schedules
10. tags, recognized_persons, approval_workflows

**NÍVEL 3 (33 tabelas)** - Dependem de nível 2
11. totems, schedule_executions, playlists, smart_playlists
12. campaign_totems, qr_codes, short_links, remote_commands
13. billing, analytics_sessions, execution_logs
14. emotion_data, gesture_data, behavior_data, totem_ml_config
15. ml_sessions, aggregated_metrics, device_certificates
16. totem_update_status, interaction_logs, totem_network
17. fx_telemetry, fx_totem_sites, export_executions
18. playlist_items, campaign_playlists, event_logs
19. analytics_qr_scans, remote_screenshots, payments
20. analytics_emotions, analytics_gestures

## 🎯 Próximos Passos

1. **Remover migração qr_codes** (linhas 2919-3038) - não é mais necessária
2. **Reorganizar tabelas** na ordem correta de dependências
3. **Mover foreign keys** para inline nas definições
4. **Remover blocos DO** desnecessários (manter apenas triggers se necessário)
5. **Organizar seções**: Tabelas → Índices → Views → Comentários → Dados

## ⚠️ Nota Importante

O arquivo tem 3556 linhas. A reorganização completa levará tempo, mas pode ser feita de forma sistemática seção por seção. A estrutura atual funciona, mas não está organizada.


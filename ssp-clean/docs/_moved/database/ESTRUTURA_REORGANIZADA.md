# Estrutura Reorganizada do smartchannel-db-v2-refactored-apply-all.sql

## Ordem de Criação

### 1. TABELAS BASE (sem dependências)
1. clients
2. hosts
3. ai_models
4. system_logs
5. webhook_configs
6. alert_rules
7. ml_models
8. roles
9. permissions
10. system_settings
11. plans
12. fx_effects
13. fx_rules
14. fx_timelines
15. webhooks
16. smart_tvs

### 2. TABELAS NÍVEL 1 (dependem apenas de base)
17. users (clients)
18. stripe_customers (clients)
19. campaigns (clients)
20. fx_sites (clients)
21. locals (hosts)
22. webhook_deliveries (webhook_configs)
23. alert_logs (alert_rules)
24. role_permissions (roles, permissions)
25. subscriptions (clients, plans)

### 3. TABELAS NÍVEL 2 (dependem de nível 1)
26. export_queries (users)
27. password_reset_tokens (users)
28. medias (clients, users)
29. user_roles (users, roles)
30. audit_logs (users)
31. advanced_schedules (users)
32. reports (users)
33. report_templates (users)
34. user_two_factor (users)
35. two_factor_attempts (users)
36. ota_updates (users)
37. dashboard_layouts (users)
38. backups (users)
39. export_schedules (export_queries, users)
40. tags (medias)
41. recognized_persons (medias)
42. approval_workflows (medias, users)

### 4. TABELAS NÍVEL 3 (dependem de nível 2)
43. totems (locals, clients)
44. schedule_executions (advanced_schedules)
45. playlists (totems, campaigns, clients)
46. smart_playlists (clients, campaigns, totems)
47. campaign_totems (totems, campaigns)
48. qr_codes (clients, totems, campaigns)
49. short_links (campaigns, totems)
50. remote_commands (totems, users)
51. billing (clients, campaigns, totems, subscriptions)
52. analytics_sessions (totems)
53. execution_logs (totems, clients, campaigns, medias)
54. emotion_data (totems)
55. gesture_data (totems)
56. behavior_data (totems)
57. totem_ml_config (totems)
58. ml_sessions (totems, campaigns, medias)
59. aggregated_metrics (totems, campaigns, medias)
60. device_certificates (totems)
61. totem_update_status (totems, ota_updates)
62. interaction_logs (totems, medias)
63. totem_network (totems)
64. fx_telemetry (totems)
65. fx_totem_sites (totems, fx_sites)
66. export_executions (export_schedules, export_queries)
67. playlist_items (playlists, medias)
68. campaign_playlists (campaigns, playlists)
69. event_logs (totems, campaigns, playlists, medias)
70. analytics_qr_scans (qr_codes, totems)
71. remote_screenshots (totems, remote_commands)
72. payments (billing)
73. analytics_emotions (analytics_sessions)
74. analytics_gestures (analytics_sessions)

## Estrutura do Arquivo

1. **Cabeçalho e Comentários**
2. **TABELAS** (na ordem acima, com foreign keys inline)
3. **ÍNDICES** (agrupados por tabela, em ordem alfabética)
4. **TRIGGERS E FUNÇÕES** (se houver)
5. **VIEWS** (todas juntas)
6. **COMENTÁRIOS** (COMMENT ON TABLE/COLUMN)
7. **DADOS INICIAIS** (INSERT statements)

## Regras

- ✅ Foreign keys inline nas definições das tabelas
- ✅ Sem blocos DO condicionais (não há legados)
- ✅ CREATE TABLE IF NOT EXISTS para todas as tabelas
- ✅ CREATE INDEX IF NOT EXISTS para todos os índices
- ✅ Ordem baseada em dependências reais
- ✅ Seções claras com comentários


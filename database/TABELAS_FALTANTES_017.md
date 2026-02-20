# Tabelas de Export e FX Telemetry (incluídas no schema)

O backend usa quatro tabelas que estavam faltando no schema. Elas foram **incluídas diretamente no schema principal** (não como migração separada).

## Nomes das tabelas

| Tabela               | Uso no backend |
|----------------------|----------------|
| **export_queries**   | Queries SQL para exportação (Excel, PDF, CSV) – rota `GET/POST /api/export-queries` |
| **export_schedules** | Agendamentos cron dessas queries – rota `GET/POST /api/export-schedules` |
| **export_executions**| Histórico de execuções – rota `GET /api/export-executions` |
| **fx_telemetry**     | Telemetria de execução de efeitos SmartDisplayFX – rota `GET/POST /api/smartdisplayfx/telemetry` e analytics |

## Onde estão definidas

As quatro tabelas estão no **schema principal**:

**`database/smartchannel-db-v2-refactored-part6-tables-other.sql`**

- **fx_telemetry** – na secção SMARTDISPLAYFX (após `fx_totem_sites`)
- **export_queries**, **export_schedules**, **export_executions** – na secção RELATÓRIOS E EXPORTAÇÕES (antes da tabela `reports`)

Quem aplicar o schema completo (por exemplo `apply-all-schema-v2.sh` ou a execução em ordem das partes part1…part6) passa a criar essas tabelas junto com o resto do banco.

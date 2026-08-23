# Lab ACE (`docs/lab-ace/`)

Contrato máquina do **Audience Context Engine 0.1**.  
Não é runtime. Não altera Dispatcher, Player-AD nem PostgreSQL.

Norma humana: [../ACE-0.1-SPEC.md](../ACE-0.1-SPEC.md) · ADR: [../adr/0006-ace-audience-nao-identidade.md](../adr/0006-ace-audience-nao-identidade.md)

| Ficheiro | Função |
|----------|--------|
| [audience.context.schema.json](./audience.context.schema.json) | JSON Schema `ace/0.1` |
| [PRIVACY-GATEWAY-0.1.md](./PRIVACY-GATEWAY-0.1.md) | Recusas do gateway (papel) |
| [examples/01-vazio.json](./examples/01-vazio.json) | Ninguém na zona |
| [examples/02-aproximacao-um.json](./examples/02-aproximacao-um.json) | 1 pessoa a aproximar-se |
| [examples/03-grupo-atencao-alta.json](./examples/03-grupo-atencao-alta.json) | Grupo, atenção alta |
| [examples/reject-identity-leak.json](./examples/reject-identity-leak.json) | **Inválido** — `IDENTITY_LEAK` |
| [examples/reject-stale.json](./examples/reject-stale.json) | Schema ok — gateway `STALE_CONTEXT` |
| [examples/reject-low-confidence.json](./examples/reject-low-confidence.json) | Schema ok — gateway `LOW_CONFIDENCE` |
| [../scripts/lab-ace/README.md](../scripts/lab-ace/README.md) | Validador, emissor sintético e visão no edge |
| [EDGE-VISION-0.1.md](./EDGE-VISION-0.1.md) | Contagem/dwell no edge, sem face |
| [INTERACTION-BUS-0.1.md](./INTERACTION-BUS-0.1.md) | NFC/QR/touch no mesmo bus (bools, sem `tag_id`) |
| [ACE-AUDIT-0.1.md](./ACE-AUDIT-0.1.md) | `ace.hint` em `event_logs` + anel RAM, sem PII |
| [FX-BRIDGE-0.1.md](./FX-BRIDGE-0.1.md) | Ponte SmartDisplayFX → ACE (sem UID, sem mood) |
| [examples/04-interacao-nfc.json](./examples/04-interacao-nfc.json) | 1 pessoa, NFC anónimo |
| [examples/05-interacao-qr.json](./examples/05-interacao-qr.json) | 1 pessoa, QR anónimo |
| [examples/reject-tag-id.json](./examples/reject-tag-id.json) | **Inválido** — `IDENTITY_LEAK` (`tag_id`) |

## Lab HTTP (este clone)

```text
POST /api/lab/ace/context         body = audience.context fresco (auth)
POST /api/lab/ace/interaction     body = { totem_id, nfc|qr|touch } (auth; sem tag_id)
GET  /api/lab/ace/hint/:id
GET  /api/lab/ace/audit/:id
```

Opt-in: `totems.capabilities.ace_enabled = true`. Sem isso, o Dispatcher ignora o hint (`ACE_DISABLED`).


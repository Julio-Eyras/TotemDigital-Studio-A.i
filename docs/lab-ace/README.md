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
| [../scripts/lab-ace/README.md](../scripts/lab-ace/README.md) | `validate_ace_schema.py` e `emit_ace_synthetic.py` |

## Lab HTTP (este clone)

```text
POST /api/lab/ace/context     body = audience.context fresco (auth)
GET  /api/lab/ace/hint/:id
```

Opt-in: `totems.capabilities.ace_enabled = true`. Sem isso, o Dispatcher ignora o hint (`ACE_DISABLED`).


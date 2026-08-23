# Auditoria ACE 0.1 (`ace.hint`)

**Lab.** Telemetria sem PII. Reutiliza `event_logs` (sem coluna SQL nova).

O snapshot persistido é uma **whitelist**: `count`, `motion`, `dwell_ms`, `attention`, `interaction` (bools), `clock`, `confidence`. Não grava `session_id`, `person_id`, `tag_id` nem imagem.

Recusas (`IDENTITY_LEAK`, etc.) registam só `code` + `errors` — **nunca** o body recusado.

## Onde cai

| Sítio | Quando |
|-------|--------|
| Anel em RAM (20 por totem) | Sempre no lab |
| `event_logs.event_type = ace.hint` | Best-effort; se o Postgres falhar, o ACE não cai |
| `dispatcher_log.validation_details.ace` | Já existia no plano |

## Lab HTTP

```text
GET /api/lab/ace/audit/:totemId
```

Dispatcher só escreve `ace.hint` quando o hint foi aplicado (`HINT_APPLIED`) e o totem tem ACE opt-in.

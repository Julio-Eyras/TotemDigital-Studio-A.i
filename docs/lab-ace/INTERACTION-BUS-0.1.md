# Interacção no bus ACE 0.1 (NFC / QR / touch)

**Lab.** Bools anónimos no mesmo `audience.context`. Sem `tag_id`, sem UID, sem face.

`tags_crud` continua **501**. `interaction_logs` (tem `person_id`) **não** é usado. Player-AD **não** muda. `FxOrchestratorService` continua com `mood` / `age_bucket` — isso é Identity, fora do ACE.

## Contrato

| Campo | Significa | Não transporta |
|-------|-----------|----------------|
| `interaction.nfc` | Houve leitura de tag física neste instante | UID, `tag_id`, CRM |
| `interaction.qr` | Houve scan de QR neste instante | URL, campanha, cookie |
| `interaction.touch` | Houve toque neste instante | coordenadas, utilizador |

## Lab HTTP

```text
POST /api/lab/ace/interaction
{ "totem_id": 41, "nfc": true }
{ "totem_id": 41, "interactionType": "tag_id" }   → nfc=true; o id não existe no body
```

Recusa `IDENTITY_LEAK` se vier `tag_id`, `uid`, `person_id` ou `interactionType: facial_recognition`.

Hint (só se ACE opt-in no Dispatcher): NFC/QR → `STANDARD` `priority_delta +20`. Atenção alta + dwell ≥ 4 s continua **PREMIUM** e ganha.

## Exemplos

- [examples/04-interacao-nfc.json](./examples/04-interacao-nfc.json)
- [examples/05-interacao-qr.json](./examples/05-interacao-qr.json)
- [examples/reject-tag-id.json](./examples/reject-tag-id.json) — inválido

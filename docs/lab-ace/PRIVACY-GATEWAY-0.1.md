# Privacy Gateway ACE 0.1 (papel)

**Tipo:** regras de recusa — sem câmara, sem serviço HTTP.  
**Aplica-se a:** qualquer payload que pretenda ser `audience.context`.  
**Norma:** [ACE-0.1-SPEC.md](../ACE-0.1-SPEC.md) · schema: [audience.context.schema.json](./audience.context.schema.json)

O gateway corre **antes** do ACE aceitar o snapshot. Se recusar, não há hint para o Dispatcher. O ar continua o de sempre.

---

## Cortes obrigatórios

| Código | O que corta |
|--------|-------------|
| `DROP_IMAGE` | Frame, JPEG, base64, URI de imagem |
| `DROP_FACE` | Bounding box facial, landmarks, crop |
| `DROP_EMBEDDING` | Vector / `features` |
| `DROP_BIOMETRIC` | Qualquer template biométrico |
| `DROP_PERSISTENT_ID` | `person_id`, nome, ID de CRM, cookie de pessoa |

O schema 0.1 materializa isto com `additionalProperties: false`, `privacy.identity_dropped === true`, `privacy.image_dropped === true`, e a cláusula `not` sobre campos de identidade.

---

## Códigos de recusa

| Código | Como detectar no 0.1 | Fixture |
|--------|----------------------|---------|
| `IDENTITY_LEAK` | Schema inválido por campo de identidade (`person_id`, `tag_id`, …) ou `privacy.*.dropped !== true` | [examples/reject-identity-leak.json](./examples/reject-identity-leak.json) · [examples/reject-tag-id.json](./examples/reject-tag-id.json) |
| `STALE_CONTEXT` | `now - observed_at` > 3 s | [examples/reject-stale.json](./examples/reject-stale.json) |
| `LOW_CONFIDENCE` | `confidence` abaixo do limiar (default 0.50) | [examples/reject-low-confidence.json](./examples/reject-low-confidence.json) |
| `ACE_DISABLED` | Opt-in do totem off (default Direct) | `python scripts/lab-ace/emit_ace_synthetic.py --ace-off` |

`IDENTITY_LEAK` **ganha** a `LOW_CONFIDENCE`: um payload com face ou `tag_id` é recusado mesmo com `confidence: 1`.

---

## O que o gateway **deixa passar**

`count`, `motion`, `dwell_ms`, `attention` (`none|low|medium|high`), `group`, `density`, `interaction` (bools anónimos), `clock`, `confidence`, `session_id` efémero.

Não deixa passar emoção, idade, género, humor, nome.

---

**Próximo passo (ainda sem produto operacional)**

Não ligar FX Orchestrator (`mood` / face). Interacção NFC/QR anónima, visão no edge e hint no Dispatcher já estão neste clone (opt-in).

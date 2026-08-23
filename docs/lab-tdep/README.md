# Lab TDEP 0.1 (TotemDigital Exchange Protocol)

**Papel + JSON.** Sem endpoint de produto. Sem `audience.context`. Sem Player-AD.

Norma humana: [../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md)

TDEP partilha **inventário e flight entre CMS**. O ACE descreve o ambiente *diante de uma tela desta instalação*. Não misturar.

| Ficheiro | Função |
|----------|--------|
| [face.schema.json](./face.schema.json) | Face de inventário |
| [flight.schema.json](./flight.schema.json) | Pedido de ar |
| [examples/01-face.json](./examples/01-face.json) | Face válida |
| [examples/02-flight-offered.json](./examples/02-flight-offered.json) | Flight `offered` |
| [examples/reject-format-mismatch.json](./examples/reject-format-mismatch.json) | Recusa conceptual `FORMAT_MISMATCH` |
| [../scripts/lab-tdep/validate_tdep.py](../scripts/lab-tdep/validate_tdep.py) | Validador local |

Kill-switch e prioridade local continuam no CMS vendedor, não neste JSON.

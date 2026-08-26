# Lab TDEP 0.1 (TotemDigital Exchange Protocol)

**Papel + JSON.** Sem endpoint de produto. Sem `audience.context`. Sem Player-AD.

Norma humana: [../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md)  
Contrato curto: [TDEP-0.1.md](./TDEP-0.1.md)

TDEP partilha **inventário e flight entre CMS**. O ACE descreve o ambiente *diante de uma tela desta instalação*. Não misturar.

| Ficheiro | Função |
|----------|--------|
| [TDEP-0.1.md](./TDEP-0.1.md) | Seis objectos, recusas, endpoints em papel |
| [partner.schema.json](./partner.schema.json) | Parceiro (seller/buyer) |
| [face.schema.json](./face.schema.json) | Face de inventário |
| [availability.schema.json](./availability.schema.json) | Janelas cedíveis + cap |
| [creative.schema.json](./creative.schema.json) | Criativo com variantes |
| [flight.schema.json](./flight.schema.json) | Pedido de ar |
| [proof.schema.json](./proof.schema.json) | Proof-of-play assinado |
| [examples/](./examples/) | Fixtures válidas e recusas |
| [../scripts/lab-tdep/validate_tdep.py](../scripts/lab-tdep/validate_tdep.py) | Validador local |
| [../scripts/lab-tdep/tdep_policy.py](../scripts/lab-tdep/tdep_policy.py) | Decisão do seller (lab) |
| [NODES-0.1.md](./NODES-0.1.md) | Dois nós fictícios: fill + proof, TotemNet default off |
| [LED-CMS-0.1.md](./LED-CMS-0.1.md) | Segunda implementação (CMS LED) no mesmo schema |
| [LANE-0.1.md](./LANE-0.1.md) | Lane no Dispatcher: local > fill; default off |
| [UI-0.1.md](./UI-0.1.md) | Accordion Direct: ceder ar ocioso; default off; pitch sem TotemNet |
| [ONE-PAGER-PARCEIRO-0.1.md](./ONE-PAGER-PARCEIRO-0.1.md) | Nota comercial para um CMS parceiro. Não entra no pitch de 15 min |

Kill-switch e prioridade local continuam no CMS vendedor, não neste JSON.

# ADR-0008 — TDEP não transporta audiência

**Estado:** Aceite (lab em TotemDigital-Studio-A.i)  
**Data:** 2026-08-23  
**Módulos:** federação entre CMS (lab); ACE (irmão, outro bus)

## Contexto

TDEP quer partilhar campanha e inventário *entre empresas*. ACE descreve o ambiente *diante de uma tela desta instalação*. Meter `audience.context` no TDEP 0.1 transformaria o protocolo num CMS disfarçado e arrastaria PII potencial para a federação.

## Decisão

1. TDEP 0.1 = Partner / Face / Availability / Creative / Flight / Proof (lab JSON; sem HTTP de produto).
2. **Proibido** no JSON TDEP: `audience`, `ace`, `person_id`, `mood`.
3. Sem endpoints HTTP de produto neste lote (`/tdep/v1/...` fica para depois).
4. Kill-switch e prioridade local ficam no CMS vendedor.
5. ACE continua opt-in e local.

## Consequências

- Lab em `docs/lab-tdep/` + `scripts/lab-tdep/` (`tdep_policy`, `tdep_nodes`, `led_cms`, `tdep_lane`).
- Recusa documentada: `FORMAT_MISMATCH`, `NO_CAPACITY`, `POLICY_AUDIO`, `CATEGORY_BLOCKED`, `RIGHTS_REVOKED`, `KILL_SWITCH`, `NOT_CEDIBLE`, `AUDIENCE_FORBIDDEN`, `NO_HANDSHAKE`, `TOTEMNET_OFF`.
- Player-AD não muda. TotemNet default off; opt-in por face e accordion Direct ([lab-tdep/UI-0.1.md](../lab-tdep/UI-0.1.md)). CMS LED não importa o motor TotemDigital. Lane no Dispatcher: local > fill. Nota comercial: [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](../lab-tdep/ONE-PAGER-PARCEIRO-0.1.md).

## Alternativas rejeitadas

- TotemDigital como CMS único da rede.
- `audience.context` opcional no TDEP v1 “para o parceiro contextualizar”.
- Hub a falar com a TV box do parceiro.

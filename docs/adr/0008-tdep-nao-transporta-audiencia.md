# ADR-0008 — TDEP não transporta audiência

**Estado:** Aceite (lab em TotemDigital-Studio-A.i)  
**Data:** 2026-08-23  
**Módulos:** federação entre CMS (lab); ACE (irmão, outro bus)

## Contexto

TDEP quer partilhar campanha e inventário *entre empresas*. ACE descreve o ambiente *diante de uma tela desta instalação*. Meter `audience.context` no TDEP 0.1 transformaria o protocolo num CMS disfarçado e arrastaria PII potencial para a federação.

## Decisão

1. TDEP 0.1 = Partner / Face / Flight / Proof (lab: Face + Flight neste lote).
2. **Proibido** no JSON TDEP: `audience`, `ace`, `person_id`, `mood`.
3. Sem endpoints HTTP de produto neste lote (`/tdep/v1/...` fica para depois).
4. Kill-switch e prioridade local ficam no CMS vendedor.
5. ACE continua opt-in e local.

## Consequências

- Lab em `docs/lab-tdep/` + `scripts/lab-tdep/validate_tdep.py`.
- Recusa documentada: `FORMAT_MISMATCH`, `NO_CAPACITY`, `POLICY_AUDIO`, `CATEGORY_BLOCKED`.
- Player-AD e Direct não mudam.

## Alternativas rejeitadas

- TotemDigital como CMS único da rede.
- `audience.context` opcional no TDEP v1 “para o parceiro contextualizar”.
- Hub a falar com a TV box do parceiro.

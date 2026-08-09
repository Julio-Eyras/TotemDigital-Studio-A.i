# ADR-0001 — Documentação híbrida por módulo

- **Estado:** Aceite  
- **Data:** 2026-08-09  
- **Módulos:** todos (`docs/modulos/`)

## Contexto

O produto tem Direct Totem, Multi Lite e Multi Pro, dezenas de ecrãs e regras cruzadas (SPA vs planos, telemetria, comandos). Manuais de UI e históricos de conversa não bastavam como fonte da verdade de negócio.

## Decisão

Adoptar documentação **por módulo** com híbrido:

- Requisitos EARS (`REQ-`)
- Regras RN Quando/Se/Então (`RN-`)
- Fluxos Mermaid
- Estados / state machines
- Aceite Given/When/Then (`AC-`)
- ADRs para decisões técnicas

Camadas separadas: negócio · UI · técnico · operação · histórico.

## Consequências

- Cada mudança de regra deve actualizar `docs/modulos/<slug>/MODULO.md` no mesmo PR.
- Manuais referenciam `RN-xxx` em vez de redefinir regras.
- Há custo inicial de manutenção; reduz ambiguidade entre modos.

## Alternativas rejeitadas

- SRS IEEE único monolítico — demasiado pesado.
- Só user stories — regras somem.
- Só diagramas BPMN — não testáveis sozinhos.

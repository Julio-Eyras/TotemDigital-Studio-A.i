# ADR-0006 — ACE trata audiência, não identidade

**Estado:** Aceite (lab em TotemDigital-Studio-A.i)  
**Data:** 2026-08-23  
**Módulos:** analytics-ai (futuro), dispatcher, facial_recognition (permanece deferred)

## Contexto

As conversas de produto (ACE, comparação DOOH) propõem mídia contextual. O schema actual já tem `recognized_persons`, `emotion_data` e `ai_context_data` com demografia/sentimento. A API `facial_recognition` está em `FEATURE_DEFERRED` (501). Misturar os dois caminhos faria do produto uma plataforma de vigilância e quebraria a tese comercial Direct.

## Decisão

No repositório **TotemDigital-Studio-A.i**:

1. O ACE 0.1 opera só no domínio **Audience Intelligence** (contexto anónimo e efémero).
2. O domínio **Identity** (`recognized_persons`, face, embedding, `person_id`) permanece isolado e desligado.
3. Qualquer sinal que entre no ACE passa por um Privacy Gateway conceptual (`DROP_IMAGE`, `DROP_FACE`, `DROP_EMBEDDING`, `DROP_BIOMETRIC`, `DROP_PERSISTENT_ID`).
4. O Dispatcher continua o árbitro; o ACE só emite hints.
5. TDEP v1 **não** transporta `audience.context`.

Fonte normativa: [docs/ACE-0.1-SPEC.md](../ACE-0.1-SPEC.md).

## Consequências

- Spec e labs de ACE vivem neste repo, não no TotemDigital-Studio operacional.
- `ai_context_data` não é o store do ACE 0.1 (mistura pedestres com emoção/demografia).
- `FxOrchestratorService` pode **receber** touch/NFC anónimos no ACE e **publicar** `ace.hint` sanitizado; `mood` / face continuam fora do ACE.
- Demo com câmara e face fica **fora** do 0.1.

## Alternativas rejeitadas

- Reutilizar `recognized_persons` como “audiência”.
- Meter contexto de audiência no TDEP 0.1.
- Inferir emoção/idade no v1 “porque o mercado faz isso”.

# Metodologia de documentação de módulos

**Data:** 2026-08-09  
**Objectivo:** manter requisitos, regras, fluxos e aceite **por módulo**, sem misturar manuais de ecrã, histórico de chat e decisões técnicas.

---

## 1. Camadas (obrigatório separar)

| Camada | Pergunta | Onde |
|--------|----------|------|
| **Negócio** | O que pode / não pode? | `docs/modulos/<slug>/MODULO.md` |
| **Produto / UI** | Como o utilizador faz? | `docs/manuais/` |
| **Técnico** | Como está implementado? | `docs/technical/`, código |
| **Decisão** | Porquê esta solução? | `docs/adr/` |
| **Operação** | Como instalar / reparar? | `docs/instalacao/` |
| **Histórico** | O que mudou nesta evolução? | `docs/HISTORICO-TECNICO-*.md` |

---

## 2. Pacote mínimo por módulo

Cada `MODULO.md` contém:

1. **Visão e escopo** (+ vocabulário)  
2. **Requisitos** no estilo **EARS** (`REQ-`)  
3. **Regras de negócio** (`RN-`)  
4. **Fluxos** (Mermaid + alternativas)  
5. **Estados** (tabela; state machine quando crítico)  
6. **Critérios de aceite** Given/When/Then (`AC-`)  
7. **Dependências e referências**

Template: [_template/MODULO.md](./_template/MODULO.md).

---

## 3. Padrões adoptados (híbrido)

| Conteúdo | Padrão | Porquê |
|----------|--------|--------|
| Requisitos | **EARS** | Frases curtas e testáveis |
| Regras | **RN Quando/Se/Então/Excepto/Motivo** | Invariantes explícitas |
| Fluxos | **Use case curto + Mermaid** | Legível por ops e dev |
| Estados player/totem/comando | **State machine** | Evita ambiguidade operacional |
| Aceite | **Given/When/Then** (BDD leve) | Liga regra a teste |
| Decisões de arquitectura | **ADR** | Histórico de “porquê” |
| Vocabulário | **Ubiquitous language** (DDD leve) | Mesmos nomes no código e docs |

**Não adoptamos** SRS IEEE completo como documento vivo único (pesado demais para manutenção diária).

---

## 4. Formato EARS (requisitos)

| Tipo | Forma |
|------|-------|
| Ubiquitous | O sistema deve … |
| Event-driven | Quando \<evento\>, o sistema deve … |
| State-driven | Enquanto \<estado\>, o sistema deve … |
| Unwanted | O sistema não deve … |
| Optional | Onde \<funcionalidade\>, o sistema deve … |

IDs: `REQ-<MOD>-NNN` (ex.: `REQ-PUB-003`).

---

## 5. Formato de regra de negócio

```text
RN-<MOD>-NNN — Título
Quando: <gatilho>
Se: <condição>
Então: <efeito obrigatório>
Excepto: <excepções ou —>
Motivo: <porque existe>
```

Regras são **normativas**. Fluxos descrevem caminhos; requisitos descrevem obrigações; RNs fecham restrições.

---

## 6. Critérios de aceite

```text
DADO <contexto>
QUANDO <acção>
ENTÃO <resultado observável>
```

Prioridades: **P0** (bloqueia release), **P1**, **P2**.

---

## 7. Processo de mudança

1. Identificar o módulo (slug).  
2. Actualizar `REQ`/`RN`/`AC` afectados **antes ou no mesmo PR** do código.  
3. Se a UI mudou, actualizar o manual em `docs/manuais/` com links para `RN-xxx`.  
4. Se a decisão for estrutural (schema, protocolo, modo), criar ADR.  
5. Histórico técnico regista a sessão; **não** substitui o módulo.

---

## 8. Inventário e regeneração

- Índice vivo: [00-INDICE.md](./00-INDICE.md)  
- Gerador inicial/bulk: `scripts/generate-modulos-docs.py`  
- Editar regras críticas preferencialmente no gerador **ou** no `MODULO.md` com revisão humana; evitar divergência.

---

## 9. Definition of Done documental (módulo)

### Nível L1 — estrutural (mínimo)
- [ ] Propósito e escopo claros  
- [ ] ≥1 REQ e ≥1 RN relevantes  
- [ ] Fluxo principal em Mermaid  
- [ ] Estados principais listados  
- [ ] ≥1 cenário de aceite P0  
- [ ] Dependências apontando para outros slugs  
- [ ] Referência a manual/ADR/código quando existir  

### Nível L2 — profundidade (código como evidência)
- [ ] Tudo de L1  
- [ ] ≥5 REQ cobrindo happy path, bloqueios e unwanted  
- [ ] ≥5 RN com Motivo alinhado ao comportamento real (backend/Player/UI)  
- [ ] Vocabulário alinhado a campos de schema / API  
- [ ] Estados com valores canónicos do código (CHECK / enums)  
- [ ] ≥3 AC P0 testáveis  
- [ ] Secção **Código de referência** com paths concretos  
- [ ] Lacunas conhecidas (doc↔código) listadas se existirem  
- [ ] Campo **Profundidade: L2** e data de revisão no cabeçalho  

### Nível L3 — operacional (opcional)
- [ ] Casos de erro / FX-E0x  
- [ ] State machine Mermaid quando o módulo tem lifecycle crítico  
- [ ] Matriz de roles × acções  
- [ ] Ligação a testes automatizados (`__tests__`, scripts validate)  

**Regra de manutenção:** docs L2/L3 **não** devem ser regenerados às cegas por `generate-modulos-docs.py`. Actualizar o ficheiro (ou o gerador + ficheiro) no mesmo PR da mudança de comportamento.

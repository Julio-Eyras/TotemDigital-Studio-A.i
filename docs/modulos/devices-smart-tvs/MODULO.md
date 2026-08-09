# `devices-smart-tvs` — Smart TVs e players

| Campo | Valor |
|-------|-------|
| **Slug** | `devices-smart-tvs` |
| **Modos** | Lite, Pro |
| **Atores** | admin, operador técnico |
| **UI** | `/smart-tvs, /players` |
| **API** | `/api/smart-tvs, /api/players` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Inventário técnico de Smart TVs e players registados além do fluxo Direct simples.

### Dentro do escopo
- Registo de devices
- Status

### Fora do escopo
- Substitui totems

### Vocabulário
| Termo | Significado |
|-------|-------------|
| smart_tv | display controlado |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-DEV-001 | Ubiquitous | Devices devem normalizar device_id canónico quando aplicável. |

---

## 3. Regras de negócio

### RN-DEV-001 — Canonical ID

```text
RN-DEV-001 — Canonical ID
Quando: lookup por device_id
Se: sempre
Então: comparar forma canónica
Excepto: —
Motivo: Consistência
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Registo --> Pairing --> Monitorizacao
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| online | activo | → offline |

---

## 6. Critérios de aceite

### AC-DEV-001 (P0)

```text
DADO device registado
QUANDO consultar por id em case diferente
ENTÃO encontra o mesmo registo
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`totems`](../totems/MODULO.md)
- [`player-ad`](../player-ad/MODULO.md)

### Referências
- —

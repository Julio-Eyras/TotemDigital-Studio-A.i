# `vinhetas` — Biblioteca de vinhetas

| Campo | Valor |
|-------|-------|
| **Slug** | `vinhetas` |
| **Modos** | Lite, Pro |
| **Atores** | admin, marketing, subscriber |
| **UI** | `/vinhetas` |
| **API** | `/api/media (domínio vinheta)` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Gestão de vinhetas intercaladas na programação, separada da biblioteca geral.

### Dentro do escopo
- Cadastro e uso de vinhetas no mix

### Fora do escopo
- Publicação Direct pura

### Vocabulário
| Termo | Significado |
|-------|-------------|
| vinheta | peça intercalada entre propagandas |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-VIN-001 | Ubiquitous | Vinhetas devem ser distinguíveis de mídias de campanha no motor de fila. |

---

## 3. Regras de negócio

### RN-VIN-001 — Intercalação

```text
RN-VIN-001 — Intercalação
Quando: Gerar fila
Se: há vinhetas e ratio configurado
Então: inserir vinheta conforme fallbackPropagandasPerVinheta / regras
Excepto: —
Motivo: Branding de rede
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Cadastro --> Mix --> FilaTotem
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| activa | pode entrar no mix | → inactiva |

---

## 6. Critérios de aceite

### AC-VIN-001 (P0)

```text
DADO ratio configurado e vinhetas activas
QUANDO gerar dispatch
ENTÃO fila contém vinhetas intercaladas
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`media-library`](../media-library/MODULO.md)
- [`playlist-mix`](../playlist-mix/MODULO.md)
- [`player-ad`](../player-ad/MODULO.md)

### Referências
- —

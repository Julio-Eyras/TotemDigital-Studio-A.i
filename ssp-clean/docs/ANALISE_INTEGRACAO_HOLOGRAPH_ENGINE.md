# Análise da Integração HoloGraph Engine – SmartSignage Pro

**Data:** 2026-01-26  
**Versão:** v2.1

---

## 1. Visão Geral

O **HoloGraph Engine** é um framework de visualização interativa de grafos usado no SmartSignage Pro para a **Rede Visual** – tela que exibe a topologia da rede (publishers, locals, totens, smart TVs, subscribers, mídias, playlists, campanhas e agendamentos).

### 1.1 Modelo de Integração

| Componente | Tecnologia | Função |
|------------|------------|--------|
| **holograph-engine/** | Vue 3 + D3.js | Motor standalone (playground, demo) |
| **frontend/src/** | React + D3.js | Implementação integrada ao SmartSignage |
| **backend** | Node.js/Express | API `GET /api/network/graph` |

**Observação:** O frontend SmartSignage **não importa** o pacote `holograph-engine`. A integração é por **contrato de API** e **compatibilidade de tipos**. O frontend tem sua própria implementação React (`HoloGraphNetwork` + `smartSignageToGraph`) compatível com o formato definido em `holograph-engine/docs/API-SMARTSIGNAGE.md`.

---

## 2. Fluxo de Dados

```
Backend (PostgreSQL)
    │
    ▼ GET /api/network/graph?dayOfWeek=&time=
    │  → publishers, subscribers, scheduleAssignments
    │
Frontend: networkTopologyApi.getGraph()
    │
    ▼ smartSignageToGraph(network, { filterDayOfWeek, filterTime })
    │  → GraphData { nodes, edges }
    │
HoloGraphNetwork (D3 force layout)
    │
    ▼ Renderização SVG interativa
```

---

## 3. Backend

### 3.1 Rotas

| Rota | Método | Descrição | Auth |
|------|--------|-----------|------|
| `/api/network/topology` | GET | Hierarquia para lista (publishers → locals → totems → smart_tvs) | admin, admin_sql, operador_tecnico, operator |
| `/api/network/graph` | GET | Rede no formato SmartSignageNetwork para grafo | admin, admin_sql, operador_tecnico, operator |

### 3.2 Formato `/api/network/graph`

**Query params (opcional):**
- `dayOfWeek` (0–6): filtra scheduleAssignments por dia
- `time` (HH:mm): filtra designações ativas no horário

**Resposta (SmartSignageNetwork):**
```ts
{
  publishers: [{ id, name, locations: [{ id, publisherId, name, totems, smartTvs }] }],
  subscribers: [{ id, name, media, playlists, campaigns }],
  scheduleAssignments: [{ id, sourceId, sourceType: 'campaign', slots: [{ targetId, targetType, dayOfWeek, startTime, endTime }] }]
}
```

**Fonte de dados:**
- publishers: `publishers` + `locals` + `totems` + `smart_tvs`
- subscribers: `subscribers` + `medias` + `playlists` + `campaigns` + `campaign_playlists` + `playlist_items`
- scheduleAssignments: `campaign_totems` (campanha → totem)

### 3.3 Pontos de Atenção

1. **scheduleAssignments** usa apenas `campaign_totems`. Não inclui:
   - `campaign_publishers` (campanha → publisher)
   - `campaign_locals` (campanha → local)
   - `totem_playlists` (playlist por totem)
   - Agendamentos avançados (`advanced_schedules`)

2. **IDs:** Backend converte todos para string (ex: `String(publisher_id)`), conforme contrato.

3. **Resposta padronizada:** Usa `successResponse(payload)` – frontend recebe `{ success: true, data: { publishers, subscribers, scheduleAssignments } }`.

---

## 4. Frontend

### 4.1 Estrutura

```
frontend/src/
├── components/HoloGraphNetwork/
│   └── HoloGraphNetwork.tsx    # Componente D3 (force layout, zoom, export PNG/SVG)
├── lib/holograph/
│   ├── types.ts                # GraphNode, GraphEdge, GraphData, SmartSignageNetwork
│   └── smartSignageToGraph.ts  # Adapter: SmartSignageNetwork → GraphData
└── pages/NetworkTopology/
    └── NetworkTopology.tsx     # Tela com Lista + Grafo (viewMode)
```

### 4.2 Dependências

- **d3** (^7.8.5): layout por forças, zoom, SVG
- **MUI**: layout, controles, chips

### 4.3 HoloGraphNetwork

- **Props:** `network?`, `dayOfWeek?`, `time?`, `width?`, `height?`, `onNodeClick?`, `exportFilename?`
- Se `network` não informado, busca via `networkTopologyApi.getGraph({ dayOfWeek, time })`
- Converte `network` → `GraphData` via `smartSignageToGraph`
- Renderiza nós (círculos coloridos por tipo) e arestas (linhas)
- Interação: clique (onNodeClick), zoom/pan, exportar PNG/SVG, redefinir zoom

### 4.4 smartSignageToGraph

- **Entrada:** SmartSignageNetwork
- **Saída:** GraphData { nodes, edges }
- **Opções:** `includeScheduleEdges`, `filterDayOfWeek`, `filterTime`
- Cria nós para: publisher, location, totem, smarttv, subscriber, media, playlist, campaign
- Cria arestas: hierarquia (has-location, has-totem, has-media, etc.) + schedule (campaign/totem por dia/horário)

---

## 5. holograph-engine (standalone)

### 5.1 Estrutura

```
holograph-engine/
├── src/
│   ├── vue/HoloGraphView.vue   # Componente Vue (não usado pelo React)
│   ├── smartsignage/
│   │   ├── SmartSignageAdapter.ts  # smartSignageToGraph (TypeScript)
│   │   └── types.ts
│   ├── types/index.ts
│   ├── plugins/
│   ├── utils/
│   └── workers/
├── playground/                 # Demo Vue
├── docs/API-SMARTSIGNAGE.md    # Contrato da API
├── package.json                # Vue 3, D3, graphlib-dot
└── vite.config.ts
```

### 5.2 Relação com o Frontend

- **holograph-engine** é um **projeto separado** (Vue) que pode ser usado standalone (playground).
- O frontend SmartSignage tem **implementação própria** em React, compatível com o **contrato** definido em `holograph-engine/docs/API-SMARTSIGNAGE.md`.
- Não há dependência `package.json` do frontend em `holograph-engine`.
- O adapter `frontend/src/lib/holograph/smartSignageToGraph.ts` é uma **réplica funcional** do `holograph-engine/src/smartsignage/SmartSignageAdapter.ts`, adaptada para React/TypeScript do SmartSignage.

---

## 6. Pontos Fortes

1. **Contrato bem definido:** API documentada em `holograph-engine/docs/API-SMARTSIGNAGE.md`
2. **Desacoplamento:** Backend expõe formato neutro; frontend adapta para grafo
3. **Duas vistas:** Lista (accordion) e Grafo (D3) na mesma tela
4. **Filtros:** Dia da semana e horário aplicados no backend e no adapter
5. **Exportação:** PNG e SVG do grafo
6. **Tipos:** `frontend/src/lib/holograph/types.ts` alinhado ao contrato

---

## 7. Pontos de Melhoria

### 7.1 Duplicação de Código ✅ Mitigado

- **Adapter:** `smartSignageToGraph` existe em:
  - `holograph-engine/src/smartsignage/SmartSignageAdapter.ts` (playground Vue)
  - `frontend/src/lib/holograph/smartSignageToGraph.ts` (**implementação de referência**)
- **Ação:** Documentado em `holograph-engine/README.md` e `docs/API-SMARTSIGNAGE.md` que o frontend React é a fonte única de verdade; holograph-engine serve como referência/playground.

### 7.2 scheduleAssignments Incompleto ✅ Resolvido

- **Antes:** Só `campaign_totems`.
- **Agora:** Backend inclui `campaign_totems` (totem), `campaign_publishers` (publisher), `campaign_locals` (location). Contrato com `targetType: 'publisher' | 'location' | 'totem' | 'smarttv'`.

### 7.3 Tratamento de Resposta da API

- `networkTopologyApi.getGraph()` retorna `response.data` (body JSON).
- Backend usa `successResponse(payload)` → retorna `{ success: true, data: payload }`.
- O componente faz `setNetwork(res.data)` onde `res` = retorno de `getGraph` = `{ success: true, data: payload }`.
- Logo `res.data` = payload (SmartSignageNetwork) – **correto**.

### 7.4 Tipos `any`

- `HoloGraphNetworkProps.network?: any` – poderia ser `SmartSignageNetwork`
- Uso de `any` em vários pontos do HoloGraphNetwork

---

## 8. Checklist de Verificação

| Item | Status |
|------|--------|
| Backend `/api/network/graph` implementado | ✅ |
| Backend usa `successResponse` | ✅ |
| Frontend chama API corretamente | ✅ |
| Adapter `smartSignageToGraph` funcional | ✅ |
| Tipos alinhados ao contrato | ✅ |
| Filtros dia/horário aplicados | ✅ |
| Export PNG/SVG | ✅ |
| holograph-engine como pacote npm | ❌ (não utilizado no frontend) |
| scheduleAssignments completo | ⚠️ Parcial (só campaign_totems) |

---

## 9. Conclusão

A integração HoloGraph Engine no SmartSignage Pro está **funcional** e bem estruturada. O backend expõe o formato esperado, o frontend possui componente React próprio compatível com o contrato, e a experiência de uso (lista + grafo, filtros, exportação) atende ao desenho da Rede Visual.

Principais ações recomendadas:
1. Revisar normalização de `getGraph` / `setNetwork` para garantir que o payload seja sempre o objeto correto.
2. Avaliar publicação do holograph-engine como pacote ou consolidação em uma única implementação.
3. Ampliar `scheduleAssignments` para incluir outras fontes de agendamento, se necessário.

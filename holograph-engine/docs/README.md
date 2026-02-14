# Documentação HoloGraph Engine

## Visão geral

O **HoloGraph Engine** é uma framework de interface gráfica interativa para visualização de grafos, criada conforme o design definido no script `install-holograph-enterprise.sh` (conversa ChatGPT).

## Estrutura do projeto

```
src/
  core/       GraphEngine, EventBus
  layout/     ForceLayout (D3)
  render/     SvgRenderer
  effects/    GlowEffect
  er/         ERAdapter (schema DB → grafo)
  plugins/    Sistema de plugins
  workers/    Web Workers (layout assíncrono)
  themes/     defaultTheme
  vue/        HoloGraphView.vue (componente para dashboard)
  utils/      Helpers
  types/      GraphNode, GraphEdge, GraphData
  smartsignage/  Tipos + SmartSignageAdapter (rede publishers/subscribers)
playground/   Demo com Vue
docs/         Documentação
```

## Integração SmartSignage

O adapter `smartSignageToGraph` converte a rede SmartSignage em grafo para exibição no dashboard:

- **Publishers** → nós `publisher` → `location` → `totem` | `smarttv`
- **Subscribers** → nós `subscriber` → `media`, `playlist`, `campaign`
- **Agendamentos** → arestas `scheduled` entre playlist/campaign e local/totem/smart TV (por horário e dia)

Uso no dashboard:

```ts
import { smartSignageToGraph, createDemoNetwork } from 'holograph-engine'
import HoloGraphView from 'holograph-engine/vue/HoloGraphView.vue'

const network = createDemoNetwork() // ou dados da API SmartSignage
const graph = smartSignageToGraph(network, {
  includeScheduleEdges: true,
  filterDayOfWeek: 1,   // opcional: só segunda
  filterTime: '12:00'   // opcional: só ativos neste horário
})
```

No template:

```vue
<HoloGraphView :graph="graph" @node-click="onNodeClick" />
```

## Próximos passos

- Conectar à API real do SmartSignage (publishers, subscribers, schedules).
- Filtros no dashboard: por publisher, por dia da semana, por horário.
- Legenda por tipo de nó (publisher, location, totem, smarttv, playlist, campaign, media).
- Tooltip com detalhes do nó e agendamentos.

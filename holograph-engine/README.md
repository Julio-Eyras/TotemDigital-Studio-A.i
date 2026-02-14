# HoloGraph Engine

Framework de **interface gráfica interativa** para visualização de grafos. Projeto criado conforme o design da conversa (script `install-holograph-enterprise.sh`).

## Estrutura (conforme conversa)

```
src/
  core/         GraphEngine, EventBus
  layout/       ForceLayout (D3)
  render/       SvgRenderer
  effects/      GlowEffect
  er/           ERAdapter (schema DB → grafo)
  plugins/      Sistema de plugins
  workers/      Web Workers (layout assíncrono)
  themes/       defaultTheme
  vue/          HoloGraphView.vue (componente para dashboard)
  utils/        Helpers
  types/        GraphNode, GraphEdge, GraphData
  smartsignage/ Tipos + SmartSignageAdapter (rede publishers/subscribers)
playground/     Demo com Vue
docs/           Documentação
```

## Features

- D3 force layout
- SVG glow renderer
- ER database mode
- Modular architecture
- Theme system
- Plugin-ready
- **Integração SmartSignage**: rede de publishers (locais, totens, smart TVs), subscribers (mídias, playlists, campanhas), agendamentos por horário e dia
- Componente Vue `HoloGraphView` para uso no dashboard

## Uso rápido

Dentro do repositório **SmartSignage-Pro** (este diretório é `SmartSignage-Pro/holograph-engine`):

```bash
cd holograph-engine
npm install
npm run dev           # playground em http://localhost:5173
npm run dev:playground  # idem, abrindo o browser
npm run build         # lib em dist/
```

## Integração com SmartSignage (dashboard)

O **dashboard SmartSignage (frontend React)** não importa este pacote: usa implementação própria em `frontend/src/lib/holograph/` (adapter `smartSignageToGraph` + componente `HoloGraphNetwork`) como **fonte única de verdade**. Este repositório (`holograph-engine`) serve como referência de contrato e playground Vue.

No dashboard React, use o adapter para transformar a rede em grafo e o componente React para exibir:

- **Publishers** e seus nós: locais → totens, smart TVs
- **Subscribers** e seus nós: mídias, playlists, campanhas
- **Designações**: playlists/campanhas → local/totem/smart TV por horário e dia da semana

Ver `docs/README.md` para detalhes da API e exemplos.

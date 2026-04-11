# Rede Visual (HoloGraph)

A **Rede Visual** é a tela de visualização em grafo da rede SmartSignage: publicadores, assinantes, locais, totens, smart TVs, mídias, playlists, campanhas e **designações** (onde cada playlist/campanha está agendada para qual local, totem ou smart TV, por dia e horário).

## Onde acessar

- **Menu Exibidores** → Rede Visual  
- **Menu Assinantes** → Rede Visual (abre direto no grafo)  
- **Menu Operador Técnico** → Rede Visual  
- **Usuário Anunciante (subscriber)** → Anunciantes → Rede Visual  

Rota: `/network-topology` (com opção `?view=graph` para abrir já no grafo).

## O que a tela oferece

### Vista Lista
- Hierarquia em accordion: Publicadores → Locais → Totens → Smart TVs, com status e quantidade de mídias.

### Vista Grafo
- **Nós** por tipo: Publicador, Local, Totem, Smart TV, Anunciante, Mídia, Playlist, Campanha (cores e legenda).
- **Arestas**: hierarquia (ex.: publicador → local → totem) e **agendamentos** (playlist/campanha → local/totem/smart TV), em destaque quando há filtro de dia/horário.
- **Filtros**: Dia da semana (Todos / Domingo … Sábado) e Horário (Qualquer / 00:00 … 23:00). Os filtros ficam na URL (`?view=graph&day=1&time=14:00`) para compartilhar ou atualizar.
- **Interação**: clique no nó (detalhes + breadcrumb), duplo clique (centralizar e zoom), arrastar nó, zoom/pan no grafo.
- **Contador**: número de nós, conexões e agendamentos no canto superior esquerdo.
- **Exportar**: PNG e SVG do grafo atual.
- **Redefinir vista**: volta zoom/pan ao estado inicial.
- **Atualizar**: recarrega topologia (lista) e dados do grafo.

## API

- **GET /api/network/topology** – topologia para a lista (publishers → locals → totens → smart_tvs).  
- **GET /api/network/graph** – rede no formato HoloGraph (publishers, subscribers, scheduleAssignments).  
  - Query opcional: `dayOfWeek` (0–6), `time` (HH:mm) para filtrar designações.

Ver contrato em `holograph-engine/docs/API-SMARTSIGNAGE.md`.

## Tecnologia

- **holograph-engine**: motor de grafo (D3, layout por forças, tema).  
- **Frontend**: componente React `HoloGraphNetwork` + adapter `smartSignageToGraph` (tipos em `frontend/src/lib/holograph/`).  
- **Backend**: rota `/api/network/graph` monta publishers, subscribers e scheduleAssignments a partir do banco (incluindo `campaign_totems`).

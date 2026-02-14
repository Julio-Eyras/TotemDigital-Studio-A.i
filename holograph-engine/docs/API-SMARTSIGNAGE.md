# API SmartSignage para HoloGraph Engine

Contrato da API que o backend SmartSignage deve expor para alimentar o grafo (dashboard de rede).

## Endpoint

```
GET /api/network/graph
```

**Query (opcional):**

| Parâmetro        | Tipo   | Descrição                                      |
|------------------|--------|------------------------------------------------|
| `dayOfWeek`      | number | 0–6 (domingo=0). Filtra designações por dia.  |
| `time`           | string | "HH:mm". Filtra designações ativas nesse horário. |

**Headers:** `Authorization: Bearer <token>`

**Resposta (200):** JSON no formato `SmartSignageNetwork`:

```ts
{
  publishers: [
    {
      id: string,           // ex: "1"
      name: string,
      locations: [
        {
          id: string,
          publisherId: string,
          name: string,
          address?: string,
          totems: [
            { id: string, locationId: string, name: string }
          ],
          smartTvs: [
            { id: string, locationId: string, name: string }
          ]
        }
      ]
    }
  ],
  subscribers: [
    {
      id: string,
      name: string,
      media: [
        { id: string, subscriberId: string, name: string, type?: string, url?: string }
      ],
      playlists: [
        { id: string, subscriberId: string, name: string, mediaIds?: string[] }
      ],
      campaigns: [
        { id: string, subscriberId: string, name: string, playlistIds?: string[] }
      ]
    }
  ],
  scheduleAssignments: [
    {
      id: string,
      sourceId: string,      // id da playlist ou da campanha
      sourceType: "playlist" | "campaign",
      slots: [
        {
          targetId: string,   // id do local, totem ou smart_tv
          targetType: "location" | "totem" | "smarttv",
          dayOfWeek?: number[],
          startTime?: string,
          endTime?: string
        }
      ]
    }
  ]
}
```

## Uso no frontend

```ts
import { smartSignageToGraph } from 'holograph-engine'

const res = await api.get('/api/network/graph', {
  params: { dayOfWeek: 1, time: '14:00' }
})
const network = res.data
const graph = smartSignageToGraph(network, {
  includeScheduleEdges: true,
  filterDayOfWeek: 1,
  filterTime: '14:00'
})
```

## Mapeamento backend → contrato

- **IDs:** usar string (ex: `String(publisher_id)`).
- **Publishers:** já existente em `GET /api/network/topology`; adaptar para incluir `smartTvs` por local (ou por totem, conforme seu modelo).
- **Subscribers:** entidades que têm campanhas/playlists (ex: tabela `subscribers` ou `clients`).
- **scheduleAssignments:** derivar de `campaign_totems`, `totem_playlists`, agendamentos avançados etc., convertendo para `sourceId`, `sourceType`, `slots[]` com `targetId`, `targetType`, `dayOfWeek`, `startTime`, `endTime`.

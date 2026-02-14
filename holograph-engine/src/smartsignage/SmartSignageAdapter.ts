/**
 * Adapter SmartSignage: re-exporta do módulo compartilhado e adiciona createDemoNetwork.
 * Fonte única da lógica: shared/holograph-adapter
 */
export {
  smartSignageToGraph,
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
} from '../../../shared/holograph-adapter'
export type { AdapterOptions } from '../../../shared/holograph-adapter'
export type { SmartSignageNetwork } from '../../../shared/holograph-adapter'

import type { SmartSignageNetwork } from '../../../shared/holograph-adapter'

/** Rede de demonstração para o playground. */
export function createDemoNetwork(): SmartSignageNetwork {
  return {
    publishers: [
      {
        id: 'pub-1',
        name: 'Publisher Centro',
        locations: [
          {
            id: 'loc-1',
            publisherId: 'pub-1',
            name: 'Shopping Centro',
            address: 'Av. Central, 100',
            totems: [
              { id: 'totem-1', locationId: 'loc-1', name: 'Totem Entrada A' },
              { id: 'totem-2', locationId: 'loc-1', name: 'Totem Entrada B' }
            ],
            smartTvs: [{ id: 'tv-1', locationId: 'loc-1', name: 'TV Praça de Alimentação' }]
          }
        ]
      },
      {
        id: 'pub-2',
        name: 'Publisher Norte',
        locations: [
          {
            id: 'loc-2',
            publisherId: 'pub-2',
            name: 'Aeroporto Norte',
            totems: [{ id: 'totem-3', locationId: 'loc-2', name: 'Totem Embarque' }],
            smartTvs: []
          }
        ]
      }
    ],
    subscribers: [
      {
        id: 'sub-1',
        name: 'Subscriber Mídia Plus',
        media: [
          { id: 'mid-1', subscriberId: 'sub-1', name: 'Vídeo Promo A', type: 'video' },
          { id: 'mid-2', subscriberId: 'sub-1', name: 'Banner Verão', type: 'image' }
        ],
        playlists: [
          { id: 'pl-1', subscriberId: 'sub-1', name: 'Playlist Verão', mediaIds: ['mid-1', 'mid-2'] }
        ],
        campaigns: [
          { id: 'camp-1', subscriberId: 'sub-1', name: 'Campanha Verão 2025', playlistIds: ['pl-1'] }
        ]
      }
    ],
    scheduleAssignments: [
      {
        id: 'sched-1',
        sourceId: 'pl-1',
        sourceType: 'playlist',
        slots: [
          {
            targetId: 'totem-1',
            targetType: 'totem',
            dayOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '20:00'
          },
          {
            targetId: 'tv-1',
            targetType: 'smarttv',
            dayOfWeek: [0, 6],
            startTime: '10:00',
            endTime: '22:00'
          }
        ]
      },
      {
        id: 'sched-2',
        sourceId: 'camp-1',
        sourceType: 'campaign',
        slots: [
          {
            targetId: 'loc-1',
            targetType: 'location',
            dayOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: '00:00',
            endTime: '23:59'
          }
        ]
      }
    ]
  }
}

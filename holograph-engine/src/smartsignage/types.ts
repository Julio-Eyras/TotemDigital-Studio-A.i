/**
 * Modelo de domínio SmartSignage para holograph-engine.
 * Publishers: locais, totens, smart TVs, mídias, playlists, campanhas.
 * Subscribers: mídias, playlists, campanhas.
 * Agendamentos: playlists/campanhas → publisher (local/totem/smart TV) por horário e dia.
 */

export type PublisherNodeType = 'publisher' | 'location' | 'totem' | 'smarttv'
export type SubscriberNodeType = 'subscriber' | 'media' | 'playlist' | 'campaign'

export interface Publisher {
  id: string
  name: string
  locations?: Location[]
  meta?: Record<string, unknown>
}

export interface Location {
  id: string
  publisherId: string
  name: string
  address?: string
  totems?: Totem[]
  smartTvs?: SmartTV[]
  meta?: Record<string, unknown>
}

export interface Totem {
  id: string
  locationId: string
  name: string
  meta?: Record<string, unknown>
}

export interface SmartTV {
  id: string
  locationId: string
  name: string
  meta?: Record<string, unknown>
}

export interface Subscriber {
  id: string
  name: string
  media?: Media[]
  playlists?: Playlist[]
  campaigns?: Campaign[]
  meta?: Record<string, unknown>
}

export interface Media {
  id: string
  subscriberId: string
  name: string
  type?: string
  url?: string
  meta?: Record<string, unknown>
}

export interface Playlist {
  id: string
  subscriberId: string
  name: string
  mediaIds?: string[]
  meta?: Record<string, unknown>
}

export interface Campaign {
  id: string
  subscriberId: string
  name: string
  playlistIds?: string[]
  meta?: Record<string, unknown>
}

export type ScheduleTargetType = 'location' | 'totem' | 'smarttv'

export interface ScheduleSlot {
  targetId: string
  targetType: ScheduleTargetType
  dayOfWeek?: number[]
  startTime?: string
  endTime?: string
  startDate?: string
  endDate?: string
}

export interface ScheduleAssignment {
  id: string
  sourceId: string
  sourceType: 'playlist' | 'campaign'
  slots: ScheduleSlot[]
  meta?: Record<string, unknown>
}

export interface SmartSignageNetwork {
  publishers: Publisher[]
  subscribers: Subscriber[]
  scheduleAssignments: ScheduleAssignment[]
}

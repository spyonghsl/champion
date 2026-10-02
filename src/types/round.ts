import type { ChampionId } from './champion'

export type RoundStatus = 'registration' | 'countdown' | 'voting' | 'closed' | 'result'

export interface Round {
  roundNumber: number
  isDemo: boolean
  status: RoundStatus
  startedAt: number | null
  endsAt: number | null
  eliminatedChampion: ChampionId | null
}

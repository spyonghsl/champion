import type { ChampionId } from './champion'

export interface Submission {
  uid: string
  championId: ChampionId
  submittedAt: number | null
}

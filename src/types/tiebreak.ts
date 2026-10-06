import type { ChampionId, ChampionVoteTotals } from './champion'
import type { Submission } from './submission'

export type TiebreakStatus = 'idle' | 'countdown' | 'voting' | 'closed' | 'result'

export interface Tiebreak {
    status: TiebreakStatus
    participantUids: string[]
    startedAt: number | null
    endsAt: number | null
    eliminatedChampion: ChampionId | null
    voteTotals: ChampionVoteTotals
}

export type TiebreakSubmission = Submission

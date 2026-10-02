import type { ChampionId } from './champion'

export interface RoundScore {
    championId: ChampionId | null
    score: number
    submittedAt: number | null
    elapsedMs: number | null
}

export interface ParticipantScore {
    total: number
    rounds: Record<string, RoundScore>
}

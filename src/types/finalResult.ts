export type FinalResultStatus = 'pending' | 'tiebreak_required' | 'finalized'

export interface FinalTopFiveEntry {
    uid: string
    nickname: string
    selfieUrl: string | null
    totalScore: number
    cumulativeResponseMs: number
    finalRank: number
}

export interface FinalResult {
    status: FinalResultStatus
    generatedAt: number | null
    topFive: FinalTopFiveEntry[]
    tiedUids: string[] | null
    randomDrawUsed: boolean
}

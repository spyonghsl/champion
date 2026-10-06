export interface LeaderboardEntry {
    uid: string
    nickname: string
    selfieUrl: string | null
    totalScore: number
    cumulativeResponseMs: number
    rank: number
}

export interface Leaderboard {
    roundNumber: number
    generatedAt: number | null
    entries: LeaderboardEntry[]
}

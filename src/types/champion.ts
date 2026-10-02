export type ChampionId =
    | 'heracles'
    | 'achilles'
    | 'perseus'
    | 'theseus'

export interface Champion {
    id: ChampionId
    displayName: string
}

export type ChampionVoteTotals = Record<ChampionId, number>

export const CHAMPIONS: Champion[] = [
    {
        id: 'heracles',
        displayName: 'Heracles',
    },
    {
        id: 'achilles',
        displayName: 'Achilles',
    },
    {
        id: 'perseus',
        displayName: 'Perseus',
    },
    {
        id: 'theseus',
        displayName: 'Theseus',
    },
]

export const EMPTY_CHAMPION_VOTE_TOTALS: ChampionVoteTotals = {
    heracles: 0,
    achilles: 0,
    perseus: 0,
    theseus: 0,
}

export function isChampionId(value: unknown): value is ChampionId {
    return (
        value === 'heracles' ||
        value === 'achilles' ||
        value === 'perseus' ||
        value === 'theseus'
    )
}

export const championMap: Record<ChampionId, Champion> =
    Object.fromEntries(
        CHAMPIONS.map((champion) => [champion.id, champion]),
    ) as Record<ChampionId, Champion>
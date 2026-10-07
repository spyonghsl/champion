export type ChampionId =
    | 'heracles'
    | 'achilles'
    | 'perseus'
    | 'theseus'

export interface Champion {
    id: ChampionId
    displayName: string
    image: string
}

import heraclesImage from '../assets/champions/heracles.jpg'
import achillesImage from '../assets/champions/achilles.jpg'
import perseusImage from '../assets/champions/perseus.jpg'
import theseusImage from '../assets/champions/theseus.jpg'

export type ChampionVoteTotals = Record<ChampionId, number>

export const CHAMPIONS: Champion[] = [
    {
        id: 'heracles',
        displayName: 'Heracles',
        image: heraclesImage,

    },
    {
        id: 'achilles',
        displayName: 'Achilles',
        image: achillesImage,
    },
    {
        id: 'perseus',
        displayName: 'Perseus',
        image: perseusImage,
    },
    {
        id: 'theseus',
        displayName: 'Theseus',
        image: theseusImage,
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
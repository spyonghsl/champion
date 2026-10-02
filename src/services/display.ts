import { onValue, ref } from 'firebase/database'
import type { Unsubscribe } from 'firebase/database'

import { db } from '../firebase/config'
import {
    EMPTY_CHAMPION_VOTE_TOTALS,
    isChampionId,
    type ChampionVoteTotals,
} from '../types/champion'
import type { Round } from '../types/round'
import { GAME_ID, parseRound } from './game'

export function subscribeToRegisteredCount(callback: (count: number) => void): Unsubscribe {
    return onValue(ref(db, `games/${GAME_ID}/live/registeredCount`), (snapshot) => {
        const value: unknown = snapshot.val()
        callback(typeof value === 'number' ? value : 0)
    })
}

function parseCurrentRoundVotes(value: unknown): ChampionVoteTotals {
    if (!value || typeof value !== 'object') {
        return { ...EMPTY_CHAMPION_VOTE_TOTALS }
    }

    const raw = value as Record<string, unknown>
    const totals: ChampionVoteTotals = { ...EMPTY_CHAMPION_VOTE_TOTALS }

    for (const [key, rawCount] of Object.entries(raw)) {
        if (!isChampionId(key)) {
            continue
        }

        totals[key] = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : 0
    }

    return totals
}

export function subscribeToCurrentRoundForDisplay(callback: (round: Round | null) => void): Unsubscribe {
    return onValue(ref(db, `games/${GAME_ID}/currentRound`), (snapshot) => {
        callback(parseRound(snapshot.val()))
    })
}

export function subscribeToCurrentRoundVotes(
    callback: (voteTotals: ChampionVoteTotals) => void,
): Unsubscribe {
    return onValue(ref(db, `games/${GAME_ID}/live/currentRoundVotes`), (snapshot) => {
        callback(parseCurrentRoundVotes(snapshot.val()))
    })
}

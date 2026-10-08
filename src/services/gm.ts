import { httpsCallable } from 'firebase/functions'

import { functions } from '../firebase/config'
import type { ChampionId } from '../types/champion'
import { GAME_ID } from './game'

interface CallableResult {
    ok: boolean
}

interface FinalizeRoundResult extends CallableResult {
    eliminatedChampion: ChampionId
}

interface StartNextRoundResult extends CallableResult {
    roundNumber: number
}

interface BuildLeaderboardResult extends CallableResult {
    roundNumber: number
    entryCount: number
}

interface FinalResultActionResult extends CallableResult {
    status: 'tiebreak_required' | 'finalized'
}

function extractCallableCode(error: unknown): string {
    const code =
        typeof error === 'object' && error && 'code' in error
            ? String((error as { code: unknown }).code)
            : ''

    return code.startsWith('functions/')
        ? code.replace('functions/', '')
        : code
}

export async function startDemoRound(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, CallableResult>(
        functions,
        'startDemoRound',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to start a round.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'already-exists') {
            throw new Error('A round is already active.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('The demo round could not be started right now.', { cause: error })
        }

        throw new Error('Failed to start the demo round.', { cause: error })
    }
}

export async function closeVoting(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, CallableResult>(
        functions,
        'closeVoting',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to close voting.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Voting is not currently open.', { cause: error })
        }

        throw new Error('Failed to close voting.', { cause: error })
    }
}

export async function finalizeRound(): Promise<ChampionId> {
    const callable = httpsCallable<{ gameId: string }, FinalizeRoundResult>(
        functions,
        'finalizeRound',
    )

    try {
        const response = await callable({ gameId: GAME_ID })
        return response.data.eliminatedChampion
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to finalize the round.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('This round cannot be finalized right now.', { cause: error })
        }

        throw new Error('Failed to finalize the round.', { cause: error })
    }
}

export async function startNextRound(): Promise<number> {
    const callable = httpsCallable<{ gameId: string }, StartNextRoundResult>(
        functions,
        'startNextRound',
    )

    try {
        const response = await callable({ gameId: GAME_ID })
        return response.data.roundNumber
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to start the next round.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('The next round cannot be started right now.', { cause: error })
        }

        throw new Error('Failed to start the next round.', { cause: error })
    }
}

export async function buildLeaderboard(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, BuildLeaderboardResult>(
        functions,
        'buildLeaderboard',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to build the leaderboard.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Leaderboard cannot be built in this round state.', { cause: error })
        }

        throw new Error('Failed to build leaderboard.', { cause: error })
    }
}

export async function prepareFinalResult(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, FinalResultActionResult>(
        functions,
        'prepareFinalResult',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to prepare final result.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Final result cannot be prepared yet.', { cause: error })
        }

        throw new Error('Failed to prepare final result.', { cause: error })
    }
}

export async function startTiebreak(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, CallableResult>(
        functions,
        'startTiebreak',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to start tiebreak.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Tiebreak cannot be started right now.', { cause: error })
        }

        throw new Error('Failed to start tiebreak.', { cause: error })
    }
}

export async function closeTiebreakVoting(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, CallableResult>(
        functions,
        'closeTiebreakVoting',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to close tiebreak voting.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Tiebreak voting is not currently open.', { cause: error })
        }

        throw new Error('Failed to close tiebreak voting.', { cause: error })
    }
}

export async function finalizeTiebreak(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, FinalResultActionResult>(
        functions,
        'finalizeTiebreak',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to finalize tiebreak.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Tiebreak cannot be finalized right now.', { cause: error })
        }

        throw new Error('Failed to finalize tiebreak.', { cause: error })
    }
}

export async function resetGame(): Promise<void> {
    const callable = httpsCallable<{ gameId: string }, CallableResult>(
        functions,
        'resetGame',
    )

    try {
        await callable({ gameId: GAME_ID })
    } catch (error: unknown) {
        const code = extractCallableCode(error)

        if (code === 'unauthenticated') {
            throw new Error('You must be signed in to reset the game.', { cause: error })
        }
        if (code === 'permission-denied') {
            throw new Error('You are not authorized as a Game Master.', { cause: error })
        }
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }

        throw new Error('Failed to reset game.', { cause: error })
    }
}

import { httpsCallable } from 'firebase/functions'

import { functions } from '../firebase/config'
import { GAME_ID } from './game'

interface CallableResult {
    ok: boolean
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
        if (code === 'invalid-argument') {
            throw new Error('The game id was invalid.', { cause: error })
        }
        if (code === 'failed-precondition') {
            throw new Error('Voting is not currently open.', { cause: error })
        }

        throw new Error('Failed to close voting.', { cause: error })
    }
}

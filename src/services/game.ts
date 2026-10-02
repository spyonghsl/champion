import { get, onValue, ref } from 'firebase/database'
import type { Unsubscribe } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../firebase/config'
import { isChampionId, type ChampionId } from '../types/champion'
import type { Round, RoundStatus } from '../types/round'
import type { Submission } from '../types/submission'

export const GAME_ID = 'game001'

const VALID_ROUND_STATUSES: RoundStatus[] = ['registration', 'countdown', 'voting', 'closed', 'result']

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

export function parseRound(value: unknown): Round | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const roundNumber = Number(raw.roundNumber)

  if (!Number.isFinite(roundNumber)) {
    return null
  }

  const status = typeof raw.status === 'string' ? raw.status : null
  if (!status || !VALID_ROUND_STATUSES.includes(status as RoundStatus)) {
    return null
  }

  const eliminatedChampion =
    typeof raw.eliminatedChampion === 'string' && isChampionId(raw.eliminatedChampion)
      ? raw.eliminatedChampion
      : null

  return {
    roundNumber,
    isDemo: Boolean(raw.isDemo),
    status: status as RoundStatus,
    startedAt: parseOptionalNumber(raw.startedAt),
    endsAt: parseOptionalNumber(raw.endsAt),
    eliminatedChampion,
  }
}

export function normalizeSubmission(value: unknown, fallbackUid: string): Submission | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const championId = raw.championId
  const uid = typeof raw.uid === 'string' ? raw.uid : fallbackUid

  if (!isChampionId(championId) || !uid) {
    return null
  }

  return {
    uid,
    championId,
    submittedAt: parseOptionalNumber(raw.submittedAt),
  }
}

export function subscribeToCurrentRound(callback: (round: Round | null) => void): Unsubscribe {
  return onValue(ref(db, `games/${GAME_ID}/currentRound`), (snapshot) => {
    callback(parseRound(snapshot.val()))
  })
}

export function subscribeToRoundSubmission(
  uid: string,
  roundNumber: number | null,
  callback: (submission: Submission | null) => void,
): Unsubscribe {
  if (roundNumber === null) {
    callback(null)
    return () => undefined
  }

  const path = ref(db, `games/${GAME_ID}/submissions/${roundNumber}/${uid}`)

  return onValue(path, (snapshot) => {
    callback(normalizeSubmission(snapshot.val(), uid))
  })
}

export async function getCurrentRoundSubmission(uid: string, roundNumber: number): Promise<Submission | null> {
  const snapshot = await get(ref(db, `games/${GAME_ID}/submissions/${roundNumber}/${uid}`))
  return normalizeSubmission(snapshot.val(), uid)
}

export async function submitChampionChoice(championId: ChampionId): Promise<void> {
  const callable = httpsCallable<
    { gameId: string; championId: ChampionId },
    { ok: boolean }
  >(functions, 'submitChampionChoice')

  try {
    await callable({
      gameId: GAME_ID,
      championId,
    })
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code: unknown }).code)
        : ''

    const normalizedCode = code.startsWith('functions/')
      ? code.replace('functions/', '')
      : code

    if (normalizedCode === 'unauthenticated') {
      throw new Error('You must be signed in to submit a champion.', { cause: error })
    }
    if (normalizedCode === 'invalid-argument') {
      throw new Error('Your champion selection was invalid.', { cause: error })
    }
    if (normalizedCode === 'already-exists') {
      throw new Error('You already submitted a champion for this round.', { cause: error })
    }
    if (normalizedCode === 'failed-precondition') {
      throw new Error('Submissions are not available right now.', { cause: error })
    }

    throw new Error('Your selection could not be submitted.', { cause: error })
  }
}

import { get, onValue, ref } from 'firebase/database'
import type { Unsubscribe } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../firebase/config'
import type { Leaderboard, LeaderboardEntry } from '../types/leaderboard'
import { isChampionId, type ChampionId } from '../types/champion'
import type { Round, RoundStatus } from '../types/round'
import type { ParticipantScore, RoundScore } from '../types/score'
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

function normalizeRoundScore(value: unknown): RoundScore | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const championId = isChampionId(raw.championId) ? raw.championId : null
  const score = Number(raw.score)

  return {
    championId,
    score: Number.isFinite(score) ? score : 0,
    submittedAt: parseOptionalNumber(raw.submittedAt),
    elapsedMs: parseOptionalNumber(raw.elapsedMs),
  }
}

function normalizeParticipantScore(value: unknown): ParticipantScore {
  if (!value || typeof value !== 'object') {
    return {
      total: 0,
      rounds: {},
    }
  }

  const raw = value as Record<string, unknown>
  const total = Number(raw.total)
  const rounds: ParticipantScore['rounds'] = {}

  if (raw.rounds && typeof raw.rounds === 'object') {
    for (const [roundKey, roundValue] of Object.entries(raw.rounds as Record<string, unknown>)) {
      const normalizedRoundScore = normalizeRoundScore(roundValue)
      if (normalizedRoundScore) {
        rounds[roundKey] = normalizedRoundScore
      }
    }
  }

  return {
    total: Number.isFinite(total) ? total : 0,
    rounds,
  }
}

function normalizeLeaderboardEntry(value: unknown): LeaderboardEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const uid = typeof raw.uid === 'string' ? raw.uid : ''
  const nickname = typeof raw.nickname === 'string' ? raw.nickname : ''
  const selfieUrl = typeof raw.selfieUrl === 'string' && raw.selfieUrl.trim() ? raw.selfieUrl : null
  const totalScore = Number(raw.totalScore)
  const cumulativeResponseMs = Number(raw.cumulativeResponseMs)
  const rank = Number(raw.rank)

  if (!uid || !nickname || !Number.isFinite(rank)) {
    return null
  }

  return {
    uid,
    nickname,
    selfieUrl,
    totalScore: Number.isFinite(totalScore) ? totalScore : 0,
    cumulativeResponseMs: Number.isFinite(cumulativeResponseMs) ? cumulativeResponseMs : 0,
    rank,
  }
}

function normalizeLeaderboard(value: unknown): Leaderboard | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const roundNumber = Number(raw.roundNumber)
  if (!Number.isFinite(roundNumber)) {
    return null
  }

  const normalizedEntries: LeaderboardEntry[] = []
  const rawEntries = raw.entries

  if (rawEntries && typeof rawEntries === 'object') {
    for (const entryValue of Object.values(rawEntries as Record<string, unknown>)) {
      const normalizedEntry = normalizeLeaderboardEntry(entryValue)
      if (normalizedEntry) {
        normalizedEntries.push(normalizedEntry)
      }
    }
  }

  normalizedEntries.sort((leftEntry, rightEntry) => {
    if (leftEntry.rank !== rightEntry.rank) {
      return leftEntry.rank - rightEntry.rank
    }

    return leftEntry.uid.localeCompare(rightEntry.uid)
  })

  return {
    roundNumber,
    generatedAt: parseOptionalNumber(raw.generatedAt),
    entries: normalizedEntries,
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

export function subscribeToParticipantScore(
  uid: string,
  callback: (score: ParticipantScore) => void,
): Unsubscribe {
  return onValue(ref(db, `games/${GAME_ID}/scores/${uid}`), (snapshot) => {
    callback(normalizeParticipantScore(snapshot.val()))
  })
}

export function subscribeToLeaderboard(callback: (leaderboard: Leaderboard | null) => void): Unsubscribe {
  return onValue(ref(db, `games/${GAME_ID}/leaderboard`), (snapshot) => {
    callback(normalizeLeaderboard(snapshot.val()))
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

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { CHAMPIONS, championMap, type ChampionId } from '../types/champion'
import type { FinalResult } from '../types/finalResult'
import type { Round } from '../types/round'
import type { ParticipantScore } from '../types/score'
import type { Submission } from '../types/submission'
import type { Tiebreak, TiebreakSubmission } from '../types/tiebreak'
import {
  subscribeToFinalResult,
  subscribeToParticipantScore,
  subscribeToTiebreak,
  subscribeToTiebreakSubmission,
  submitChampionChoice,
  submitTiebreakChoice,
  subscribeToCurrentRound,
  subscribeToLeaderboard,
  subscribeToRoundSubmission,
} from '../services/game'

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
  gap: '1rem',
  width: 'min(560px, 100%)',
  marginTop: '1.5rem',
}

const cardStyle: CSSProperties = {
  minHeight: '120px',
  fontSize: '1.2rem',
  fontWeight: 600,
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
  padding: '1rem',
}

const disabledCardStyle: CSSProperties = {
  ...cardStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
}

interface ParticipantGamePageProps {
  uid: string
}

interface RoundSubmissionState {
  roundNumber: number
  submission: Submission | null
}

function ParticipantGamePage({ uid }: ParticipantGamePageProps) {
  const [round, setRound] = useState<Round | null>(null)
  const [submissionState, setSubmissionState] = useState<RoundSubmissionState | null>(null)
  const [participantScore, setParticipantScore] = useState<ParticipantScore | null>(null)
  const [leaderboardRoundNumber, setLeaderboardRoundNumber] = useState<number | null>(null)
  const [currentRank, setCurrentRank] = useState<number | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [tiebreak, setTiebreak] = useState<Tiebreak | null>(null)
  const [tiebreakSubmission, setTiebreakSubmission] = useState<TiebreakSubmission | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingTiebreak, setIsSubmittingTiebreak] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToCurrentRound(setRound), [])
  useEffect(() => subscribeToParticipantScore(uid, setParticipantScore), [uid])
  useEffect(
    () =>
      subscribeToLeaderboard((leaderboard) => {
        setLeaderboardRoundNumber(leaderboard?.roundNumber ?? null)
        const matchedEntry = leaderboard?.entries.find((entry) => entry.uid === uid) ?? null
        setCurrentRank(matchedEntry?.rank ?? null)
      }),
    [uid],
  )
  useEffect(() => subscribeToFinalResult(setFinalResult), [])
  useEffect(() => subscribeToTiebreak(setTiebreak), [])
  useEffect(() => subscribeToTiebreakSubmission(uid, setTiebreakSubmission), [uid])

  useEffect(() => {
    if (!round?.roundNumber) {
      return undefined
    }

    const currentRoundNumber = round.roundNumber

    return subscribeToRoundSubmission(
      uid,
      currentRoundNumber,
      (nextSubmission) => {
        setSubmissionState({
          roundNumber: currentRoundNumber,
          submission: nextSubmission,
        })
      },
    )
  }, [round?.roundNumber, uid])

  const submission =
    round && submissionState?.roundNumber === round.roundNumber
      ? submissionState.submission
      : null

  async function handleChampionSelect(championId: ChampionId) {
    if (
      !round ||
      round.status !== 'voting' ||
      !round.roundNumber ||
      submission ||
      isSubmitting
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await submitChampionChoice(championId)

      // Do not set submission manually here.
      // The Firebase realtime subscription will update it.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Your selection could not be submitted.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTiebreakChampionSelect(championId: ChampionId) {
    if (
      !tiebreak ||
      tiebreak.status !== 'voting' ||
      tiebreakSubmission ||
      isSubmittingTiebreak
    ) {
      return
    }

    setIsSubmittingTiebreak(true)
    setError(null)

    try {
      await submitTiebreakChoice(championId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Your tiebreak selection could not be submitted.',
      )
    } finally {
      setIsSubmittingTiebreak(false)
    }
  }

  const selectedChampion = submission
    ? championMap[submission.championId]
    : null
  const selectedTiebreakChampion = tiebreakSubmission
    ? championMap[tiebreakSubmission.championId]
    : null

  if (finalResult?.status === 'finalized') {
    const finalTopFiveEntry = finalResult.topFive.find((entry) => entry.uid === uid) ?? null

    return (
      <section>
        {finalTopFiveEntry
          ? <p>Your final rank: {finalTopFiveEntry.finalRank}</p>
          : <p>Game complete</p>}
      </section>
    )
  }

  if (finalResult?.status === 'tiebreak_required') {
    const participantUids = tiebreak?.participantUids ?? []
    const isTiebreakParticipant = participantUids.includes(uid)

    if (!isTiebreakParticipant) {
      return <p>Final ranking is being resolved.</p>
    }

    if (!tiebreak || tiebreak.status === 'idle') {
      return <p>Tiebreak is about to start.</p>
    }

    if (tiebreak.status === 'countdown') {
      return <p>Tiebreak countdown in progress...</p>
    }

    if (tiebreak.status === 'voting') {
      if (tiebreakSubmission && selectedTiebreakChampion) {
        return (
<section>
  <p>You chose</p>

  <img
    src={selectedTiebreakChampion.image}
    alt={selectedTiebreakChampion.displayName}
    style={{
      width: 'min(320px, 90vw)',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      borderRadius: '16px',
      display: 'block',
      margin: '1rem auto',
    }}
  />

  <p
    style={{
      fontSize: '1.5rem',
      fontWeight: 700,
      textAlign: 'center',
    }}
  >
    {selectedTiebreakChampion.displayName}
  </p>
</section>
        )
      }

      return (
        <section>
          <p>Choose your tiebreak champion</p>

        <div style={gridStyle}>
          {CHAMPIONS.map((champion) => {
            const isDisabled = isSubmittingTiebreak

            return (
              <button
                key={champion.id}
                type="button"
                onClick={() => void handleTiebreakChampionSelect(champion.id)}
                disabled={isDisabled}
                style={isDisabled ? disabledCardStyle : cardStyle}
              >
                <img
                  src={champion.image}
                  alt={champion.displayName}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    marginBottom: '0.75rem',
                    display: 'block',
                  }}
                />

                <span
                  style={{
                    display: 'block',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                  }}
                >
                  {champion.displayName}
                </span>
              </button>
            )
          })}
        </div>
          {error ? <p role="alert">{error}</p> : null}
        </section>
      )
    }

    if (tiebreak.status === 'closed' || tiebreak.status === 'result') {
      const eliminatedChampionName = tiebreak.eliminatedChampion
        ? championMap[tiebreak.eliminatedChampion].displayName
        : 'Pending'

      return (
        <section>
          <p>Tiebreak eliminated: {eliminatedChampionName}</p>
          {tiebreakSubmission && tiebreak.eliminatedChampion
            ? (
              <p>
                {tiebreakSubmission.championId === tiebreak.eliminatedChampion
                  ? 'Your tiebreak champion was eliminated.'
                  : 'Your tiebreak champion survived.'}
              </p>
            )
            : null}
        </section>
      )
    }
  }

  if (
    !round ||
    round.status === 'registration' ||
    round.status === 'countdown'
  ) {
    return <p>Waiting for the game to begin...</p>
  }

  if (round.status === 'closed') {
    return <p>Submissions closed</p>
  }

  if (round.status === 'result') {
    const eliminatedChampionName = round.eliminatedChampion
      ? championMap[round.eliminatedChampion].displayName
      : 'Pending'
    const roundScore = participantScore?.rounds[String(round.roundNumber)] ?? null
    const totalScore = participantScore?.total ?? 0
    const showCurrentRank = leaderboardRoundNumber === round.roundNumber && currentRank !== null
    const didSubmit = Boolean(submission)
    const hasEliminatedChampion = Boolean(round.eliminatedChampion)

    return (
      <section>
        <p>Eliminated: {eliminatedChampionName}</p>

        {submission && hasEliminatedChampion
          ? (
            <p>
              {submission.championId === round.eliminatedChampion
                ? 'Your champion was eliminated.'
                : 'Your champion survived.'}
            </p>
          )
          : null}

        {round.isDemo
          ? <p>Demo round - no points awarded.</p>
          : (
            <>
              {didSubmit ? <p>Round score: {roundScore ? roundScore.score : 0}</p> : null}
              <p>Total score: {totalScore}</p>
              {showCurrentRank ? <p>Current rank: {currentRank}</p> : null}
            </>
          )}
      </section>
    )
  }

  if (round.status === 'voting') {
    if (submission && selectedChampion) {
      return (
        <section>
           <p>You chose</p>

  <img
    src={selectedChampion.image}
    alt={selectedChampion.displayName}
    style={{
      width: 'min(320px, 90vw)',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      borderRadius: '16px',
      display: 'block',
      margin: '1rem auto',
    }}
  />

  <p
    style={{
      fontSize: '1.5rem',
      fontWeight: 700,
      textAlign: 'center',
    }}
  >
    {selectedChampion.displayName}
  </p>
        </section>
      )
    }

    return (
      <section>
        <p>Choose your champion</p>

        <div style={gridStyle}>
  {CHAMPIONS.map((champion) => {
    const isDisabled = isSubmitting

    return (
      <button
        key={champion.id}
        type="button"
        onClick={() => void handleChampionSelect(champion.id)}
        disabled={isDisabled}
        style={isDisabled ? disabledCardStyle : cardStyle}
      >
        <img
          src={champion.image}
          alt={champion.displayName}
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            objectFit: 'cover',
            borderRadius: '12px',
            marginBottom: '0.75rem',
            display: 'block',
          }}
        />

        <span
          style={{
            display: 'block',
            fontSize: '1.1rem',
            fontWeight: 700,
          }}
        >
          {champion.displayName}
        </span>
      </button>
    )
  })}
</div>

        {error ? <p role="alert">{error}</p> : null}
      </section>
    )
  }

  return <p>Waiting for the game to begin...</p>
}

export default ParticipantGamePage
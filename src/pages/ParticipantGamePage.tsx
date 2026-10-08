import { useEffect, useState } from 'react'

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
      <section style={{ maxWidth: '420px', textAlign: 'center' }}>
        <div className="result-section">
          {finalTopFiveEntry
            ? (
              <>
                <p className="result-label">Final Result</p>
                <p className="result-text" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, color: 'var(--accent-gold)' }}>
                  🏆 Rank #{finalTopFiveEntry.finalRank}
                </p>
                <p className="result-text">
                  {finalTopFiveEntry.nickname} · {finalTopFiveEntry.totalScore} points
                </p>
              </>
            )
            : (
              <>
                <p className="result-text">Game complete.</p>
                <p className="result-text" style={{ color: 'var(--text-secondary)' }}>
                  Thank you for competing!
                </p>
              </>
            )}
        </div>
      </section>
    )
  }

  if (finalResult?.status === 'tiebreak_required') {
    const participantUids = tiebreak?.participantUids ?? []
    const isTiebreakParticipant = participantUids.includes(uid)

    if (!isTiebreakParticipant) {
      return (
        <section style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div className="result-section">
            <p className="result-text">
              🎭 Final ranking is being resolved.
            </p>
            <p className="result-text" style={{ color: 'var(--text-secondary)' }}>
              Watch the display screen for results.
            </p>
          </div>
        </section>
      )
    }

    if (!tiebreak || tiebreak.status === 'idle') {
      return (
        <section style={{ maxWidth: '420px', textAlign: 'center' }}>
          <p className="section-subtitle" style={{ marginTop: '2rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
            🎭 Tiebreak is about to start.
          </p>
        </section>
      )
    }

    if (tiebreak.status === 'countdown') {
      return (
        <section style={{ maxWidth: '420px', textAlign: 'center' }}>
          <p className="section-subtitle" style={{ marginTop: '2rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
            ⏳ Tiebreak countdown in progress...
          </p>
        </section>
      )
    }

    if (tiebreak.status === 'voting') {
      if (tiebreakSubmission && selectedTiebreakChampion) {
        return (
          <section style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="locked-section">
              <h2 className="section-title">Your Tiebreak Champion</h2>
              <img
                src={selectedTiebreakChampion.image}
                alt={selectedTiebreakChampion.displayName}
                className="locked-champion-image"
              />
              <h3 className="locked-champion-name">
                {selectedTiebreakChampion.displayName}
              </h3>
              <p className="locked-status">Choice locked in ✓</p>
              <p className="waiting-text">Waiting for tiebreak results...</p>
            </div>
          </section>
        )
      }

      return (
        <section>
          <h2 className="section-title">Tiebreak Vote</h2>
          <p className="section-subtitle">Choose your champion for the tiebreak.</p>

          <div className="champion-grid">
            {CHAMPIONS.map((champion) => {
              const isDisabled = isSubmittingTiebreak

              return (
                <button
                  key={champion.id}
                  type="button"
                  onClick={() => void handleTiebreakChampionSelect(champion.id)}
                  disabled={isDisabled}
                  className={`champion-card ${isDisabled ? 'disabled' : ''}`}
                >
                  <img
                    src={champion.image}
                    alt={champion.displayName}
                  />
                  <span className="champion-card-name">
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
        <section style={{ maxWidth: '420px' }}>
          <div className="result-section">
            <p className="result-label">Tiebreak Result</p>
            <h2 className="result-champion-name">
              {eliminatedChampionName}
            </h2>
            <p className="result-text">
              {tiebreakSubmission && tiebreak.eliminatedChampion
                ? (
                  tiebreakSubmission.championId === tiebreak.eliminatedChampion
                    ? <span className="result-status-eliminated">Your tiebreak champion was eliminated.</span>
                    : <span className="result-status-survived">Your tiebreak champion survived!</span>
                )
                : 'Tiebreak results are being processed...'}
            </p>
          </div>
        </section>
      )
    }
  }

  if (
    !round ||
    round.status === 'registration' ||
    round.status === 'countdown'
  ) {
    return (
      <section style={{ maxWidth: '420px', textAlign: 'center' }}>
        <p className="section-subtitle" style={{ marginTop: '2rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
          ⏳ Waiting for the game to begin...
        </p>
      </section>
    )
  }

  if (round.status === 'closed') {
    return (
      <section style={{ maxWidth: '420px', textAlign: 'center' }}>
        <p className="section-subtitle" style={{ marginTop: '2rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
          ⏸️ Submissions closed
        </p>
      </section>
    )
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
      <section style={{ maxWidth: '420px' }}>
        <div className="result-section">
          <p className="result-label">Round Result</p>
          <h2 className="result-champion-name">
            {eliminatedChampionName}
          </h2>
          <p className="result-text">
            {submission && hasEliminatedChampion
              ? (
                submission.championId === round.eliminatedChampion
                  ? <span className="result-status-eliminated">Your champion was eliminated.</span>
                  : <span className="result-status-survived">Your champion survived!</span>
              )
              : 'Results are being processed...'}
          </p>

          {round.isDemo
            ? <p className="result-text">Demo round - no points awarded.</p>
            : (
              <>
                {didSubmit ? (
                  <p className="result-text">
                    Round score: <strong>{roundScore ? roundScore.score : 0}</strong>
                  </p>
                ) : null}
                <p className="result-text">
                  Total score: <strong>{totalScore}</strong>
                </p>
                {showCurrentRank ? (
                  <p className="result-text">
                    Current rank: <strong>#{currentRank}</strong>
                  </p>
                ) : null}
              </>
            )}
        </div>
      </section>
    )
  }

  if (round.status === 'voting') {
    if (submission && selectedChampion) {
      return (
        <section style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div className="locked-section">
            <h2 className="section-title">Your Champion</h2>
            <img
              src={selectedChampion.image}
              alt={selectedChampion.displayName}
              className="locked-champion-image"
            />
            <h3 className="locked-champion-name">
              {selectedChampion.displayName}
            </h3>
            <p className="locked-status">Choice locked in ✓</p>
            <p className="waiting-text">Waiting for the other players...</p>
          </div>
        </section>
      )
    }

    return (
      <section>
        <h2 className="section-title">Choose Your Champion</h2>
        <p className="section-subtitle">Tap once. Your choice is final.</p>

        <div className="champion-grid">
          {CHAMPIONS.map((champion) => {
            const isDisabled = isSubmitting

            return (
              <button
                key={champion.id}
                type="button"
                onClick={() => void handleChampionSelect(champion.id)}
                disabled={isDisabled}
                className={`champion-card ${isDisabled ? 'disabled' : ''}`}
              >
                <img
                  src={champion.image}
                  alt={champion.displayName}
                />
                <span className="champion-card-name">
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

  return (
    <section style={{ maxWidth: '420px', textAlign: 'center' }}>
      <p className="section-subtitle" style={{ marginTop: '2rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
        ⏳ Loading game...
      </p>
    </section>
  )
}

export default ParticipantGamePage
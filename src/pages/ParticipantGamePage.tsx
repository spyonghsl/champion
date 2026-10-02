import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { CHAMPIONS, championMap, type ChampionId } from '../types/champion'
import type { Round } from '../types/round'
import type { Submission } from '../types/submission'
import {
  submitChampionChoice,
  subscribeToCurrentRound,
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

function ParticipantGamePage({ uid }: ParticipantGamePageProps) {
  const [round, setRound] = useState<Round | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToCurrentRound(setRound), [])

  useEffect(() => {
    if (!round?.roundNumber) {
      return undefined
    }

    return subscribeToRoundSubmission(
      uid,
      round.roundNumber,
      setSubmission,
    )
  }, [round?.roundNumber, uid])

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
      await submitChampionChoice(
        uid,
        round.roundNumber,
        championId,
      )

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

  const selectedChampion = submission
    ? championMap[submission.championId].displayName
    : null

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
    return <p>Result phase is underway. Results will be shown here.</p>
  }

  if (round.status === 'voting') {
    if (submission) {
      return (
        <section>
          <p>You chose {selectedChampion}</p>
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
                {champion.displayName}
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
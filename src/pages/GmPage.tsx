import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'

import { auth } from '../firebase/config'
import { championMap } from '../types/champion'
import { closeVoting, finalizeRound, startDemoRound, startNextRound } from '../services/gm'
import { subscribeToCurrentRound } from '../services/game'
import type { Round } from '../types/round'

function GmPage() {
  const [isReady, setIsReady] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsReady(true)
        return
      }

      setIsReady(false)
      signInAnonymously(auth)
        .then(() => {
          setIsReady(true)
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Sign-in failed.')
        })
    })

    return unsubscribe
  }, [])

  useEffect(() => subscribeToCurrentRound(setRound), [])

  async function handleStartDemoRound() {
    setIsActing(true)
    setError(null)
    try {
      await startDemoRound()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start demo round.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleCloseVoting() {
    setIsActing(true)
    setError(null)
    try {
      await closeVoting()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close voting.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleFinalizeRound() {
    setIsActing(true)
    setError(null)
    try {
      await finalizeRound()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to finalize round.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleStartNextRound() {
    setIsActing(true)
    setError(null)
    try {
      await startNextRound()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start next round.')
    } finally {
      setIsActing(false)
    }
  }

  function nextRoundLabel(roundNumber: number): string | null {
    if (roundNumber === 1) {
      return 'Start Round 2'
    }
    if (roundNumber === 2) {
      return 'Start Round 3'
    }
    if (roundNumber === 3) {
      return 'Start Round 4'
    }

    return null
  }

  function renderControls() {
    if (!round) {
      return (
        <button
          type="button"
          onClick={() => void handleStartDemoRound()}
          disabled={isActing || !isReady}
        >
          Start Demo Round
        </button>
      )
    }

    if (round.status === 'countdown') {
      return <p>Countdown in progress. Waiting to open voting...</p>
    }

    if (round.status === 'voting') {
      return (
        <button
          type="button"
          onClick={() => void handleCloseVoting()}
          disabled={isActing || !isReady}
        >
          Close Voting
        </button>
      )
    }

    if (round.status === 'closed') {
      return (
        <button
          type="button"
          onClick={() => void handleFinalizeRound()}
          disabled={isActing || !isReady}
        >
          Finalize Result
        </button>
      )
    }

    if (round.status === 'result') {
      const buttonLabel = nextRoundLabel(round.roundNumber)

      return (
        <>
          {round.eliminatedChampion
            ? <p>Eliminated: {championMap[round.eliminatedChampion].displayName}</p>
            : <p>Eliminated: Pending</p>}

          {buttonLabel
            ? (
              <button
                type="button"
                onClick={() => void handleStartNextRound()}
                disabled={isActing || !isReady}
              >
                {buttonLabel}
              </button>
            )
            : <p>Scoring rounds complete</p>}
        </>
      )
    }

    return <p>No control available for this round state yet.</p>
  }

  return (
    <main>
      <h1>GM Controls</h1>
      <p>Round number: {round ? round.roundNumber : 'None'}</p>
      <p>Mode: {round ? (round.isDemo ? 'Demo' : 'Scoring') : 'None'}</p>
      <p>Status: {round ? round.status : 'No current round'}</p>
      {renderControls()}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  )
}

export default GmPage

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'

import { auth } from '../firebase/config'
import {
  buildLeaderboard,
  closeTiebreakVoting,
  closeVoting,
  finalizeRound,
  finalizeTiebreak,
  prepareFinalResult,
  startDemoRound,
  startNextRound,
  startTiebreak,
} from '../services/gm'
import { subscribeToCurrentRound, subscribeToFinalResult, subscribeToLeaderboard, subscribeToTiebreak } from '../services/game'
import type { FinalResult } from '../types/finalResult'
import type { Leaderboard } from '../types/leaderboard'
import type { Round } from '../types/round'
import type { Tiebreak } from '../types/tiebreak'

function GmPage() {
  const [isReady, setIsReady] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [tiebreak, setTiebreak] = useState<Tiebreak | null>(null)
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
  useEffect(() => subscribeToLeaderboard(setLeaderboard), [])
  useEffect(() => subscribeToFinalResult(setFinalResult), [])
  useEffect(() => subscribeToTiebreak(setTiebreak), [])

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

  async function handleBuildLeaderboard() {
    setIsActing(true)
    setError(null)
    try {
      await buildLeaderboard()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to build leaderboard.')
    } finally {
      setIsActing(false)
    }
  }

  async function handlePrepareFinalResult() {
    setIsActing(true)
    setError(null)
    try {
      await prepareFinalResult()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to prepare final result.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleStartTiebreak() {
    setIsActing(true)
    setError(null)
    try {
      await startTiebreak()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start tiebreak.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleCloseTiebreakVoting() {
    setIsActing(true)
    setError(null)
    try {
      await closeTiebreakVoting()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close tiebreak voting.')
    } finally {
      setIsActing(false)
    }
  }

  async function handleFinalizeTiebreak() {
    setIsActing(true)
    setError(null)
    try {
      await finalizeTiebreak()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to finalize tiebreak.')
    } finally {
      setIsActing(false)
    }
  }

  function isScoringRound(roundNumber: number): boolean {
    return roundNumber === 2 || roundNumber === 3 || roundNumber === 4
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
      const hasLeaderboardForRound = leaderboard?.roundNumber === round.roundNumber
      const needsLeaderboardBuild = isScoringRound(round.roundNumber) && !hasLeaderboardForRound

      if (!needsLeaderboardBuild && round.roundNumber === 4) {
        if (!finalResult) {
          return (
            <button
              type="button"
              onClick={() => void handlePrepareFinalResult()}
              disabled={isActing || !isReady}
            >
              Prepare Final Result
            </button>
          )
        }

        if (finalResult.status === 'finalized') {
          return (
            <>
              <p>Final Result Ready</p>
              <p>Game Complete</p>
            </>
          )
        }

        if (finalResult.status === 'tiebreak_required') {
          return (
            <>
              <p>Tiebreak Required</p>
              {tiebreak?.status === 'countdown'
                ? <p>Tiebreak countdown in progress...</p>
                : null}
              {tiebreak?.status === 'voting'
                ? (
                  <button
                    type="button"
                    onClick={() => void handleCloseTiebreakVoting()}
                    disabled={isActing || !isReady}
                  >
                    Close Tiebreak Voting
                  </button>
                )
                : null}
              {tiebreak?.status === 'closed' || tiebreak?.status === 'result'
                ? (
                  <button
                    type="button"
                    onClick={() => void handleFinalizeTiebreak()}
                    disabled={isActing || !isReady}
                  >
                    Finalize Tiebreak
                  </button>
                )
                : null}
              {!tiebreak || tiebreak.status === 'idle'
                ? (
                  <button
                    type="button"
                    onClick={() => void handleStartTiebreak()}
                    disabled={isActing || !isReady}
                  >
                    Start Tiebreak
                  </button>
                )
                : null}
            </>
          )
        }

        return (
          <button
            type="button"
            onClick={() => void handlePrepareFinalResult()}
            disabled={isActing || !isReady}
          >
            Prepare Final Result
          </button>
        )
      }

      return (
        <>
          {needsLeaderboardBuild
            ? (
              <button
                type="button"
                onClick={() => void handleBuildLeaderboard()}
                disabled={isActing || !isReady}
              >
                {round.roundNumber === 4 ? 'Build Final Leaderboard' : 'Build Leaderboard'}
              </button>
            ) : null}

          {!needsLeaderboardBuild && buttonLabel
            ? (
              <button
                type="button"
                onClick={() => void handleStartNextRound()}
                disabled={isActing || !isReady}
              >
                {buttonLabel}
              </button>
            )
            : null}
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

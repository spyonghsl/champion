import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'

import { auth } from '../firebase/config'
import { signInGm, signOutGm } from '../services/gmAuth'
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
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.isAnonymous) {
        // Anonymous users on /gm route must sign out and login as GM
        await signOutGm()
        setUser(null)
        setIsLoading(false)
        return
      }

      if (currentUser) {
        // Non-anonymous authenticated user (email/password GM)
        setUser({ uid: currentUser.uid, email: currentUser.email })
      } else {
        // No authenticated user
        setUser(null)
      }
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  if (isLoading) {
    return (
      <main>
        <h1>GM Dashboard</h1>
        <p>Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main>
        <h1>GM Dashboard</h1>
        <GmLoginForm />
      </main>
    )
  }

  return (
    <main>
      <h1>GM Dashboard</h1>
      <GmControls />
    </main>
  )
}

function GmLoginForm() {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsLoading(true)
      setLoginError(null)

      try {
        await signInGm(password)
      } catch (err: unknown) {
        setLoginError(err instanceof Error ? err.message : 'Login failed.')
      } finally {
        setIsLoading(false)
        setPassword('')
      }
    },
    [password]
  )

  return (
    <form onSubmit={handleLogin}>
      <h2>GM Login</h2>
      <div>
        <label htmlFor="gm-password">Password:</label>
        <input
          id="gm-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      {loginError && <p role="alert">{loginError}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Sign In'}
      </button>
    </form>
  )
}

function GmControls() {
  const [round, setRound] = useState<Round | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [tiebreak, setTiebreak] = useState<Tiebreak | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToCurrentRound(setRound), [])
  useEffect(() => subscribeToLeaderboard(setLeaderboard), [])
  useEffect(() => subscribeToFinalResult(setFinalResult), [])
  useEffect(() => subscribeToTiebreak(setTiebreak), [])

  async function handleSignOut() {
    try {
      await signOutGm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-out failed.')
    }
  }

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
          disabled={isActing}
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
          disabled={isActing}
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
          disabled={isActing}
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
              disabled={isActing}
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
                    disabled={isActing}
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
                    disabled={isActing}
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
                    disabled={isActing}
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
            disabled={isActing}
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
                disabled={isActing}
              >
                {round.roundNumber === 4 ? 'Build Final Leaderboard' : 'Build Leaderboard'}
              </button>
            ) : null}

          {!needsLeaderboardBuild && buttonLabel
            ? (
              <button
                type="button"
                onClick={() => void handleStartNextRound()}
                disabled={isActing}
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
    <>
      <h2>GM Controls</h2>
      {error && <p role="alert">{error}</p>}
      <div>
        <h3>Current Round: {round?.roundNumber}</h3>
        <p>Status: {round?.status}</p>
        {round?.eliminatedChampion && <p>Eliminated: {round.eliminatedChampion}</p>}
      </div>
      <div>
        <h3>Controls</h3>
        {renderControls()}
      </div>
      {leaderboard && (
        <details>
          <summary>Leaderboard (Round {leaderboard.roundNumber})</summary>
          <ol>
            {leaderboard.entries.map((entry) => (
              <li key={entry.uid}>
                {entry.nickname}: {entry.totalScore} points
              </li>
            ))}
          </ol>
        </details>
      )}
      {finalResult && (
        <details>
          <summary>Final Result (Status: {finalResult.status})</summary>
          <ol>
            {finalResult.topFive.map((entry) => (
              <li key={entry.uid}>
                {entry.nickname}: {entry.totalScore} points
              </li>
            ))}
          </ol>
        </details>
      )}
      <button type="button" onClick={() => void handleSignOut()}>
        Sign Out
      </button>
    </>
  )
}

export default GmPage

import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { auth } from './firebase/config'
import MainDisplayPage from './pages/MainDisplayPage'
import ParticipantGamePage from './pages/ParticipantGamePage'
import RegistrationPage from './pages/RegistrationPage'
import { getParticipant } from './services/registration'
import type { Participant } from './types/participant'

type ParticipantState =
  | { status: 'loading' }
  | { status: 'unregistered' }
  | { status: 'registered'; participant: Participant }
  | { status: 'error'; message: string }

function PlayerPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [participantState, setParticipantState] = useState<ParticipantState>({ status: 'loading' })

  const loadParticipant = useCallback(async (currentUid: string) => {
    setParticipantState({ status: 'loading' })
    try {
      const participant = await getParticipant(currentUid)
      setParticipantState(
        participant ? { status: 'registered', participant } : { status: 'unregistered' },
      )
    } catch (err) {
      setParticipantState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load participant.',
      })
    }
  }, [])

  useEffect(() => {
    // Default browser persistence keeps the anonymous user across refreshes.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid)
        void loadParticipant(user.uid)
        return
      }

      setUid(null)
      signInAnonymously(auth).catch((err: unknown) => {
        setParticipantState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Sign-in failed.',
        })
      })
    })

    return unsubscribe
  }, [loadParticipant])

  function renderContent() {
    if (participantState.status === 'error') {
      return <p role="alert">{participantState.message}</p>
    }
    if (!uid) {
      return <p>Signing in...</p>
    }
    if (participantState.status === 'loading') {
      return <p>Loading...</p>
    }
    if (participantState.status === 'unregistered') {
      return <RegistrationPage uid={uid} onRegistered={() => void loadParticipant(uid)} />
    }
    return (
      <section>
        <p>You're registered!</p>
        <img src={participantState.participant.selfieUrl} alt={participantState.participant.nickname} />
        <p>{participantState.participant.nickname}</p>
        <ParticipantGamePage uid={uid} />
      </section>
    )
  }

  return (
    <main>
      <h1>Champion Game 2026</h1>
      {renderContent()}
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerPage />} />
        <Route path="/display" element={<MainDisplayPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

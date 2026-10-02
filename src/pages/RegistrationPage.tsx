import { useState } from 'react'
import type { FormEvent } from 'react'

import { registerParticipant } from '../services/registration'

interface RegistrationPageProps {
  uid: string
  onRegistered: () => void
}

function RegistrationPage({ uid, onRegistered }: RegistrationPageProps) {
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await registerParticipant(uid, nickname)
      onRegistered()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nickname
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          disabled={submitting}
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Registering...' : 'Register'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default RegistrationPage

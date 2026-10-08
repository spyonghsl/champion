import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { resizeSelfie } from '../services/image'
import { registerParticipant } from '../services/registration'

interface RegistrationPageProps {
  uid: string
  onRegistered: () => void
}

function RegistrationPage({ uid, onRegistered }: RegistrationPageProps) {
  const [nickname, setNickname] = useState('')
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selfiePreviewUrl = useMemo(() => {
    if (!selfieFile) return null

    return URL.createObjectURL(selfieFile)
  }, [selfieFile])

  useEffect(() => {
    return () => {
      if (selfiePreviewUrl) {
        URL.revokeObjectURL(selfiePreviewUrl)
      }
    }
  }, [selfiePreviewUrl])

  function handleSelfieChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setError(null)
    setSelfieFile(file)
  }

  function handleChoosePhotoClick() {
    fileInputRef.current?.click()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting) return

    if (!nickname.trim()) {
      setError('Enter a nickname before registering.')
      return
    }

    if (!selfieFile) {
      setError('Choose a selfie before registering.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const resizedSelfie = await resizeSelfie(selfieFile)

      await registerParticipant(
        uid,
        nickname,
        resizedSelfie,
      )

      onRegistered()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed.',
      )

      setSubmitting(false)
    }
  }

  const canRegister =
    !submitting &&
    nickname.trim().length > 0 &&
    selfieFile !== null

  return (
    <>
      <p className="tagline">Choose. Survive. Conquer.</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nickname" className="form-label">
            Your Nickname
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            disabled={submitting}
            placeholder="Enter your nickname"
          />
        </div>

        <div className="selfie-upload-wrapper">
          <label className="form-label">Your Selfie</label>
          <div className="selfie-preview-container">
            {selfiePreviewUrl ? (
              <img
                src={selfiePreviewUrl}
                alt="Selected selfie preview"
              />
            ) : (
              <span className="selfie-placeholder">📸</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleSelfieChange}
            disabled={submitting}
            required
          />
          <button
            type="button"
            className="file-input-button"
            onClick={handleChoosePhotoClick}
            disabled={submitting}
          >
            Choose Photo
          </button>
        </div>

        <button
          type="submit"
          disabled={!canRegister}
        >
          {submitting ? 'Entering the game...' : 'Enter the Game'}
        </button>

        {error && <p role="alert">{error}</p>}
      </form>
    </>
  )
}

export default RegistrationPage
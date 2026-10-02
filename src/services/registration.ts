import { get, increment, ref, serverTimestamp, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'

import { db, storage } from '../firebase/config'
import type { Participant } from '../types/participant'

export const GAME_ID = 'game001'

const NICKNAME_MIN_LENGTH = 2
const NICKNAME_MAX_LENGTH = 24

export async function getParticipant(uid: string): Promise<Participant | null> {
    const snapshot = await get(ref(db, `games/${GAME_ID}/participants/${uid}`))
    return snapshot.exists() ? (snapshot.val() as Participant) : null
}

export async function registerParticipant(uid: string, nickname: string, selfie: Blob): Promise<void> {
    const trimmed = nickname.trim()

    if (trimmed.length < NICKNAME_MIN_LENGTH) {
        throw new Error(`Nickname must be at least ${NICKNAME_MIN_LENGTH} characters.`)
    }
    if (trimmed.length > NICKNAME_MAX_LENGTH) {
        throw new Error(`Nickname must be at most ${NICKNAME_MAX_LENGTH} characters.`)
    }

    if (await getParticipant(uid)) return

    const selfieReference = storageRef(storage, `selfies/${uid}.jpg`)
    await uploadBytes(selfieReference, selfie, { contentType: 'image/jpeg' })
    const selfieUrl = await getDownloadURL(selfieReference)

    await update(ref(db), {
        [`games/${GAME_ID}/participants/${uid}`]: {
            uid,
            nickname: trimmed,
            selfieUrl,
            registeredAt: serverTimestamp(),
        },
        [`games/${GAME_ID}/live/registeredCount`]: increment(1),
    })
}

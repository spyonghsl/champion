import { onValue, ref } from 'firebase/database'
import type { Unsubscribe } from 'firebase/database'

import { db } from '../firebase/config'
import { GAME_ID } from './registration'

export function subscribeToRegisteredCount(callback: (count: number) => void): Unsubscribe {
    return onValue(ref(db, `games/${GAME_ID}/live/registeredCount`), (snapshot) => {
        const value: unknown = snapshot.val()
        callback(typeof value === 'number' ? value : 0)
    })
}

import { connectAuthEmulator } from 'firebase/auth'
import { connectDatabaseEmulator } from 'firebase/database'

import { auth, db } from './config'

let connected = false

export function connectFirebaseEmulators() {
  if (connected) return

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })

  connectDatabaseEmulator(db, '127.0.0.1', 9000)

  connected = true
}

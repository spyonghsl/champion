import { connectAuthEmulator } from 'firebase/auth'
import { connectDatabaseEmulator } from 'firebase/database'
import { connectFunctionsEmulator } from 'firebase/functions'
import { connectStorageEmulator } from 'firebase/storage'

import { auth, db, functions, storage } from './config'

let connected = false

export function connectFirebaseEmulators() {
  if (connected) return

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })

  connectDatabaseEmulator(db, '127.0.0.1', 9000)

  connectFunctionsEmulator(functions, '127.0.0.1', 5001)

  connectStorageEmulator(storage, '127.0.0.1', 9199)

  connected = true
}

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCk2ZCfCeXD_rx8V-662bIcpm70jdUkTQc",
  authDomain: "champion-2026-fcbd8.firebaseapp.com",
  databaseURL: "https://champion-2026-fcbd8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "champion-2026-fcbd8",
  storageBucket: "champion-2026-fcbd8.firebasestorage.app",
  messagingSenderId: "608582551010",
  appId: "1:608582551010:web:cb5a629e4c07abb74ea5bb"
}


export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getDatabase(app)

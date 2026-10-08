import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'

import { auth } from '../firebase/config'

const GM_EMAIL = 'gm@champion.local'

/**
 * Sign in as a Game Master using email/password.
 * @param {string} password GM password.
 * @return {Promise<void>} Resolves on successful sign-in.
 */
export async function signInGm(password: string): Promise<void> {
    try {
        await signInWithEmailAndPassword(auth, GM_EMAIL, password)
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message.includes('auth/user-not-found')) {
                throw new Error('Game Master account not found.', { cause: error })
            }
            if (error.message.includes('auth/wrong-password')) {
                throw new Error('Incorrect password.', { cause: error })
            }
            throw new Error(error.message, { cause: error })
        }
        throw new Error('Sign-in failed.', { cause: error })
    }
}

/**
 * Sign out the GMs from their session.
 * @return {Promise<void>} Resolves on successful sign-out.
 */
export async function signOutGm(): Promise<void> {
    await firebaseSignOut(auth)
}

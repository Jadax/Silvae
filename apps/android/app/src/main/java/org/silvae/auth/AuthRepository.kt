package org.silvae.auth

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.userProfileChangeRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps Firebase Auth. No anonymous/guest mode — mirrors the web app's
 * mandatory-registration decision (apps/web/src/lib/auth.tsx): every plant is
 * tied to a real account.
 */
@Singleton
class AuthRepository @Inject constructor(private val auth: FirebaseAuth) {

    /** Emits the current user on every auth state change (null when signed out). */
    fun authState(): Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    val currentUser: FirebaseUser? get() = auth.currentUser

    suspend fun signUp(email: String, password: String, name: String) {
        val result = auth.createUserWithEmailAndPassword(email, password).await()
        if (name.isNotBlank()) {
            result.user?.updateProfile(userProfileChangeRequest { displayName = name })?.await()
        }
    }

    suspend fun signIn(email: String, password: String) {
        auth.signInWithEmailAndPassword(email, password).await()
    }

    suspend fun signInWithGoogleIdToken(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }

    fun signOut() = auth.signOut()

    /** Fresh ID token for calling the Silvae serverless API (mirrors lib/api.ts's Bearer header). */
    suspend fun idToken(): String? = auth.currentUser?.getIdToken(false)?.await()?.token

    /**
     * Deletes the Firebase Auth account. Google Play policy requires apps that
     * support account creation to support in-app account deletion. Firebase
     * requires a recent sign-in for this to succeed; callers should surface
     * FirebaseAuthRecentLoginRequiredException as "sign out and back in, then
     * try again" rather than a generic error.
     */
    suspend fun deleteAccount() {
        auth.currentUser?.delete()?.await()
    }
}

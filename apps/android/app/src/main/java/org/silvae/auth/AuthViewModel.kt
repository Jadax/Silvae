package org.silvae.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface AuthStatus {
    data object Loading : AuthStatus
    data object SignedOut : AuthStatus
    data class SignedIn(val user: FirebaseUser) : AuthStatus
}

enum class AuthMode { SIGN_UP, SIGN_IN }

data class AuthFormState(
    val mode: AuthMode = AuthMode.SIGN_UP,
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repo: AuthRepository,
) : ViewModel() {

    val status: StateFlow<AuthStatus> = repo.authState()
        .map { user -> if (user != null) AuthStatus.SignedIn(user) else AuthStatus.SignedOut }
        .stateIn(viewModelScope, SharingStarted.Eagerly, AuthStatus.Loading)

    private val _form = MutableStateFlow(AuthFormState())
    val form: StateFlow<AuthFormState> = _form

    fun setMode(mode: AuthMode) = _form.update { it.copy(mode = mode, error = null) }
    fun setName(value: String) = _form.update { it.copy(name = value) }
    fun setEmail(value: String) = _form.update { it.copy(email = value) }
    fun setPassword(value: String) = _form.update { it.copy(password = value) }

    fun submit() {
        val state = _form.value
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                if (state.mode == AuthMode.SIGN_UP) {
                    repo.signUp(state.email, state.password, state.name)
                } else {
                    repo.signIn(state.email, state.password)
                }
                _form.update { it.copy(busy = false) }
            } catch (e: Exception) {
                _form.update { it.copy(busy = false, error = friendlyError(e)) }
            }
        }
    }

    fun onGoogleIdToken(idToken: String) {
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                repo.signInWithGoogleIdToken(idToken)
                _form.update { it.copy(busy = false) }
            } catch (e: Exception) {
                _form.update { it.copy(busy = false, error = friendlyError(e)) }
            }
        }
    }

    fun onGoogleError(message: String) = _form.update { it.copy(busy = false, error = message) }

    fun signOut() = repo.signOut()

    private fun friendlyError(e: Exception): String = when (e) {
        is FirebaseAuthUserCollisionException -> "That email already has an account — try signing in instead."
        is FirebaseAuthInvalidCredentialsException -> "That email and password don't match."
        is FirebaseAuthInvalidUserException -> "No account found for that email."
        is FirebaseAuthWeakPasswordException -> "Choose a password with at least 6 characters."
        is FirebaseNetworkException -> "Network error. Check your connection and try again."
        is FirebaseException -> e.localizedMessage ?: "Something went wrong. Please try again."
        else -> e.localizedMessage ?: "Something went wrong. Please try again."
    }
}

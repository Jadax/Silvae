package org.silvae.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.silvae.auth.AuthRepository
import org.silvae.data.PlantRepository
import org.silvae.data.SettingsRepository
import javax.inject.Inject

data class DeleteAccountState(val busy: Boolean = false, val error: String? = null, val done: Boolean = false)

/**
 * Account + data deletion — Google Play policy requires apps that support
 * account creation to support deleting the account and its data in-app, not
 * just signing out. Deletes local + Firestore plant data first, then the
 * Firebase Auth account itself.
 */
@HiltViewModel
class DeleteAccountViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val plantRepository: PlantRepository,
    private val settingsRepository: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(DeleteAccountState())
    val state: StateFlow<DeleteAccountState> = _state

    fun deleteAccount() {
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                plantRepository.deleteAllMyPlants()
                settingsRepository.clear()
                authRepository.deleteAccount()
                _state.update { it.copy(busy = false, done = true) }
            } catch (e: FirebaseAuthRecentLoginRequiredException) {
                _state.update { it.copy(busy = false, error = "For your security, sign out and sign back in, then try deleting your account again.") }
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = e.localizedMessage ?: "Couldn't delete your account. Try again.") }
            }
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }
}

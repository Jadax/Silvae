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
import org.silvae.data.sync.CloudSync
import javax.inject.Inject

data class DeleteAccountState(val busy: Boolean = false, val error: String? = null, val done: Boolean = false)

/**
 * Account + data deletion — Google Play policy requires apps that support
 * account creation to support deleting the account and its data in-app, not
 * just signing out. Deletes every cloud document the account owns and all
 * local data first, then the Firebase Auth account itself.
 */
@HiltViewModel
class DeleteAccountViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val cloudSync: CloudSync,
) : ViewModel() {
    private val _state = MutableStateFlow(DeleteAccountState())
    val state: StateFlow<DeleteAccountState> = _state

    fun deleteAccount() {
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                cloudSync.deleteAllCloudData()
                authRepository.deleteAccount()
                _state.update { it.copy(busy = false, done = true) }
            } catch (e: FirebaseAuthRecentLoginRequiredException) {
                cloudSync.resume()
                _state.update { it.copy(busy = false, error = "Your plant data is deleted. For your security, sign out and back in, then tap Delete account again to remove the account itself.") }
            } catch (e: Exception) {
                cloudSync.resume()
                _state.update { it.copy(busy = false, error = "Couldn't delete everything. Check your connection and try again.") }
            }
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }
}

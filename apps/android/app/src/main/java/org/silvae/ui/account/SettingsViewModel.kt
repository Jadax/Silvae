package org.silvae.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.silvae.data.SettingsRepository
import org.silvae.data.local.entity.SettingsEntity
import org.silvae.data.remote.Place
import javax.inject.Inject

data class LocationUiState(
    val detecting: Boolean = false,
    val searching: Boolean = false,
    val query: String = "",
    val results: List<Place> = emptyList(),
    val message: String? = null,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repo: SettingsRepository,
) : ViewModel() {
    val settings: StateFlow<SettingsEntity?> = repo.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    // Room emits `null` immediately when no settings row exists yet — which is
    // the normal, permanent state for a brand-new user, not a "still loading"
    // signal. `settings == null` alone can't tell "haven't heard from Room
    // yet" apart from "heard from Room: no row, use defaults" — conflating
    // those previously left new users stuck on an infinite loading spinner in
    // the top-level auth gate, since a fresh account's settings row genuinely
    // never exists until onboarding writes one.
    val hasLoadedSettings: StateFlow<Boolean> = repo.observe()
        .map { true }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    private val _location = MutableStateFlow(LocationUiState())
    val location: StateFlow<LocationUiState> = _location

    fun setPets(cat: Boolean, dog: Boolean) = viewModelScope.launch { repo.setPets(cat, dog) }
    fun setUnits(imperial: Boolean) = viewModelScope.launch { repo.setUnits(imperial) }
    fun setOnboarded(value: Boolean) = viewModelScope.launch { repo.setOnboarded(value) }

    fun detectLocation() {
        _location.value = _location.value.copy(detecting = true, message = null)
        viewModelScope.launch {
            val result = repo.detectAndSaveLocation()
            _location.value = _location.value.copy(
                detecting = false,
                message = result.fold(
                    onSuccess = { "Set to ${it.label}." },
                    onFailure = { it.message ?: "Couldn't find your location." },
                ),
            )
        }
    }

    fun setQuery(value: String) = _location.update { it.copy(query = value) }

    fun search() {
        _location.value = _location.value.copy(searching = true)
        viewModelScope.launch {
            val results = repo.searchPlaces(_location.value.query)
            _location.value = _location.value.copy(searching = false, results = results)
        }
    }

    fun choosePlace(place: Place) {
        viewModelScope.launch {
            repo.setLocation(place)
            _location.value = _location.value.copy(message = "Set to ${place.label}.", results = emptyList())
        }
    }
}

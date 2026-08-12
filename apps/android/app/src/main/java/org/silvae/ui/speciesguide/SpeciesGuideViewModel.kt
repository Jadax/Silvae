package org.silvae.ui.speciesguide

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import org.silvae.data.SettingsRepository
import org.silvae.domain.care.Species
import org.silvae.domain.care.SpeciesCatalog
import javax.inject.Inject

data class SpeciesGuideUi(val species: Species? = null, val imperial: Boolean = false)

@HiltViewModel
class SpeciesGuideViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val catalog: SpeciesCatalog,
    settingsRepository: SettingsRepository,
) : ViewModel() {
    private val slug: String = checkNotNull(savedStateHandle["slug"])
    private val speciesFlow = MutableStateFlow<Species?>(null)

    val ui: StateFlow<SpeciesGuideUi> = combine(
        speciesFlow,
        settingsRepository.observe().map { it?.units == "imperial" },
    ) { species, imperial -> SpeciesGuideUi(species, imperial) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SpeciesGuideUi())

    init {
        viewModelScope.launch { speciesFlow.value = catalog.bySlug(slug) }
    }
}

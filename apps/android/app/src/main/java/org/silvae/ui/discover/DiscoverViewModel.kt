package org.silvae.ui.discover

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.silvae.data.local.dao.SettingsDao
import org.silvae.domain.care.Species
import org.silvae.domain.care.SpeciesCatalog
import javax.inject.Inject

data class DiscoverUi(
    val query: String = "",
    val petSafeOnly: Boolean = false,
    val hasPets: Boolean = false,
    val results: List<Species> = emptyList(),
    val loading: Boolean = true,
)

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    catalog: SpeciesCatalog,
    settingsDao: SettingsDao,
) : ViewModel() {
    private val query = MutableStateFlow("")
    private val petSafeOnly = MutableStateFlow(false)
    private val allSpecies = MutableStateFlow<List<Species>?>(null)
    private val hasPets = settingsDao.observe().map { it?.petCat == true || it?.petDog == true }

    val ui: StateFlow<DiscoverUi> = combine(query, petSafeOnly, hasPets, allSpecies) { q, safe, pets, species ->
        val filtered = (species ?: emptyList())
            .filter { s ->
                q.isBlank() || s.scientificName.contains(q, ignoreCase = true) ||
                    s.commonNames.any { it.contains(q, ignoreCase = true) }
            }
            .filter { !safe || !it.toxicity.pets }
        DiscoverUi(query = q, petSafeOnly = safe, hasPets = pets, results = filtered, loading = species == null)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DiscoverUi())

    init {
        viewModelScope.launch { allSpecies.value = catalog.all() }
        viewModelScope.launch { hasPets.collect { if (it) petSafeOnly.update { true } } }
    }

    fun setQuery(value: String) = query.update { value }
    fun setPetSafeOnly(value: Boolean) = petSafeOnly.update { value }
}

package org.silvae.ui.plantdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.silvae.data.PlantRepository
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.PlantEntity
import org.silvae.domain.care.EnvRepository
import org.silvae.domain.care.Species
import org.silvae.domain.care.SpeciesCatalog
import org.silvae.domain.care.nextWaterAt
import java.time.Instant
import javax.inject.Inject

data class PlantDetailUi(
    val plant: PlantEntity? = null,
    val species: Species? = null,
    val events: List<CareEventEntity> = emptyList(),
    val loaded: Boolean = false,
    val outdoorTempC: Double? = null,
)

@HiltViewModel
class PlantDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repo: PlantRepository,
    private val catalog: SpeciesCatalog,
    private val envRepository: EnvRepository,
) : ViewModel() {
    private val plantId: String = checkNotNull(savedStateHandle["plantId"])
    private val speciesFlow = MutableStateFlow<Species?>(null)
    private val outdoorTempFlow = MutableStateFlow<Double?>(null)

    val ui: StateFlow<PlantDetailUi> = combine(
        repo.observePlant(plantId),
        repo.observeCareEvents(plantId, 30),
        speciesFlow,
        outdoorTempFlow,
    ) { plant, events, species, outdoorTemp ->
        PlantDetailUi(plant = plant, species = species, events = events, loaded = true, outdoorTempC = outdoorTemp)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PlantDetailUi())

    init {
        viewModelScope.launch {
            val plant = repo.getPlantOnce(plantId) ?: return@launch
            speciesFlow.value = catalog.bySlug(plant.speciesSlug)
            if (plant.locationType == "outdoor") {
                outdoorTempFlow.value = envRepository.envFor("outdoor").tempC
            }
        }
    }

    fun logCare(type: String) {
        viewModelScope.launch {
            val plant = ui.value.plant ?: return@launch
            repo.logCareEvent(plant.id, type)
            if (type == "water") {
                val species = ui.value.species
                val next = if (species != null) {
                    nextWaterAt(species, plant.potType, plant.potSizeCm, plant.soilType, plant.locationType, envRepository.envFor(plant.locationType), Instant.now()).nextAt
                } else {
                    Instant.now().plus(7, java.time.temporal.ChronoUnit.DAYS)
                }
                repo.savePlant(plant.copy(nextWaterAt = next.toString()))
            }
        }
    }

    fun deletePlant() {
        viewModelScope.launch {
            repo.deletePlant(plantId)
        }
    }
}

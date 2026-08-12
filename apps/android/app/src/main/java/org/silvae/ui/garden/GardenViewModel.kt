package org.silvae.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.silvae.data.PlantRepository
import org.silvae.data.local.entity.PlantEntity
import org.silvae.domain.care.EnvRepository
import org.silvae.domain.care.SpeciesCatalog
import org.silvae.domain.care.nextWaterAt
import java.time.Instant
import javax.inject.Inject

@HiltViewModel
class GardenViewModel @Inject constructor(
    private val repo: PlantRepository,
    private val catalog: SpeciesCatalog,
    private val envRepository: EnvRepository,
) : ViewModel() {
    val plants: StateFlow<List<PlantEntity>> = repo.observePlants()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Quick "watered" action from the Garden list — recomputes the schedule with the real care engine. */
    fun waterNow(plant: PlantEntity) {
        viewModelScope.launch {
            repo.logCareEvent(plant.id, "water")
            val species = catalog.bySlug(plant.speciesSlug)
            val next = if (species != null) {
                nextWaterAt(
                    species = species,
                    potType = plant.potType,
                    potSizeCm = plant.potSizeCm,
                    soilType = plant.soilType,
                    locationType = plant.locationType,
                    env = envRepository.envFor(plant.locationType),
                    last = Instant.now(),
                ).nextAt
            } else {
                Instant.now().plus(7, java.time.temporal.ChronoUnit.DAYS)
            }
            repo.savePlant(plant.copy(nextWaterAt = next.toString()))
        }
    }
}

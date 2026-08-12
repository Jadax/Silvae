package org.silvae.ui.addplant

import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.silvae.data.PlantRepository
import org.silvae.data.SettingsRepository
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.PlantEntity
import org.silvae.data.remote.IdentifyApi
import org.silvae.domain.care.EnvRepository
import org.silvae.domain.care.Species
import org.silvae.domain.care.SpeciesCatalog
import org.silvae.domain.care.nextWaterAt
import org.silvae.domain.doctor.encodeForIdentify
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import javax.inject.Inject

data class PhotoIdState(
    val busy: Boolean = false,
    val matched: Species? = null,
    val unmatchedName: String? = null,
    val healthy: Boolean? = null,
    val diseaseName: String? = null,
    val error: String? = null,
)

data class AddPlantState(
    val step: Int = 1,
    val name: String = "",
    val speciesQuery: String = "",
    val speciesResults: List<Species> = emptyList(),
    val selectedSpecies: Species? = null,
    val photoId: PhotoIdState = PhotoIdState(),
    val locationType: String = "indoor",
    val potType: String = "plastic",
    val soilType: String = "standard",
    /** Raw text as typed, in whichever unit is currently displayed (cm or in) — converted to cm only at submit time. */
    val potSize: String = "20",
    /** Days ago, 0 = today; null = never / not sure — schedule falls back to species baseline. */
    val lastWateredDaysAgo: Int? = 0,
    val neverWatered: Boolean = false,
    val lastFertilizedDaysAgo: Int? = null,
    val neverFertilized: Boolean = true,
    val error: String? = null,
    val saving: Boolean = false,
    val createdPlantId: String? = null,
)

private const val LAST_STEP = 4

@HiltViewModel
class AddPlantViewModel @Inject constructor(
    private val repo: PlantRepository,
    private val catalog: SpeciesCatalog,
    private val envRepository: EnvRepository,
    private val identifyApi: IdentifyApi,
    settingsRepository: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(AddPlantState())
    val state: StateFlow<AddPlantState> = _state

    val imperial: StateFlow<Boolean> = settingsRepository.observe()
        .map { it?.units == "imperial" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    init {
        viewModelScope.launch { _state.update { it.copy(speciesResults = catalog.all().take(20)) } }
    }

    fun setName(value: String) = _state.update { it.copy(name = value, error = null) }
    fun setLocationType(value: String) = _state.update { it.copy(locationType = value) }
    fun setPotType(value: String) = _state.update { it.copy(potType = value) }
    fun setSoilType(value: String) = _state.update { it.copy(soilType = value) }
    fun setPotSize(value: String) = _state.update { it.copy(potSize = value) }
    fun selectSpecies(species: Species) = _state.update { it.copy(selectedSpecies = species, error = null) }

    fun setLastWatered(daysAgo: Int?, never: Boolean) = _state.update { it.copy(lastWateredDaysAgo = daysAgo, neverWatered = never) }
    fun setLastFertilized(daysAgo: Int?, never: Boolean) = _state.update { it.copy(lastFertilizedDaysAgo = daysAgo, neverFertilized = never) }

    fun setSpeciesQuery(value: String) {
        _state.update { it.copy(speciesQuery = value) }
        viewModelScope.launch {
            val results = catalog.search(value)
            _state.update { it.copy(speciesResults = results) }
        }
    }

    /** Identify from a photo — mirrors AddPlant.tsx's identifyFromPhoto: auto-selects a catalog match, but the user confirms/can change it. */
    fun identifyFromPhoto(resolver: ContentResolver, uri: Uri) {
        _state.update { it.copy(photoId = PhotoIdState(busy = true)) }
        viewModelScope.launch {
            try {
                val payload = withContext(Dispatchers.Default) { encodeForIdentify(resolver, uri) }
                    ?: throw IllegalStateException("We couldn't read that photo.")
                val result = identifyApi.identify(payload.fingerprint, payload.base64DataUri)
                val topName = result.species?.firstOrNull()?.scientificName
                val match = topName?.let { name -> catalog.all().find { it.scientificName.equals(name, ignoreCase = true) } }
                _state.update {
                    it.copy(
                        photoId = PhotoIdState(
                            busy = false,
                            matched = match,
                            unmatchedName = if (match == null) topName else null,
                            healthy = result.isHealthy?.binary,
                            diseaseName = result.disease?.name,
                        ),
                        selectedSpecies = match ?: it.selectedSpecies,
                        speciesQuery = match?.commonNames?.firstOrNull() ?: it.speciesQuery,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(photoId = PhotoIdState(busy = false, error = e.message ?: "Couldn't identify that photo.")) }
            }
        }
    }

    fun next() {
        val s = _state.value
        if (s.step == 1 && s.name.isBlank()) {
            _state.update { it.copy(error = "Give your plant a name first.") }
            return
        }
        if (s.step == 2 && s.selectedSpecies == null) {
            _state.update { it.copy(error = "Choose a plant type so we can make its care plan.") }
            return
        }
        _state.update { it.copy(step = minOf(LAST_STEP, it.step + 1), error = null) }
    }

    fun back() = _state.update { it.copy(step = maxOf(1, it.step - 1)) }

    fun submit() {
        val s = _state.value
        val species = s.selectedSpecies ?: run {
            _state.update { it.copy(error = "Choose a plant type so we can make its care plan.", step = 2) }
            return
        }
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val id = UUID.randomUUID().toString()
            val now = Instant.now()
            val lastWateredAt = if (s.neverWatered) now else now.minus((s.lastWateredDaysAgo ?: 0).toLong(), ChronoUnit.DAYS)

            val potSizeRaw = s.potSize.toDoubleOrNull()
            val potSizeCm = potSizeRaw?.let { if (imperial.value) it * 2.54 else it }
            val schedule = nextWaterAt(
                species = species,
                potType = s.potType,
                potSizeCm = potSizeCm,
                soilType = s.soilType,
                locationType = s.locationType,
                env = envRepository.envFor(s.locationType),
                last = lastWateredAt,
            )
            repo.addPlant(
                PlantEntity(
                    id = id,
                    ownerUid = "local",
                    name = s.name.trim(),
                    speciesSlug = species.slug,
                    locationType = s.locationType,
                    potType = s.potType,
                    soilType = s.soilType,
                    potSizeCm = potSizeCm,
                    plantedAt = now.toString(),
                    nextWaterAt = schedule.nextAt.toString(),
                ),
            )
            // Backfill care history so the timeline reflects what the user told us, not a fake "just created" event.
            if (!s.neverWatered) {
                repo.logCareEventAt(id, "water", lastWateredAt)
            }
            if (!s.neverFertilized && s.lastFertilizedDaysAgo != null) {
                val at = now.minus(s.lastFertilizedDaysAgo.toLong(), ChronoUnit.DAYS)
                repo.logCareEventAt(id, "fertilize", at)
            }
            _state.update { it.copy(saving = false, createdPlantId = id) }
        }
    }
}

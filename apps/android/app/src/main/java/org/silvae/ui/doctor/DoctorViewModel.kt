package org.silvae.ui.doctor

import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.silvae.data.remote.IdentifyApi
import org.silvae.data.remote.IdentifyApiException
import org.silvae.data.remote.IdentifyResponse
import org.silvae.domain.care.Species
import org.silvae.domain.care.SpeciesCatalog
import org.silvae.domain.doctor.Diagnosis
import org.silvae.domain.doctor.PestInfo
import org.silvae.domain.doctor.Symptoms
import org.silvae.domain.doctor.diagnose
import org.silvae.domain.doctor.encodeForIdentify
import org.silvae.domain.doctor.pestFromDiseaseName
import javax.inject.Inject

data class PhotoIdState(
    val busy: Boolean = false,
    val result: IdentifyResponse? = null,
    val matchedSpecies: List<Species> = emptyList(),
    val pest: PestInfo? = null,
    val error: String? = null,
)

data class DoctorUi(
    val photoId: PhotoIdState = PhotoIdState(),
    val symptoms: Symptoms = Symptoms(),
    val results: List<Diagnosis>? = null,
)

@HiltViewModel
class DoctorViewModel @Inject constructor(
    private val identifyApi: IdentifyApi,
    private val catalog: SpeciesCatalog,
) : ViewModel() {
    private val _ui = MutableStateFlow(DoctorUi())
    val ui: StateFlow<DoctorUi> = _ui

    fun identifyPhoto(resolver: ContentResolver, uri: Uri) {
        _ui.update { it.copy(photoId = PhotoIdState(busy = true)) }
        viewModelScope.launch {
            try {
                val payload = withContext(Dispatchers.Default) { encodeForIdentify(resolver, uri) }
                    ?: throw IllegalStateException("We couldn't read that photo.")
                val result = identifyApi.identify(payload.fingerprint, payload.base64DataUri)
                val matches = (result.species ?: emptyList()).mapNotNull { s ->
                    s.scientificName?.let { catalog.all().find { sp -> sp.scientificName.equals(it, ignoreCase = true) } }
                }
                val pest = pestFromDiseaseName(result.disease?.name)
                _ui.update { it.copy(photoId = PhotoIdState(busy = false, result = result, matchedSpecies = matches, pest = pest)) }
            } catch (e: IdentifyApiException) {
                _ui.update { it.copy(photoId = PhotoIdState(busy = false, error = friendlyIdentifyError(e))) }
            } catch (e: Exception) {
                _ui.update { it.copy(photoId = PhotoIdState(busy = false, error = e.message ?: "Identification failed.")) }
            }
        }
    }

    fun updateSymptom(update: (Symptoms) -> Symptoms) = _ui.update { it.copy(symptoms = update(it.symptoms)) }

    fun checkSymptoms() = _ui.update { it.copy(results = diagnose(it.symptoms)) }

    fun reset() = _ui.update { it.copy(symptoms = Symptoms(), results = null) }
}

private fun friendlyIdentifyError(e: IdentifyApiException): String = when (e.code) {
    "no_key" -> "Photo ID isn't set up on this server yet. Try the checklist below."
    "budget_exhausted" -> "Today's identification budget is used up. Try again tomorrow."
    "upstream" -> "The identification service is temporarily unavailable. Try again in a moment."
    "unauthorized" -> "Sign-in expired. Restart the app and try again."
    else -> if (e.status == 429) "Too many requests. Try again in a minute." else "Identification failed. Check your connection and try again."
}

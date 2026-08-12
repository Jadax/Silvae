package org.silvae.ui.plantdetail

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.silvae.data.JournalRepository
import org.silvae.data.PlantRepository
import org.silvae.data.local.entity.PlantPhotoEntity
import javax.inject.Inject

@HiltViewModel
class JournalViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val journalRepo: JournalRepository,
    private val plantRepo: PlantRepository,
) : ViewModel() {
    private val plantId: String = checkNotNull(savedStateHandle["plantId"])

    val entries: StateFlow<List<PlantPhotoEntity>> = journalRepo.observeEntries(plantId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun addPhoto(uri: Uri) = viewModelScope.launch { journalRepo.addPhoto(plantId, uri) }
    fun addNote(text: String) = viewModelScope.launch { if (text.isNotBlank()) journalRepo.addNote(plantId, text) }
    fun setNote(entry: PlantPhotoEntity, text: String) = viewModelScope.launch { journalRepo.setNote(entry, text) }
    fun addComment(entryId: String, text: String) = viewModelScope.launch { if (text.isNotBlank()) journalRepo.addComment(entryId, text) }
    fun deleteEntry(entry: PlantPhotoEntity) = viewModelScope.launch { journalRepo.deleteEntry(entry) }

    fun setAvatar(entry: PlantPhotoEntity) {
        viewModelScope.launch {
            val path = entry.localPath ?: return@launch
            val plant = plantRepo.getPlantOnce(plantId) ?: return@launch
            plantRepo.setAvatar(plant, path)
        }
    }

    fun commentsFor(entryId: String) = journalRepo.observeComments(entryId)
}

package org.silvae.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import org.silvae.data.local.dao.CareEventDao
import org.silvae.data.local.dao.PlantDao
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.PlantEntity
import org.silvae.data.sync.CloudSync
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local-first plant repository: Room is the source of truth and every change
 * is handed to [CloudSync], which mirrors it to Firestore (queued while
 * offline) so the same account sees it on the web and other phones.
 */
@Singleton
class PlantRepository @Inject constructor(
    private val plantDao: PlantDao,
    private val careEventDao: CareEventDao,
    private val journalRepository: JournalRepository,
    private val sync: CloudSync,
) {
    fun observePlants(): Flow<List<PlantEntity>> = plantDao.observeAll()
    fun observePlant(id: String): Flow<PlantEntity?> = plantDao.observeById(id)
    fun observeCareEvents(plantId: String, limit: Int = 50): Flow<List<CareEventEntity>> =
        careEventDao.observeForPlant(plantId, limit)

    suspend fun addPlant(plant: PlantEntity) = savePlant(plant)

    suspend fun savePlant(plant: PlantEntity) {
        plantDao.upsert(plant.copy(rev = System.currentTimeMillis().toString()))
        sync.plantChanged(plant.id)
    }

    /** Removes the plant everywhere, with its care history and journal. */
    suspend fun deletePlant(id: String) {
        careEventDao.idsForPlant(id).forEach { sync.eventDeleted(it) }
        careEventDao.deleteForPlant(id)
        journalRepository.deleteAllForPlant(id)
        plantDao.deleteById(id)
        sync.plantDeleted(id)
    }

    suspend fun logCareEvent(plantId: String, type: String, note: String? = null) =
        logCareEventAt(plantId, type, Instant.now(), note)

    /** Logs a care event at a specific time, e.g. "I watered it 3 days ago" during Add Plant. */
    suspend fun logCareEventAt(plantId: String, type: String, at: Instant, note: String? = null) {
        val event = CareEventEntity(id = UUID.randomUUID().toString(), plantId = plantId, type = type, at = at.toString(), note = note)
        careEventDao.insert(event)
        sync.eventChanged(event.id)
    }

    suspend fun lastCare(plantId: String, type: String): CareEventEntity? = careEventDao.latest(plantId, type)

    suspend fun getPlantOnce(id: String): PlantEntity? = observePlant(id).first()

    suspend fun setAvatar(plant: PlantEntity, localPath: String) {
        savePlant(plant.copy(avatarPhotoUrl = localPath))
    }

    /**
     * Deletes every plant this account owns, locally and in Firestore: the
     * data half of account deletion (Google Play requires apps that support
     * account creation to support deleting the account's data).
     */
    suspend fun deleteAllMyPlants() {
        for (plant in plantDao.all()) deletePlant(plant.id)
    }
}

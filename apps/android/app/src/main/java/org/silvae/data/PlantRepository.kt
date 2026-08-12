package org.silvae.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.silvae.auth.AuthRepository
import org.silvae.data.local.dao.CareEventDao
import org.silvae.data.local.dao.PendingWriteDao
import org.silvae.data.local.dao.PlantDao
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.PendingWriteEntity
import org.silvae.data.local.entity.PlantEntity
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local-first plant repository — Room is the source of truth, Firestore is a
 * best-effort sync mirror queued through `pending_writes` when offline.
 * Direct port of the pattern in apps/web/src/lib/repo.ts (addPlant/savePlant/
 * mirrorPlant/flushPendingWrites), including the newest-`rev`-wins rule.
 */
@Singleton
class PlantRepository @Inject constructor(
    private val plantDao: PlantDao,
    private val careEventDao: CareEventDao,
    private val pendingWriteDao: PendingWriteDao,
    private val firestore: FirebaseFirestore,
    private val authRepository: AuthRepository,
    private val journalRepository: JournalRepository,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun observePlants(): Flow<List<PlantEntity>> = plantDao.observeAll()
    fun observePlant(id: String): Flow<PlantEntity?> = plantDao.observeById(id)
    fun observeCareEvents(plantId: String, limit: Int = 50): Flow<List<CareEventEntity>> =
        careEventDao.observeForPlant(plantId, limit)

    suspend fun addPlant(plant: PlantEntity) {
        val withRev = plant.copy(rev = System.currentTimeMillis().toString())
        plantDao.upsert(withRev)
        mirror(withRev)
    }

    suspend fun savePlant(plant: PlantEntity) {
        val withRev = plant.copy(rev = System.currentTimeMillis().toString())
        plantDao.upsert(withRev)
        mirror(withRev)
    }

    suspend fun deletePlant(id: String) {
        plantDao.deleteById(id)
        careEventDao.deleteForPlant(id)
        journalRepository.deleteAllForPlant(id)
        mirrorDelete(id)
    }

    suspend fun logCareEvent(plantId: String, type: String, note: String? = null) {
        careEventDao.insert(CareEventEntity(id = UUID.randomUUID().toString(), plantId = plantId, type = type, at = java.time.Instant.now().toString(), note = note))
    }

    /** Backfills a care event at a specific time — used when the user tells us "I watered it 3 days ago" during Add Plant. */
    suspend fun logCareEventAt(plantId: String, type: String, at: java.time.Instant, note: String? = null) {
        careEventDao.insert(CareEventEntity(id = UUID.randomUUID().toString(), plantId = plantId, type = type, at = at.toString(), note = note))
    }

    private suspend fun mirror(plant: PlantEntity) {
        val uid = authRepository.currentUser?.uid
        if (uid == null) {
            pendingWriteDao.upsert(PendingWriteEntity(id = plant.id, kind = "plant-upsert", payloadJson = json.encodeToString(plant)))
            return
        }
        try {
            firestore.collection("plants").document(plant.id)
                .set(toCloudMap(plant, uid), SetOptions.merge()).await()
        } catch (_: Exception) {
            pendingWriteDao.upsert(PendingWriteEntity(id = plant.id, kind = "plant-upsert", payloadJson = json.encodeToString(plant)))
        }
    }

    private suspend fun mirrorDelete(id: String) {
        val uid = authRepository.currentUser?.uid
        if (uid == null) {
            pendingWriteDao.upsert(PendingWriteEntity(id = id, kind = "plant-delete"))
            return
        }
        try {
            firestore.collection("plants").document(id).delete().await()
        } catch (_: Exception) {
            pendingWriteDao.upsert(PendingWriteEntity(id = id, kind = "plant-delete"))
        }
    }

    /** Upload every queued write — call when the app regains connectivity or signs in. */
    suspend fun flushPendingWrites() {
        val uid = authRepository.currentUser?.uid ?: return
        for (write in pendingWriteDao.all()) {
            try {
                if (write.kind == "plant-upsert" && write.payloadJson != null) {
                    val plant = json.decodeFromString<PlantEntity>(write.payloadJson)
                    firestore.collection("plants").document(write.id).set(toCloudMap(plant, uid), SetOptions.merge()).await()
                } else if (write.kind == "plant-delete") {
                    firestore.collection("plants").document(write.id).delete().await()
                }
                pendingWriteDao.deleteById(write.id)
            } catch (_: Exception) {
                // keep queued, retry next flush
            }
        }
    }

    private fun toCloudMap(plant: PlantEntity, uid: String): Map<String, Any?> = buildMap {
        put("uid", uid)
        put("speciesSlug", plant.speciesSlug)
        put("name", plant.name)
        put("potType", plant.potType)
        put("soilType", plant.soilType)
        plant.rev?.let { put("rev", it) }
        plant.potSizeCm?.let { put("potSizeCm", it) }
        plant.locationType?.let { put("locationType", it) }
        plant.spotName?.let { put("spotName", it) }
        plant.notes?.let { put("notes", it) }
        plant.nextWaterAt?.let { put("schedule", mapOf("nextWaterAt" to it)) }
        plant.plantedAt?.let { put("createdAt", it) }
    }

    suspend fun getPlantOnce(id: String): PlantEntity? = observePlant(id).first()

    suspend fun setAvatar(plant: PlantEntity, localPath: String) {
        savePlant(plant.copy(avatarPhotoUrl = localPath))
    }

    /**
     * Deletes every plant this account owns, locally and in Firestore — the
     * data half of account deletion (Google Play requires apps that support
     * account creation to support deleting the account's data, not just
     * signing out). Journal photo files and settings are cleared separately
     * by the caller (JournalRepository / SettingsRepository own those).
     */
    suspend fun deleteAllMyPlants() {
        for (plant in observePlants().first()) deletePlant(plant.id)
    }
}

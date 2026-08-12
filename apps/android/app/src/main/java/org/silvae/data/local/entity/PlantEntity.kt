package org.silvae.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/**
 * Local-first plant row — mirrors `PlantRow` in apps/web/src/lib/db.ts /
 * `Plant` in packages/core/src/dto/plant.ts. `rev` is a millis timestamp used
 * for newest-wins conflict resolution against the Firestore mirror (repo.ts).
 */
@Serializable
@Entity(tableName = "plants")
data class PlantEntity(
    @PrimaryKey val id: String,
    val ownerUid: String,
    val name: String,
    val speciesSlug: String,
    val avatarPhotoUrl: String? = null,
    val locationType: String? = null, // "indoor" | "outdoor"
    val roomId: String? = null,
    val spotName: String? = null,
    val potType: String = "plastic",
    val potSizeCm: Double? = null,
    val soilType: String = "standard",
    val plantedAt: String? = null, // ISO-8601
    val notes: String? = null,
    val nextWaterAt: String? = null, // ISO-8601
    val careLevel: Int? = null,
    val rev: String? = null,
)

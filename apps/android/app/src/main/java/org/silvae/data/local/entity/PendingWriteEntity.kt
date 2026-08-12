package org.silvae.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Queued offline write, flushed to Firestore once back online — mirrors
 * `PendingWrite` (apps/web/src/lib/db.ts) and the flush logic in repo.ts.
 * `payloadJson` holds the serialized PlantEntity for upserts; null for deletes.
 */
@Entity(tableName = "pending_writes")
data class PendingWriteEntity(
    @PrimaryKey val id: String, // == plant id (upsert supersedes delete and vice versa)
    val kind: String, // "plant-upsert" | "plant-delete"
    val payloadJson: String? = null,
    val at: Long = System.currentTimeMillis(),
)

package org.silvae.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** Mirrors `CareEventRow` (apps/web/src/lib/db.ts) / `CareEvent` (packages/core/src/dto/care.ts). */
@Entity(
    tableName = "care_events",
    indices = [Index(value = ["plantId", "at"])],
)
data class CareEventEntity(
    @PrimaryKey val id: String,
    val plantId: String,
    val type: String, // water | mist | fertilize | biostimulate | repot | prune | rotate | clean
    val at: String, // ISO-8601
    val note: String? = null,
)

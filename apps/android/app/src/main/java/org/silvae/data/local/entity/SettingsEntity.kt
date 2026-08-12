package org.silvae.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Single-row settings, mirroring `SettingsRow` (apps/web/src/lib/db.ts). */
@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: String = "profile",
    val petCat: Boolean = false,
    val petDog: Boolean = false,
    val locationLat: Double? = null,
    val locationLon: Double? = null,
    val locationLabel: String? = null,
    val onboarded: Boolean = false,
    val units: String = "metric", // "metric" | "imperial"
)

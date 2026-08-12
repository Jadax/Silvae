package org.silvae.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** Journal entry: a dated photo, a text note, or both. Mirrors `PlantPhoto` (apps/web/src/lib/db.ts). */
@Entity(
    tableName = "plant_photos",
    indices = [Index(value = ["plantId", "at"])],
)
data class PlantPhotoEntity(
    @PrimaryKey val id: String,
    val plantId: String,
    val at: String, // ISO-8601
    val localPath: String? = null, // file:// path in app-private storage
    val remoteUrl: String? = null,
    val kind: String = "photo", // "photo" | "note"
    val note: String? = null,
)

/** A comment on a journal entry — its own table (1:N), mirroring `JournalComment[]` on the web row. */
@Entity(
    tableName = "journal_comments",
    indices = [Index(value = ["entryId"])],
)
data class JournalCommentEntity(
    @PrimaryKey val id: String,
    val entryId: String,
    val at: String,
    val text: String,
)

package org.silvae.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import org.silvae.data.local.dao.CareEventDao
import org.silvae.data.local.dao.PendingWriteDao
import org.silvae.data.local.dao.PlantDao
import org.silvae.data.local.dao.PlantPhotoDao
import org.silvae.data.local.dao.SettingsDao
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.JournalCommentEntity
import org.silvae.data.local.entity.PendingWriteEntity
import org.silvae.data.local.entity.PlantEntity
import org.silvae.data.local.entity.PlantPhotoEntity
import org.silvae.data.local.entity.SettingsEntity

/** Local-first source of truth (blueprint A3) — Firestore is a sync mirror, not primary storage. */
@Database(
    entities = [
        PlantEntity::class,
        CareEventEntity::class,
        PlantPhotoEntity::class,
        JournalCommentEntity::class,
        PendingWriteEntity::class,
        SettingsEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
abstract class SilvaeDatabase : RoomDatabase() {
    abstract fun plantDao(): PlantDao
    abstract fun careEventDao(): CareEventDao
    abstract fun plantPhotoDao(): PlantPhotoDao
    abstract fun pendingWriteDao(): PendingWriteDao
    abstract fun settingsDao(): SettingsDao
}

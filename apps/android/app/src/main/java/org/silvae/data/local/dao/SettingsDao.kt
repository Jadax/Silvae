package org.silvae.data.local.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import org.silvae.data.local.entity.SettingsEntity

@Dao
interface SettingsDao {
    @Query("SELECT * FROM settings WHERE id = 'profile'")
    fun observe(): Flow<SettingsEntity?>

    @Query("SELECT * FROM settings WHERE id = 'profile'")
    suspend fun get(): SettingsEntity?

    @Upsert
    suspend fun upsert(settings: SettingsEntity)
}

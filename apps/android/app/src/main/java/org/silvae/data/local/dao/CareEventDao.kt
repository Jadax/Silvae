package org.silvae.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.silvae.data.local.entity.CareEventEntity

@Dao
interface CareEventDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(event: CareEventEntity)

    @Query("SELECT * FROM care_events WHERE plantId = :plantId ORDER BY at DESC LIMIT :limit")
    fun observeForPlant(plantId: String, limit: Int = 50): Flow<List<CareEventEntity>>

    @Query("SELECT * FROM care_events WHERE plantId = :plantId AND type = 'water' ORDER BY at DESC LIMIT 1")
    suspend fun lastWater(plantId: String): CareEventEntity?

    @Query("SELECT * FROM care_events ORDER BY at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 400): Flow<List<CareEventEntity>>

    @Query("DELETE FROM care_events WHERE plantId = :plantId")
    suspend fun deleteForPlant(plantId: String)
}

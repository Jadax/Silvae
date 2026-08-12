package org.silvae.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import org.silvae.data.local.entity.PlantEntity

@Dao
interface PlantDao {
    @Query("SELECT * FROM plants ORDER BY name COLLATE NOCASE")
    fun observeAll(): Flow<List<PlantEntity>>

    @Query("SELECT * FROM plants WHERE id = :id")
    suspend fun getById(id: String): PlantEntity?

    @Query("SELECT * FROM plants WHERE id = :id")
    fun observeById(id: String): Flow<PlantEntity?>

    @Upsert
    suspend fun upsert(plant: PlantEntity)

    @Query("DELETE FROM plants WHERE id = :id")
    suspend fun deleteById(id: String)

    @Delete
    suspend fun delete(plant: PlantEntity)
}

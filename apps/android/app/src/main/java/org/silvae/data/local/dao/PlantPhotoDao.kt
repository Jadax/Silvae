package org.silvae.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import org.silvae.data.local.entity.JournalCommentEntity
import org.silvae.data.local.entity.PlantPhotoEntity

@Dao
interface PlantPhotoDao {
    @Query("SELECT * FROM plant_photos WHERE plantId = :plantId ORDER BY at DESC LIMIT :limit")
    fun observeForPlant(plantId: String, limit: Int = 200): Flow<List<PlantPhotoEntity>>

    @Query("SELECT * FROM plant_photos WHERE plantId = :plantId")
    suspend fun getForPlant(plantId: String): List<PlantPhotoEntity>

    @Upsert
    suspend fun upsert(photo: PlantPhotoEntity)

    @Query("DELETE FROM plant_photos WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM journal_comments WHERE entryId IN (SELECT id FROM plant_photos WHERE plantId = :plantId)")
    suspend fun deleteCommentsForPlant(plantId: String)

    @Query("DELETE FROM plant_photos WHERE plantId = :plantId")
    suspend fun deleteForPlant(plantId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertComment(comment: JournalCommentEntity)

    @Query("SELECT * FROM journal_comments WHERE entryId = :entryId ORDER BY at ASC")
    fun observeComments(entryId: String): Flow<List<JournalCommentEntity>>

    @Delete
    suspend fun deletePhoto(photo: PlantPhotoEntity)
}

package org.silvae.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Query
import androidx.room.Upsert
import org.silvae.data.local.entity.PendingWriteEntity

@Dao
interface PendingWriteDao {
    @Upsert
    suspend fun upsert(write: PendingWriteEntity)

    @Query("SELECT * FROM pending_writes ORDER BY at ASC")
    suspend fun all(): List<PendingWriteEntity>

    @Query("DELETE FROM pending_writes WHERE id = :id")
    suspend fun deleteById(id: String)

    @Delete
    suspend fun delete(write: PendingWriteEntity)
}

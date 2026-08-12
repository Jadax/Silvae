package org.silvae.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import org.silvae.data.local.dao.PlantPhotoDao
import org.silvae.data.local.entity.JournalCommentEntity
import org.silvae.data.local.entity.PlantPhotoEntity
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max
import kotlin.math.min

/** Photo/note journal — mirrors apps/web/src/lib/photos.ts, storing images in app-private files instead of IndexedDB data URLs. */
@Singleton
class JournalRepository @Inject constructor(
    private val dao: PlantPhotoDao,
    @ApplicationContext private val context: Context,
) {
    fun observeEntries(plantId: String): Flow<List<PlantPhotoEntity>> = dao.observeForPlant(plantId)
    fun observeComments(entryId: String): Flow<List<JournalCommentEntity>> = dao.observeComments(entryId)

    suspend fun addPhoto(plantId: String, uri: Uri) = withContext(Dispatchers.IO) {
        val path = copyIntoJournalStorage(plantId, uri) ?: return@withContext
        dao.upsert(PlantPhotoEntity(id = UUID.randomUUID().toString(), plantId = plantId, at = Instant.now().toString(), localPath = path, kind = "photo"))
    }

    suspend fun addNote(plantId: String, text: String) {
        dao.upsert(PlantPhotoEntity(id = UUID.randomUUID().toString(), plantId = plantId, at = Instant.now().toString(), kind = "note", note = text))
    }

    suspend fun setNote(entry: PlantPhotoEntity, text: String) {
        dao.upsert(entry.copy(note = text))
    }

    suspend fun addComment(entryId: String, text: String) {
        dao.insertComment(JournalCommentEntity(id = UUID.randomUUID().toString(), entryId = entryId, at = Instant.now().toString(), text = text))
    }

    suspend fun deleteEntry(entry: PlantPhotoEntity) {
        entry.localPath?.let { runCatching { File(it).delete() } }
        dao.deletePhoto(entry)
    }

    /** Removes every journal entry (and their files/comments) for a deleted plant. */
    suspend fun deleteAllForPlant(plantId: String) = withContext(Dispatchers.IO) {
        for (entry in dao.getForPlant(plantId)) entry.localPath?.let { runCatching { File(it).delete() } }
        dao.deleteCommentsForPlant(plantId)
        dao.deleteForPlant(plantId)
        runCatching { File(context.filesDir, "journal/$plantId").deleteRecursively() }
    }

    /** Downscale to a reasonable journal size (max 1600px, JPEG q85) and copy into app-private storage. */
    private fun copyIntoJournalStorage(plantId: String, uri: Uri): String? {
        val bitmap = context.contentResolver.openInputStream(uri)?.use { input ->
            val bytes = input.readBytes()
            val orientation = runCatching {
                ExifInterface(bytes.inputStream()).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
            val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@use null
            applyExifRotation(decoded, orientation)
        } ?: return null

        val maxDim = 1600
        val scale = min(1f, maxDim.toFloat() / max(bitmap.width, bitmap.height))
        val target = if (scale < 1f) Bitmap.createScaledBitmap(bitmap, max(1, (bitmap.width * scale).toInt()), max(1, (bitmap.height * scale).toInt()), true) else bitmap

        val dir = File(context.filesDir, "journal/$plantId").apply { mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}.jpg")
        FileOutputStream(file).use { out -> target.compress(Bitmap.CompressFormat.JPEG, 85, out) }
        return file.absolutePath
    }

    private fun applyExifRotation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = android.graphics.Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }
}

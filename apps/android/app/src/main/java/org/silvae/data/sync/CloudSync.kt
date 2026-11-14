package org.silvae.data.sync

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import com.google.firebase.Timestamp
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.silvae.auth.AuthRepository
import org.silvae.data.local.SilvaeDatabase
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.data.local.entity.JournalCommentEntity
import org.silvae.data.local.entity.PendingWriteEntity
import org.silvae.data.local.entity.PlantEntity
import org.silvae.data.local.entity.PlantPhotoEntity
import java.io.ByteArrayOutputStream
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max
import kotlin.math.min

/**
 * Two-way Firestore mirror for everything a person keeps in Silvae: plants,
 * care history, journal entries + photos, and synced preferences (pets).
 * Room stays the source of truth; every local change is queued in
 * `pending_writes` (keys `plant:`, `event:`, `photo:`, `blob:`) and pushed in
 * the background, and live listeners pull changes from other devices.
 *
 * Document shapes match apps/web/src/lib/repo.ts exactly so the web app and
 * this app share one account's data.
 */
@Singleton
class CloudSync @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: AuthRepository,
    private val db: SilvaeDatabase,
    @ApplicationContext private val context: Context,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val applyLock = Mutex()
    private val plantDao get() = db.plantDao()
    private val eventDao get() = db.careEventDao()
    private val photoDao get() = db.plantPhotoDao()
    private val pendingDao get() = db.pendingWriteDao()
    private val settingsDao get() = db.settingsDao()
    private val prefs get() = context.getSharedPreferences("silvae-sync", Context.MODE_PRIVATE)

    private var listeners: List<ListenerRegistration> = emptyList()
    private var activeUid: String? = null

    /** Follow the signed-in account for the life of the app. Call once from Application.onCreate. */
    fun bind() {
        scope.launch {
            auth.authState().collect { user ->
                if (user == null) stop() else start(user.uid)
            }
        }
    }

    private suspend fun start(uid: String) {
        if (activeUid == uid) return
        stop()
        claimDevice(uid)
        activeUid = uid
        backfillOnce(uid)
        listen(uid)
        flush()
    }

    private fun stop() {
        listeners.forEach { it.remove() }
        listeners = emptyList()
        activeUid = null
    }

    // ---------------------------------------------------------------- queue

    fun plantChanged(id: String) = queue("plant-upsert", id)
    fun plantDeleted(id: String) = queue("plant-delete", id)
    fun eventChanged(id: String) = queue("event-upsert", id)
    fun eventDeleted(id: String) = queue("event-delete", id)
    fun journalChanged(id: String, imageChanged: Boolean = false) {
        queue("photo-upsert", id)
        if (imageChanged) queue("photo-blob", id)
    }
    fun journalDeleted(id: String) = queue("photo-delete", id)

    /** Pets follow the account (location deliberately stays on this device). */
    fun petsChanged(cat: Boolean, dog: Boolean) {
        val uid = auth.currentUser?.uid ?: return
        scope.launch {
            runCatching {
                firestore.collection("users").document(uid)
                    .set(mapOf("prefs" to mapOf("pets" to mapOf("cat" to cat, "dog" to dog))), SetOptions.merge()).await()
            }
        }
    }

    private fun keyFor(kind: String, id: String): String =
        (if (kind == "photo-blob") "blob" else kind.substringBefore('-')) + ":" + id

    private fun queue(kind: String, id: String) {
        scope.launch {
            val key = keyFor(kind, id)
            pendingDao.upsert(PendingWriteEntity(id = key, kind = kind))
            pushQueued(key, kind, id)
        }
    }

    /** Upload everything still queued (after sign-in, or a previous run that ended offline). */
    suspend fun flush() {
        if (auth.currentUser == null) return
        for (write in pendingDao.all()) {
            val entityId = if (write.id.contains(':')) write.id.substringAfter(':') else write.id
            pushQueued(write.id, write.kind, entityId)
        }
    }

    /** Edits not yet confirmed by the server after a short attempt to send them. */
    suspend fun unsyncedCount(): Int {
        withTimeoutOrNull(5_000) { flush() }
        return pendingDao.count()
    }

    private suspend fun pushQueued(key: String, kind: String, id: String) {
        val uid = auth.currentUser?.uid ?: return
        try {
            push(uid, kind, id)
            pendingDao.deleteById(key)
        } catch (_: Exception) {
            // Stays queued; retried on the next flush.
        }
    }

    private suspend fun push(uid: String, kind: String, id: String) {
        when (kind) {
            "plant-upsert" -> plantDao.getById(id)?.let {
                firestore.collection("plants").document(id).set(toCloudPlant(it, uid), SetOptions.merge()).await()
            }
            "plant-delete" -> firestore.collection("plants").document(id).delete().await()
            "event-upsert" -> eventDao.getById(id)?.let {
                firestore.collection("care_events").document(id).set(toCloudEvent(it, uid)).await()
            }
            "event-delete" -> firestore.collection("care_events").document(id).delete().await()
            "photo-upsert" -> photoDao.getById(id)?.let {
                firestore.collection("photos").document(id).set(toCloudPhoto(it, photoDao.commentsFor(id), uid)).await()
            }
            "photo-blob" -> photoDao.getById(id)?.localPath?.let { path ->
                val dataUrl = encodeImage(File(path), maxDim = 960, maxBytes = 360 * 1024) ?: return
                firestore.collection("photo_blobs").document(id)
                    .set(mapOf("uid" to uid, "plantId" to photoDao.getById(id)!!.plantId, "dataUrl" to dataUrl)).await()
            }
            "photo-delete" -> {
                firestore.collection("photo_blobs").document(id).delete().await()
                firestore.collection("photos").document(id).delete().await()
            }
        }
    }

    // ------------------------------------------------------- document shapes

    private fun toCloudPlant(plant: PlantEntity, uid: String): Map<String, Any?> = buildMap {
        put("uid", uid)
        put("speciesSlug", plant.speciesSlug)
        put("name", plant.name)
        put("potType", plant.potType)
        put("soilType", plant.soilType)
        put("updatedAt", com.google.firebase.firestore.FieldValue.serverTimestamp())
        plant.rev?.let { put("rev", it) }
        plant.potSizeCm?.let { put("potSizeCm", it) }
        plant.locationType?.let { put("locationType", it) }
        plant.spotName?.let { put("spotName", it) }
        plant.notes?.let { put("notes", it) }
        plant.nextWaterAt?.let { put("schedule", mapOf("nextWaterAt" to it)) }
        plant.plantedAt?.let { put("createdAt", it) }
        // A small thumbnail rides on the plant so the other devices can show it.
        plant.avatarPhotoUrl?.takeIf { !it.startsWith("data:") && !it.startsWith("http") }?.let { path ->
            encodeImage(File(path), maxDim = 320, maxBytes = 40 * 1024)?.let { put("avatarPhotoUrl", it) }
        }
    }

    private fun toCloudEvent(e: CareEventEntity, uid: String): Map<String, Any?> = buildMap {
        put("uid", uid)
        put("plantId", e.plantId)
        put("type", e.type)
        put("at", e.at)
        e.note?.let { put("note", it) }
    }

    private fun toCloudPhoto(p: PlantPhotoEntity, comments: List<JournalCommentEntity>, uid: String): Map<String, Any?> = buildMap {
        put("uid", uid)
        put("plantId", p.plantId)
        put("at", p.at)
        put("kind", p.kind)
        put("hasImage", p.kind == "photo")
        p.note?.takeIf { it.isNotBlank() }?.let { put("note", it) }
        if (comments.isNotEmpty()) put("comments", comments.map { mapOf("id" to it.id, "at" to it.at, "text" to it.text) })
    }

    // ------------------------------------------------------------------ pull

    private fun listen(uid: String) {
        fun mine(name: String) = firestore.collection(name).whereEqualTo("uid", uid)
        listeners = listOf(
            mine("plants").addSnapshotListener { snap, _ ->
                snap ?: return@addSnapshotListener
                scope.launch { applyLock.withLock { snap.documentChanges.forEach { applyPlant(it) } } }
            },
            mine("care_events").addSnapshotListener { snap, _ ->
                snap ?: return@addSnapshotListener
                scope.launch { applyLock.withLock { snap.documentChanges.forEach { applyEvent(it) } } }
            },
            mine("photos").addSnapshotListener { snap, _ ->
                snap ?: return@addSnapshotListener
                scope.launch {
                    val downloads = applyLock.withLock { snap.documentChanges.mapNotNull { applyPhoto(it) } }
                    downloads.forEach { downloadImage(it) }
                }
            },
            firestore.collection("users").document(uid).addSnapshotListener { snap, _ ->
                @Suppress("UNCHECKED_CAST")
                val pets = (snap?.get("prefs") as? Map<String, Any?>)?.get("pets") as? Map<String, Any?> ?: return@addSnapshotListener
                scope.launch {
                    val current = settingsDao.get() ?: org.silvae.data.local.entity.SettingsEntity()
                    settingsDao.upsert(current.copy(petCat = pets["cat"] == true, petDog = pets["dog"] == true))
                }
            },
        )
    }

    private suspend fun isQueued(group: String, id: String): Boolean =
        pendingDao.get("$group:$id") != null || (group == "plant" && pendingDao.get(id) != null)

    private suspend fun applyPlant(change: DocumentChange) {
        val doc = change.document
        val id = doc.id
        if (change.type == DocumentChange.Type.REMOVED) {
            pendingDao.deleteById("plant:$id")
            plantDao.deleteById(id)
            return
        }
        if (isQueued("plant", id)) return
        val local = plantDao.getById(id)
        val rev = doc.getString("rev")
        if (local?.rev != null && rev != null && (rev.toLongOrNull() ?: 0) <= (local.rev.toLongOrNull() ?: 0)) return
        val cloudAvatar = doc.getString("avatarPhotoUrl")
        val avatar = when {
            cloudAvatar == null -> local?.avatarPhotoUrl
            cloudAvatar.startsWith("data:") -> saveDataUrl(cloudAvatar, File(context.filesDir, "avatars"), "$id-${rev ?: "0"}") ?: local?.avatarPhotoUrl
            else -> cloudAvatar
        }
        plantDao.upsert(
            PlantEntity(
                id = id,
                ownerUid = doc.getString("uid") ?: "",
                name = doc.getString("name") ?: "Plant",
                speciesSlug = doc.getString("speciesSlug") ?: "",
                avatarPhotoUrl = avatar,
                locationType = doc.getString("locationType")?.takeIf { it == "indoor" || it == "outdoor" },
                roomId = doc.getString("roomId"),
                spotName = doc.getString("spotName"),
                potType = doc.getString("potType") ?: "plastic",
                potSizeCm = doc.getDouble("potSizeCm"),
                soilType = doc.getString("soilType") ?: "standard",
                plantedAt = doc.getString("createdAt"),
                notes = doc.getString("notes"),
                nextWaterAt = (doc.get("schedule") as? Map<*, *>)?.get("nextWaterAt") as? String,
                rev = rev,
            ),
        )
    }

    private suspend fun applyEvent(change: DocumentChange) {
        val doc = change.document
        if (isQueued("event", doc.id)) return
        if (change.type == DocumentChange.Type.REMOVED) {
            eventDao.deleteById(doc.id)
            return
        }
        cloudEvent(doc)?.let { eventDao.insert(it) }
    }

    /** Accepts current docs and the older web shape (upper-case type, timestamp `at`, `notes`). */
    private fun cloudEvent(doc: DocumentSnapshot): CareEventEntity? {
        val type = doc.getString("type")?.lowercase() ?: return null
        if (type !in CARE_TYPES) return null
        val plantId = doc.getString("plantId") ?: return null
        val at = doc.getString("at") ?: (doc.get("at") as? Timestamp)?.toDate()?.toInstant()?.toString() ?: return null
        return CareEventEntity(id = doc.id, plantId = plantId, type = type, at = at, note = doc.getString("note") ?: doc.getString("notes"))
    }

    /** Applies a journal entry; returns its id when the image still has to be downloaded. */
    private suspend fun applyPhoto(change: DocumentChange): String? {
        val doc = change.document
        val id = doc.id
        if (isQueued("photo", id)) return null
        val local = photoDao.getById(id)
        if (change.type == DocumentChange.Type.REMOVED) {
            local?.localPath?.let { runCatching { File(it).delete() } }
            photoDao.deleteCommentsFor(id)
            photoDao.deleteById(id)
            return null
        }
        val plantId = doc.getString("plantId") ?: return null
        val at = doc.getString("at") ?: return null
        val kind = if (doc.getString("kind") == "note") "note" else "photo"
        photoDao.upsert(PlantPhotoEntity(id = id, plantId = plantId, at = at, localPath = local?.localPath, kind = kind, note = doc.getString("note")))
        photoDao.deleteCommentsFor(id)
        (doc.get("comments") as? List<*>)?.forEach { raw ->
            val c = raw as? Map<*, *> ?: return@forEach
            val text = c["text"] as? String ?: return@forEach
            photoDao.insertComment(JournalCommentEntity(id = c["id"] as? String ?: "$id-${text.hashCode()}", entryId = id, at = c["at"] as? String ?: at, text = text))
        }
        return if (kind == "photo" && doc.getBoolean("hasImage") == true && local?.localPath == null) id else null
    }

    private suspend fun downloadImage(id: String) {
        try {
            val dataUrl = firestore.collection("photo_blobs").document(id).get().await().getString("dataUrl") ?: return
            val entry = photoDao.getById(id) ?: return
            val path = saveDataUrl(dataUrl, File(context.filesDir, "journal/${entry.plantId}"), id) ?: return
            photoDao.upsert(entry.copy(localPath = path))
        } catch (_: Exception) {
            // Retried next time the listener reports this entry.
        }
    }

    // -------------------------------------------------------- device hygiene

    /**
     * Local data belongs to whoever last signed in here. If someone else
     * signs in, start clean so one person's plants never upload into another
     * person's account.
     */
    private suspend fun claimDevice(uid: String) {
        val owner = prefs.getString(OWNER_KEY, null)
        if (owner != null && owner != uid) wipeLocal()
        prefs.edit().putString(OWNER_KEY, uid).apply()
    }

    /** Local rows created before sync covered care history and the journal: upload them once. */
    private suspend fun backfillOnce(uid: String) {
        val key = "backfill-v2:$uid"
        if (prefs.getString(key, null) != null) return
        plantDao.all().forEach { pendingDao.upsert(PendingWriteEntity(id = "plant:${it.id}", kind = "plant-upsert")) }
        eventDao.all().forEach { pendingDao.upsert(PendingWriteEntity(id = "event:${it.id}", kind = "event-upsert")) }
        photoDao.all().forEach {
            pendingDao.upsert(PendingWriteEntity(id = "photo:${it.id}", kind = "photo-upsert"))
            if (it.localPath != null) pendingDao.upsert(PendingWriteEntity(id = "blob:${it.id}", kind = "photo-blob"))
        }
        prefs.edit().putString(key, java.time.Instant.now().toString()).apply()
    }

    /**
     * Account deletion: remove every document this account owns in the cloud
     * (straight from Firestore, so nothing is missed even if this device never
     * downloaded it), then forget everything locally.
     */
    suspend fun deleteAllCloudData() {
        val uid = auth.currentUser?.uid ?: return
        stop()
        for (name in listOf("photo_blobs", "photos", "care_events", "plants")) {
            val docs = firestore.collection(name).whereEqualTo("uid", uid).get().await().documents
            docs.chunked(400).forEach { chunk ->
                firestore.batch().apply { chunk.forEach { delete(it.reference) } }.commit().await()
            }
        }
        firestore.collection("users").document(uid).delete().await()
        wipeLocal()
    }

    /** Re-attach listeners after an interrupted account deletion. */
    fun resume() {
        val uid = auth.currentUser?.uid ?: return
        scope.launch { start(uid) }
    }

    /** Sign-out on this device: stop listening and forget every local row and photo. */
    suspend fun signOutAndWipe() {
        stop()
        auth.signOut()
        wipeLocal()
        prefs.edit().remove(OWNER_KEY).apply()
    }

    private suspend fun wipeLocal() = withContext(Dispatchers.IO) {
        db.clearAllTables()
        runCatching { File(context.filesDir, "journal").deleteRecursively() }
        runCatching { File(context.filesDir, "avatars").deleteRecursively() }
    }

    // ------------------------------------------------------------- images

    /** JPEG data URL of a local image, shrunk until it fits the byte budget. */
    private fun encodeImage(file: File, maxDim: Int, maxBytes: Int): String? {
        if (!file.exists()) return null
        val src = BitmapFactory.decodeFile(file.absolutePath) ?: return null
        var dim = maxDim
        while (dim >= 160) {
            val scale = min(1f, dim.toFloat() / max(src.width, src.height))
            val bmp = if (scale < 1f) Bitmap.createScaledBitmap(src, max(1, (src.width * scale).toInt()), max(1, (src.height * scale).toInt()), true) else src
            var quality = 82
            while (quality >= 40) {
                val out = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
                if (out.size() <= maxBytes) {
                    return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                }
                quality -= 12
            }
            dim /= 2
        }
        return null
    }

    /** Writes a `data:image/...;base64,` URL to `dir/name.ext` and returns the path. */
    private fun saveDataUrl(dataUrl: String, dir: File, name: String): String? = runCatching {
        val comma = dataUrl.indexOf(',')
        val ext = when {
            dataUrl.startsWith("data:image/webp") -> "webp"
            dataUrl.startsWith("data:image/png") -> "png"
            else -> "jpg"
        }
        val bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
        dir.mkdirs()
        File(dir, "$name.$ext").apply { writeBytes(bytes) }.absolutePath
    }.getOrNull()

    private companion object {
        const val OWNER_KEY = "device-owner"
        val CARE_TYPES = setOf("water", "mist", "fertilize", "biostimulate", "repot", "prune", "rotate", "clean")
    }
}

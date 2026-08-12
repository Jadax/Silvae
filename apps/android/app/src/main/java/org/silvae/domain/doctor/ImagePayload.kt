package org.silvae.domain.doctor

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import kotlin.math.max
import kotlin.math.min

private const val MAX_DIM = 1024
private const val MAX_BYTES = 150 * 1024

data class ImagePayload(val base64DataUri: String, val fingerprint: String)

/**
 * Downscale a picked photo to a Plant.id-friendly JPEG ≤150KB and fingerprint
 * it — mirrors fileToPayload/sha256Hex in apps/web/src/lib/identify.ts (WebP
 * there; JPEG here since it's universally supported by Android's Bitmap API).
 */
fun encodeForIdentify(resolver: ContentResolver, uri: Uri): ImagePayload? {
    val original = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) } ?: return null
    val scale = min(1f, MAX_DIM.toFloat() / max(original.width, original.height))
    val target = if (scale < 1f) {
        Bitmap.createScaledBitmap(original, max(1, (original.width * scale).toInt()), max(1, (original.height * scale).toInt()), true)
    } else original

    var quality = 85
    var bytes = compress(target, quality)
    while (bytes.size > MAX_BYTES && quality > 40) {
        quality -= 12
        bytes = compress(target, quality)
    }
    if (bytes.isEmpty()) return null

    val fingerprint = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    val base64 = "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    return ImagePayload(base64, fingerprint)
}

private fun compress(bitmap: Bitmap, quality: Int): ByteArray =
    ByteArrayOutputStream().use { out ->
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
        out.toByteArray()
    }

package org.silvae.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.silvae.BuildConfig
import org.silvae.auth.AuthRepository
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class IdentifyRequestBody(val imageFingerprint: String, val base64: String)

@Serializable
data class IdentifySpecies(val scientificName: String? = null, val confidence: Double? = null)

@Serializable
data class IsPlant(val probability: Double? = null)

@Serializable
data class IsHealthy(val probability: Double? = null, val binary: Boolean? = null)

@Serializable
data class DiseaseResult(val name: String? = null, val probability: Double? = null)

@Serializable
data class IdentifyResponse(
    val cached: Boolean? = null,
    val species: List<IdentifySpecies>? = null,
    val isPlant: IsPlant? = null,
    val isHealthy: IsHealthy? = null,
    val disease: DiseaseResult? = null,
    val error: String? = null,
)

class IdentifyApiException(val code: String, val status: Int) : Exception(code)

/**
 * Client for the shared `/api/identify` Vercel function — same server the web
 * app calls (server/functions/api/identify.ts), now auth-gated, so we send
 * the Firebase ID token the same way apps/web/src/lib/api.ts does.
 */
@Singleton
class IdentifyApi @Inject constructor(
    private val authRepository: AuthRepository,
) {
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    // client.newCall(...).execute() is blocking I/O — must run on Dispatchers.IO
    // (NetworkOnMainThreadException otherwise; see LocationApi.kt for why this
    // class of bug is invisible until you actually run the app on a device).
    suspend fun identify(imageFingerprint: String, base64: String): IdentifyResponse {
        val token = authRepository.idToken()
        val bodyJson = json.encodeToString(IdentifyRequestBody(imageFingerprint, base64))
        val requestBuilder = Request.Builder()
            .url("${BuildConfig.API_BASE}/identify")
            .post(bodyJson.toRequestBody("application/json".toMediaType()))
        if (token != null) requestBuilder.addHeader("Authorization", "Bearer $token")

        return withContext(Dispatchers.IO) {
            client.newCall(requestBuilder.build()).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val error = runCatching { json.decodeFromString<JsonObject>(text) }.getOrNull()
                    val code = error?.get("error")?.toString()?.trim('"') ?: "http_${response.code}"
                    throw IdentifyApiException(code, response.code)
                }
                json.decodeFromString(text)
            }
        }
    }
}

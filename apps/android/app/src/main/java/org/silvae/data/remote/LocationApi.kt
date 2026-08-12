package org.silvae.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

data class Place(val lat: Double, val lon: Double, val label: String)

@Serializable
private data class ReverseGeocodeResponse(
    val city: String? = null,
    val locality: String? = null,
    val principalSubdivision: String? = null,
    val countryName: String? = null,
)

@Serializable
private data class GeocodeResult(val name: String, val latitude: Double, val longitude: Double, val country_code: String? = null, val admin1: String? = null)

@Serializable
private data class GeocodeSearchResponse(val results: List<GeocodeResult> = emptyList())

/**
 * Free, no-key place lookups — mirrors apps/web/src/lib/location.ts exactly
 * (same BigDataCloud reverse-geocode + Open-Meteo geocoding search APIs).
 */
@Singleton
class LocationApi @Inject constructor() {
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    // Every OkHttp call below is blocking I/O — must run on Dispatchers.IO or
    // it throws NetworkOnMainThreadException on Android (invisible in JVM
    // unit tests, and silently swallowed here by runCatching, which is what
    // made this bug so easy to miss without running on a real device/emulator).
    suspend fun reverseGeocode(lat: Double, lon: Double): String = withContext(Dispatchers.IO) {
        runCatching {
            val url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=$lat&longitude=$lon&localityLanguage=en"
            client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                if (!response.isSuccessful) return@use null
                val d = json.decodeFromString<ReverseGeocodeResponse>(response.body?.string().orEmpty())
                listOfNotNull(d.city ?: d.locality, d.principalSubdivision, d.countryName).take(2).joinToString(", ").ifEmpty { null }
            }
        }.getOrNull() ?: "%.2f, %.2f".format(lat, lon)
    }

    suspend fun search(query: String): List<Place> {
        val q = query.trim()
        if (q.isEmpty()) return emptyList()
        return withContext(Dispatchers.IO) {
            runCatching {
                val url = "https://geocoding-api.open-meteo.com/v1/search?name=${java.net.URLEncoder.encode(q, "UTF-8")}&count=6&language=en&format=json"
                client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                    if (!response.isSuccessful) return@use emptyList()
                    val d = json.decodeFromString<GeocodeSearchResponse>(response.body?.string().orEmpty())
                    d.results.map { r -> Place(r.latitude, r.longitude, listOfNotNull(r.name, r.admin1, r.country_code).joinToString(", ")) }
                }
            }.getOrDefault(emptyList())
        }
    }
}

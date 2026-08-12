package org.silvae.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import org.silvae.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class WeatherPayload(
    val tempC: Double,
    val rh: Double,
    val uvIndex: Double,
    val cloudCover: Double = 0.0,
    val precipitationMm: Double = 0.0,
    val daylightHours: Double,
)

@Serializable
private data class OpenMeteoCurrent(
    val temperature_2m: Double,
    val relative_humidity_2m: Double,
    val precipitation: Double,
    val cloud_cover: Double,
    val uv_index: Double,
)

@Serializable
private data class OpenMeteoDaily(val sunshine_duration: List<Double> = emptyList())

@Serializable
private data class OpenMeteoResponse(val current: OpenMeteoCurrent, val daily: OpenMeteoDaily)

private val DEFAULT_WEATHER = WeatherPayload(tempC = 22.0, rh = 55.0, uvIndex = 4.0, daylightHours = 14.0)

/**
 * Weather client — mirrors fetchWeather in apps/web/src/lib/weather.ts:
 * server proxy (cached, `/api/weather`) → direct Open-Meteo → default env
 * (offline). No auth needed; weather is public, non-sensitive data.
 */
@Singleton
class WeatherApi @Inject constructor() {
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    // Blocking OkHttp calls — must run off the main thread (NetworkOnMainThreadException
    // otherwise; see the note in LocationApi.kt for why this was easy to miss).
    suspend fun fetch(lat: Double, lon: Double): WeatherPayload = withContext(Dispatchers.IO) {
        getFromServer(lat, lon)?.let { return@withContext it }
        getFromOpenMeteo(lat, lon)?.let { return@withContext it }
        DEFAULT_WEATHER
    }

    private fun getFromServer(lat: Double, lon: Double): WeatherPayload? = runCatching {
        val url = "${BuildConfig.API_BASE}/weather?lat=$lat&lon=$lon"
        client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
            if (!response.isSuccessful) return null
            json.decodeFromString<WeatherPayload>(response.body?.string().orEmpty())
        }
    }.getOrNull()

    private fun getFromOpenMeteo(lat: Double, lon: Double): WeatherPayload? = runCatching {
        val url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon" +
            "&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,uv_index" +
            "&daily=sunshine_duration&timezone=auto&forecast_days=1"
        client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
            if (!response.isSuccessful) return null
            val d = json.decodeFromString<OpenMeteoResponse>(response.body?.string().orEmpty())
            WeatherPayload(
                tempC = d.current.temperature_2m,
                rh = d.current.relative_humidity_2m,
                uvIndex = d.current.uv_index,
                cloudCover = d.current.cloud_cover,
                precipitationMm = d.current.precipitation,
                daylightHours = Math.round((d.daily.sunshine_duration.firstOrNull() ?: 0.0) / 3600.0).toDouble(),
            )
        }
    }.getOrNull()
}

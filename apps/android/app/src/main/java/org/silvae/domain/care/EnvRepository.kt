package org.silvae.domain.care

import org.silvae.data.SettingsRepository
import org.silvae.data.remote.WeatherApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resolves the `Env` a plant should be scheduled against: real weather for
 * its saved location when available, moderated for indoor plants exactly
 * like envForPlant in apps/web/src/lib/care.ts; falls back to the same
 * indoor-default Env() otherwise (no location saved, or offline).
 */
@Singleton
class EnvRepository @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val weatherApi: WeatherApi,
) {
    suspend fun envFor(locationType: String?): Env {
        val settings = settingsRepository.get()
        val lat = settings.locationLat
        val lon = settings.locationLon
        if (lat == null || lon == null) return Env()

        val weather = runCatching { weatherApi.fetch(lat, lon) }.getOrNull() ?: return Env()
        val outdoor = locationType == "outdoor"
        return Env(
            tempC = if (outdoor) weather.tempC else weather.tempC.coerceIn(15.0, 28.0),
            rh = if (outdoor) weather.rh else weather.rh.coerceIn(30.0, 70.0),
            uvIndex = if (outdoor) weather.uvIndex else weather.uvIndex.coerceAtMost(3.0),
            season = currentSeason(),
            daylightH = weather.daylightHours,
        )
    }
}

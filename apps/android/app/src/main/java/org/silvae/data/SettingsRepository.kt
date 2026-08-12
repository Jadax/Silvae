package org.silvae.data

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.silvae.data.local.dao.SettingsDao
import org.silvae.data.local.entity.SettingsEntity
import org.silvae.data.remote.LocationApi
import org.silvae.data.remote.Place
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Settings (location + pets) — mirrors apps/web/src/lib/settings.ts backed by
 * Room instead of Dexie. Location powers season-aware, weather-adjusted care;
 * nothing here leaves the device except the lat/lon sent to the weather proxy.
 */
@Singleton
class SettingsRepository @Inject constructor(
    private val settingsDao: SettingsDao,
    private val locationApi: LocationApi,
    @ApplicationContext private val context: Context,
) {
    fun observe(): Flow<SettingsEntity?> = settingsDao.observe()
    suspend fun get(): SettingsEntity = settingsDao.get() ?: SettingsEntity()

    suspend fun setPets(cat: Boolean, dog: Boolean) {
        settingsDao.upsert(get().copy(petCat = cat, petDog = dog))
    }

    suspend fun setLocation(place: Place) {
        settingsDao.upsert(get().copy(locationLat = place.lat, locationLon = place.lon, locationLabel = place.label))
    }

    suspend fun setOnboarded(value: Boolean) {
        settingsDao.upsert(get().copy(onboarded = value))
    }

    suspend fun setUnits(imperial: Boolean) {
        settingsDao.upsert(get().copy(units = if (imperial) "imperial" else "metric"))
    }

    /** Resets settings to defaults — part of account deletion (see AuthViewModel.deleteAccount). */
    suspend fun clear() {
        settingsDao.upsert(SettingsEntity())
    }

    suspend fun searchPlaces(query: String): List<Place> = locationApi.search(query)

    /**
     * Requires ACCESS_FINE_LOCATION/ACCESS_COARSE_LOCATION to already be
     * granted — callers check first. Never surfaces a raw exception message
     * to the UI (a bare "Timed out waiting for 15000 ms" is meaningless to a
     * user with a weak GPS signal) — every failure path gets a friendly one.
     */
    @SuppressLint("MissingPermission")
    suspend fun detectAndSaveLocation(): Result<Place> = try {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = CurrentLocationRequest.Builder().setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY).build()
        val location = withTimeout(15_000) { client.getCurrentLocation(request, null).await() }
            ?: return Result.failure(Exception("We couldn't find your location. Try searching instead."))
        val label = locationApi.reverseGeocode(location.latitude, location.longitude)
        val place = Place(location.latitude, location.longitude, label)
        setLocation(place)
        Result.success(place)
    } catch (e: TimeoutCancellationException) {
        Result.failure(Exception("That's taking a while — check your GPS/location signal and try again, or search for your city instead."))
    } catch (e: CancellationException) {
        throw e // real coroutine cancellation (e.g. screen left) — must propagate, not become a UI error
    } catch (e: Exception) {
        Result.failure(Exception("We couldn't find your location. Try searching instead."))
    }
}

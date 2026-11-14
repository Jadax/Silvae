package org.silvae.domain.care

import java.time.Instant
import java.time.ZoneOffset
import kotlin.math.max
import kotlin.math.min

/** Mirrors packages/core/src/dto/weather.ts Env — moderated indoor defaults
 *  are used until M7 wires up live weather (matches envForPlant's indoor
 *  clamping in apps/web/src/lib/care.ts when no real weather is available). */
data class Env(
    val tempC: Double = 22.0,
    val rh: Double = 50.0,
    val uvIndex: Double = 2.0,
    val season: String = currentSeason(),
    val daylightH: Double = 12.0,
)

/**
 * Meteorological season — mirrors seasonAt (packages/core/src/constants.ts).
 * Southern-hemisphere latitudes get the opposite season (November in Cape
 * Town is spring). Without a latitude, assumes the northern hemisphere.
 */
fun currentSeason(month: Int = java.time.LocalDate.now().monthValue, lat: Double? = null): String {
    val northern = when (month) {
        12, 1, 2 -> "winter"
        3, 4, 5 -> "spring"
        6, 7, 8 -> "summer"
        else -> "autumn"
    }
    if (lat == null || lat >= 0) return northern
    return when (northern) {
        "winter" -> "summer"
        "spring" -> "autumn"
        "summer" -> "winter"
        else -> "spring"
    }
}

/** Plants living in water (glass pots) get their water refreshed this often. */
const val WATER_CULTURE_REFRESH_DAYS = 7.0

/** Pot volume in litres from its top diameter — mirrors potVolumeL (core/care/pot.ts). */
fun potVolumeL(potSizeCm: Double): Double = clamp(Math.PI * potSizeCm * potSizeCm * potSizeCm / 12000.0, 0.2, 30.0)

/** A thorough watering for a pot: about a fifth of its volume — mirrors potWaterMl. */
fun potWaterMl(potSizeCm: Double): Int = (Math.round(clamp(potVolumeL(potSizeCm) * 1000 * 0.2, 40.0, 5000.0) / 10.0) * 10).toInt()

data class Modifier(val name: String, val delta: Double)

data class ScheduleResult(val nextAt: Instant, val intervalDays: Double, val modifiers: List<Modifier>)

private fun clamp(x: Double, lo: Double, hi: Double) = min(hi, max(lo, x))

/**
 * Dynamic per-plant watering interval — direct port of `nextWaterAt`
 * (packages/core/src/care/schedule.ts §10.2). Every modifier is named so the
 * UI can show "why this schedule" the same way PlantDetail.tsx does.
 */
fun nextWaterAt(
    species: Species,
    potType: String,
    potSizeCm: Double?,
    soilType: String,
    locationType: String?,
    env: Env,
    last: Instant,
    luxEstimate: Double = 1000.0,
): ScheduleResult {
    if (potType == "glass") {
        return ScheduleResult(last.plus(WATER_CULTURE_REFRESH_DAYS.toLong(), java.time.temporal.ChronoUnit.DAYS), WATER_CULTURE_REFRESH_DAYS, emptyList())
    }
    var d = species.ideal.waterIntervalDays
    val modifiers = mutableListOf<Modifier>()
    fun push(name: String, delta: Double) {
        d *= 1 + delta
        modifiers += Modifier(name, delta)
    }

    if (luxEstimate > 5000) push("highLight", -0.25) else if (luxEstimate < 500) push("lowLight", 0.35)
    when (potType) {
        "terracotta" -> push("terracottaPot", -0.15)
        "self-watering" -> push("selfWateringPot", 0.5)
    }
    if (soilType == "well-draining") push("wellDrainingSoil", -0.1)
    else if (soilType == "retentive") push("retentiveSoil", 0.1)
    // Small pots hold little water and dry out fast; big ones stay damp longer.
    if (potSizeCm != null && potSizeCm > 0) {
        when {
            potSizeCm < 10 -> push("smallPot", -0.2)
            potSizeCm < 14 -> push("smallishPot", -0.1)
            potSizeCm > 35 -> push("veryLargePot", 0.25)
            potSizeCm > 25 -> push("largePot", 0.15)
        }
    }

    if (env.tempC >= 30) push("heat", -0.25)
    else if (env.tempC >= 25) push("warm", -0.1)
    else if (env.tempC < 12) push("cold", 0.2)
    if (env.rh < 40) push("lowHumidity", -0.15) else if (env.rh > 70) push("highHumidity", 0.15)
    if (env.uvIndex >= 7) push("strongSun", -0.1)

    val growing = env.season == "spring" || env.season == "summer"
    if (species.growth.rate == "FAST" && growing) push("fastGrowth", -0.1)

    val outdoor = locationType == "outdoor"
    if (outdoor) {
        if (env.season == "winter" || env.tempC < 5) push("outdoorDormant", 0.25)
        else if (env.tempC < 10) push("outdoorCool", 0.1)
    }

    val base = species.ideal.waterIntervalDays
    d = clamp(d, base * 0.5, base * 1.8)
    val intervalDays = Math.round(d * 100) / 100.0
    return ScheduleResult(
        nextAt = last.plus(intervalDays.toLong(), java.time.temporal.ChronoUnit.DAYS),
        intervalDays = intervalDays,
        modifiers = modifiers,
    )
}

/** "Water today / tomorrow / in N days" — mirrors waterStatusLabel (apps/web/src/lib/care.ts). */
sealed interface WaterTone { data object Due : WaterTone; data object Soon : WaterTone; data object Happy : WaterTone; data object Neutral : WaterTone }
data class WaterStatus(val label: String, val tone: WaterTone, val days: Long? = null)

fun waterStatusLabel(nextWaterAt: Instant?, verb: String = "Water"): WaterStatus {
    if (nextWaterAt == null) return WaterStatus("Schedule pending", WaterTone.Neutral)
    val zone = java.time.ZoneId.systemDefault()
    val days = java.time.temporal.ChronoUnit.DAYS.between(Instant.now().atZone(zone).toLocalDate(), nextWaterAt.atZone(zone).toLocalDate())
    return when {
        days < 0 -> WaterStatus("$verb today (${-days} day${if (days == -1L) "" else "s"} late)", WaterTone.Due, days)
        days == 0L -> WaterStatus("$verb today", WaterTone.Due, 0)
        days == 1L -> WaterStatus("$verb tomorrow", WaterTone.Soon, 1)
        else -> WaterStatus("$verb in $days days", WaterTone.Happy, days)
    }
}

/** "Water" for potted plants, "Refresh water" for plants growing in a glass of water. */
fun waterVerb(potType: String): String = if (potType == "glass") "Refresh water" else "Water"

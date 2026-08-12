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

fun currentSeason(month: Int = java.time.LocalDate.now().monthValue): String = when (month) {
    12, 1, 2 -> "winter"
    3, 4, 5 -> "spring"
    6, 7, 8 -> "summer"
    else -> "autumn"
}

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
    var d = species.ideal.waterIntervalDays
    val modifiers = mutableListOf<Modifier>()
    fun push(name: String, delta: Double) {
        d *= 1 + delta
        modifiers += Modifier(name, delta)
    }

    if (luxEstimate > 5000) push("highLight", -0.25) else if (luxEstimate < 500) push("lowLight", 0.35)
    if (potType == "terracotta") push("terracottaPot", -0.15)
    if (soilType == "well-draining") push("wellDrainingSoil", -0.1)
    if ((potSizeCm ?: 0.0) > 25) push("largePot", 0.15)

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

fun waterStatusLabel(nextWaterAt: Instant?): WaterStatus {
    if (nextWaterAt == null) return WaterStatus("Schedule pending", WaterTone.Neutral)
    val days = java.time.temporal.ChronoUnit.DAYS.between(Instant.now().atZone(ZoneOffset.UTC).toLocalDate(), nextWaterAt.atZone(ZoneOffset.UTC).toLocalDate())
    return when {
        days <= 0 -> WaterStatus("Water today", WaterTone.Due, 0)
        days == 1L -> WaterStatus("Water tomorrow", WaterTone.Soon, 1)
        else -> WaterStatus("Water in $days days", WaterTone.Happy, days)
    }
}

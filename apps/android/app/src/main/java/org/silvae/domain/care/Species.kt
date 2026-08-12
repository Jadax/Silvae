package org.silvae.domain.care

import kotlinx.serialization.Serializable

/** Mirrors packages/core/src/dto/species.ts — parsed from the bundled data/species JSON assets. */
@Serializable
data class Npk(val n: Double, val p: Double, val k: Double)

@Serializable
data class SpeciesIdeal(
    val luxMin: Double,
    val luxIdeal: Double,
    val luxMax: Double,
    val tempMinC: Double,
    val tempMaxC: Double,
    val humidityMin: Double,
    val humidityMax: Double,
    val phMin: Double,
    val phMax: Double,
    val npk: Npk,
    val waterIntervalDays: Double,
    val waterAmountMl: Double,
    val fertIntervalDays: Double,
    val mistIntervalDays: Double,
    val repotIntervalMonths: Double,
    val rotateIntervalDays: Double,
)

@Serializable
data class SpeciesTolerance(val drought: String, val shade: String, val cold: String)

@Serializable
data class SpeciesGrowth(val rate: String, val maxHeightCm: Double)

@Serializable
data class SpeciesToxicity(val pets: Boolean, val note: String? = null)

@Serializable
data class Species(
    val slug: String,
    val commonNames: List<String>,
    val scientificName: String,
    val family: String,
    val toxicity: SpeciesToxicity,
    val ideal: SpeciesIdeal,
    val tolerance: SpeciesTolerance,
    val growth: SpeciesGrowth,
)

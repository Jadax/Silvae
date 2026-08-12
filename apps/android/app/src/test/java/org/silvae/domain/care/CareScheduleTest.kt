package org.silvae.domain.care

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

private fun sampleSpecies(waterIntervalDays: Double = 10.0) = Species(
    slug = "test-plant",
    commonNames = listOf("Test Plant"),
    scientificName = "Testus plantus",
    family = "Testaceae",
    toxicity = SpeciesToxicity(pets = false),
    ideal = SpeciesIdeal(
        luxMin = 500.0, luxIdeal = 1200.0, luxMax = 12000.0,
        tempMinC = 15.0, tempMaxC = 30.0, humidityMin = 40.0, humidityMax = 70.0,
        phMin = 6.0, phMax = 7.5, npk = Npk(2.0, 1.0, 2.0),
        waterIntervalDays = waterIntervalDays, waterAmountMl = 300.0,
        fertIntervalDays = 21.0, mistIntervalDays = 10.0,
        repotIntervalMonths = 24.0, rotateIntervalDays = 30.0,
    ),
    tolerance = SpeciesTolerance(drought = "MED", shade = "MED", cold = "LOW"),
    growth = SpeciesGrowth(rate = "MEDIUM", maxHeightCm = 100.0),
)

/** Mirrors the port of packages/core/src/care/schedule.ts's nextWaterAt — verifies the modifiers actually fire. */
class CareScheduleTest {

    @Test
    fun `neutral conditions keep the base interval`() {
        val species = sampleSpecies(waterIntervalDays = 10.0)
        val neutralEnv = Env(tempC = 20.0, rh = 55.0, uvIndex = 4.0, season = "autumn")
        val result = nextWaterAt(species, "plastic", null, "standard", "indoor", neutralEnv, Instant.EPOCH, luxEstimate = 1000.0)
        assertEquals(10.0, result.intervalDays, 0.01)
    }

    @Test
    fun `heat shortens the interval`() {
        val species = sampleSpecies(waterIntervalDays = 10.0)
        val hotEnv = Env(tempC = 32.0, rh = 55.0, uvIndex = 4.0, season = "summer")
        val result = nextWaterAt(species, "plastic", null, "standard", "indoor", hotEnv, Instant.EPOCH, luxEstimate = 1000.0)
        assertTrue("expected interval < 10 under heat, was ${result.intervalDays}", result.intervalDays < 10.0)
    }

    @Test
    fun `cold lengthens the interval`() {
        val species = sampleSpecies(waterIntervalDays = 10.0)
        val coldEnv = Env(tempC = 8.0, rh = 55.0, uvIndex = 1.0, season = "winter")
        val result = nextWaterAt(species, "plastic", null, "standard", "indoor", coldEnv, Instant.EPOCH, luxEstimate = 1000.0)
        assertTrue("expected interval > 10 under cold, was ${result.intervalDays}", result.intervalDays > 10.0)
    }

    @Test
    fun `terracotta pot and well-draining soil both shorten the interval`() {
        val species = sampleSpecies(waterIntervalDays = 10.0)
        val neutralEnv = Env(tempC = 20.0, rh = 55.0, uvIndex = 4.0, season = "autumn")
        val plastic = nextWaterAt(species, "plastic", null, "standard", "indoor", neutralEnv, Instant.EPOCH, luxEstimate = 1000.0)
        val terracotta = nextWaterAt(species, "terracotta", null, "well-draining", "indoor", neutralEnv, Instant.EPOCH, luxEstimate = 1000.0)
        assertTrue(terracotta.intervalDays < plastic.intervalDays)
    }

    @Test
    fun `interval is clamped to 0point5x to 1point8x the base`() {
        val species = sampleSpecies(waterIntervalDays = 10.0)
        // Stack every interval-lengthening modifier to try to blow past the 1.8x ceiling.
        val extremeCold = Env(tempC = -5.0, rh = 80.0, uvIndex = 0.0, season = "winter")
        val result = nextWaterAt(species, "self-watering", 40.0, "retentive", "outdoor", extremeCold, Instant.EPOCH, luxEstimate = 200.0)
        assertTrue(result.intervalDays <= 18.0)
    }

    @Test
    fun `waterStatusLabel buckets days correctly`() {
        assertEquals(WaterTone.Neutral, waterStatusLabel(null).tone)
        assertEquals("Water today", waterStatusLabel(Instant.now().minusSeconds(3600)).label)
        assertEquals(WaterTone.Due, waterStatusLabel(Instant.now().minusSeconds(3600)).tone)
    }
}

package org.silvae.domain.care

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** Mirrors the "care/pot and seasons" tests in packages/core/src/engine.test.ts. */
class SeasonAndPotTest {
    private val species = Species(
        slug = "test-plant",
        commonNames = listOf("Test Plant"),
        scientificName = "Testus plantus",
        family = "Testaceae",
        toxicity = SpeciesToxicity(pets = false),
        ideal = SpeciesIdeal(
            luxMin = 500.0, luxIdeal = 1200.0, luxMax = 12000.0,
            tempMinC = 15.0, tempMaxC = 30.0, humidityMin = 40.0, humidityMax = 70.0,
            phMin = 6.0, phMax = 7.5, npk = Npk(2.0, 1.0, 2.0),
            waterIntervalDays = 10.0, waterAmountMl = 300.0,
            fertIntervalDays = 21.0, mistIntervalDays = 10.0,
            repotIntervalMonths = 24.0, rotateIntervalDays = 30.0,
        ),
        tolerance = SpeciesTolerance(drought = "MED", shade = "MED", cold = "LOW"),
        growth = SpeciesGrowth(rate = "MEDIUM", maxHeightCm = 100.0),
    )
    private val env = Env(tempC = 20.0, rh = 55.0, uvIndex = 4.0, season = "autumn")

    private fun interval(potType: String = "plastic", pot: Double? = 20.0) =
        nextWaterAt(species, potType, pot, "standard", "indoor", env, Instant.EPOCH).intervalDays

    @Test
    fun `southern hemisphere flips the season`() {
        assertEquals("autumn", currentSeason(11))
        assertEquals("autumn", currentSeason(11, lat = 51.5))
        assertEquals("spring", currentSeason(11, lat = -33.9))
        assertEquals("winter", currentSeason(7, lat = -26.2))
    }

    @Test
    fun `small pots dry faster and big pots slower`() {
        assertTrue(interval(pot = 8.0) < interval(pot = 20.0))
        assertTrue(interval(pot = 30.0) > interval(pot = 20.0))
        assertTrue(interval(pot = 40.0) > interval(pot = 30.0))
    }

    @Test
    fun `pot type changes the interval and glass means a weekly water refresh`() {
        assertTrue(interval("self-watering") > interval("plastic"))
        assertTrue(interval("terracotta") < interval("plastic"))
        assertEquals(WATER_CULTURE_REFRESH_DAYS, interval("glass"), 0.0)
    }

    @Test
    fun `watering amount scales with the pot like the web app`() {
        assertEquals(180, potWaterMl(15.0)) // same number the web shows for a 15 cm pot
        assertTrue(potWaterMl(30.0) > potWaterMl(15.0) * 7)
    }
}

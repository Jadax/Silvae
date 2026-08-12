package org.silvae.domain.doctor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors the port of packages/core/src/doctor/rules.ts's diagnose(). */
class DoctorRulesTest {

    @Test
    fun `no symptoms yields no diagnosis`() {
        assertTrue(diagnose(Symptoms()).isEmpty())
    }

    @Test
    fun `overwatering rule fires on yellow leaves plus moist soil plus droop`() {
        val results = diagnose(Symptoms(leafColor = "yellow", soil = "moist", droop = true))
        assertEquals("overwater", results.first().id)
        assertEquals(Confidence.HIGH, results.first().confidence)
    }

    @Test
    fun `overwatering rule requires at-least-one of droop or lowerLeaves`() {
        // Same leafColor/soil match, but neither droop nor lowerLeaves set — rule must not fire.
        val results = diagnose(Symptoms(leafColor = "yellow", soil = "moist"))
        assertTrue(results.none { it.id == "overwater" })
    }

    @Test
    fun `spider mite rule fires on webbing plus stippling`() {
        val results = diagnose(Symptoms(webbing = true, stippling = true))
        assertEquals("spider-mite", results.first().id)
    }

    @Test
    fun `soil accepts either moist or soaked via list matching`() {
        val moist = diagnose(Symptoms(leafColor = "yellow", soil = "moist", droop = true))
        val soaked = diagnose(Symptoms(leafColor = "yellow", soil = "soaked", droop = true))
        assertEquals("overwater", moist.first().id)
        assertEquals("overwater", soaked.first().id)
    }

    @Test
    fun `results are capped at 3 and sorted by score descending`() {
        // Fire several rules at once: overwater(4), spider-mite(3), mealybug(3).
        val results = diagnose(
            Symptoms(
                leafColor = "yellow", soil = "moist", droop = true,
                webbing = true, stippling = true,
                whiteFluff = true, stickyResidue = true,
            ),
        )
        assertTrue(results.size <= 3)
        assertEquals("overwater", results.first().id)
        assertTrue(results.zipWithNext().all { (a, b) -> a.score >= b.score })
    }
}

package org.silvae.domain.care

import kotlin.math.roundToInt

/** Metric/imperial display formatting — Silvae always stores metric internally (matches species data and the care engine); only display converts. */
object Units {
    fun temp(celsius: Double, imperial: Boolean): String =
        if (imperial) "${(celsius * 9 / 5 + 32).roundToInt()}°F" else "${celsius.roundToInt()}°C"

    fun tempRange(minC: Double, maxC: Double, imperial: Boolean): String =
        if (imperial) "${(minC * 9 / 5 + 32).roundToInt()}–${(maxC * 9 / 5 + 32).roundToInt()}°F"
        else "${minC.roundToInt()}–${maxC.roundToInt()}°C"

    /** Water amount: ml → fl oz. */
    fun volume(ml: Double, imperial: Boolean): String =
        if (imperial) "%.1f fl oz".format(ml / 29.5735) else "${ml.roundToInt()} ml"

    /** Small length (pot size, plant height): cm → inches. */
    fun length(cm: Double, imperial: Boolean): String =
        if (imperial) "%.1f in".format(cm / 2.54) else "${cm.roundToInt()} cm"
}

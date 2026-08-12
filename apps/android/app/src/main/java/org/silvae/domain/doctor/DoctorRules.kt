package org.silvae.domain.doctor

/** Direct port of RULES + diagnose() in packages/core/src/doctor/rules.ts. */
private data class Rule(
    val id: String,
    val weight: Int,
    val symptoms: Map<String, Any>, // value is either a single expected value or a List of accepted values
    val atLeastOne: List<String> = emptyList(),
    val likelyCause: String,
    val treatment: List<String>,
)

private val RULES = listOf(
    Rule(
        id = "overwater", weight = 4,
        symptoms = mapOf("leafColor" to "yellow", "soil" to listOf("moist", "soaked")),
        atLeastOne = listOf("droop", "lowerLeaves"),
        likelyCause = "Overwatering / root rot risk",
        treatment = listOf("Let soil dry out", "Inspect roots", "Repot with drainage"),
    ),
    Rule(
        id = "underwater", weight = 4,
        symptoms = mapOf("leafCrisp" to "dry-brown", "soil" to "dry", "droop" to true),
        likelyCause = "Underwatering",
        treatment = listOf("Water thoroughly", "Check pot for drainage", "Monitor daily"),
    ),
    Rule(
        id = "low-light", weight = 3,
        symptoms = mapOf("leafColor" to "pale", "stretched" to true, "light" to "low"),
        likelyCause = "Too little light",
        treatment = listOf("Move closer to a window", "Rotate weekly", "Consider grow light"),
    ),
    Rule(
        id = "sunburn", weight = 3,
        symptoms = mapOf("leafBurn" to "brown-spots", "directSun" to true, "spotsOnExposed" to true),
        likelyCause = "Sunburn (too much direct light)",
        treatment = listOf("Move away from direct sun", "Acclimatise gradually"),
    ),
    Rule(
        id = "leaf-spot", weight = 2,
        symptoms = mapOf("leafBurn" to "brown-spots"),
        likelyCause = "Fungal leaf spot (possible)",
        treatment = listOf("Remove affected leaves", "Water the soil, not the leaves", "Improve air flow"),
    ),
    Rule(
        id = "low-humidity", weight = 2,
        symptoms = mapOf("leafCrisp" to "brown-tips", "envHumidity" to "low"),
        likelyCause = "Low humidity",
        treatment = listOf("Mist regularly", "Use a pebble tray", "Group plants"),
    ),
    Rule(
        id = "spider-mite", weight = 3,
        symptoms = mapOf("webbing" to true, "stippling" to true),
        likelyCause = "Spider mites",
        treatment = listOf("Rinse leaves", "Apply neem oil", "Isolate plant"),
    ),
    Rule(
        id = "mealybug", weight = 3,
        symptoms = mapOf("whiteFluff" to true, "stickyResidue" to true),
        likelyCause = "Mealybugs",
        treatment = listOf("Remove with alcohol swab", "Apply insecticidal soap"),
    ),
    Rule(
        id = "aphid", weight = 3,
        symptoms = mapOf("curledLeaves" to true, "stickyResidue" to true, "insects" to true),
        likelyCause = "Aphids",
        treatment = listOf("Wash off", "Neem oil", "Encourage ladybugs"),
    ),
)

private fun matches(rule: Rule, answers: Symptoms): Boolean {
    for ((key, expected) in rule.symptoms) {
        val got = answers.get(key)
        val ok = if (expected is List<*>) got != null && expected.contains(got) else got == expected
        if (!ok) return false
    }
    if (rule.atLeastOne.isNotEmpty() && rule.atLeastOne.none { truthy(answers.get(it)) }) return false
    return true
}

private fun truthy(value: Any?): Boolean = when (value) {
    null -> false
    is Boolean -> value
    is String -> value.isNotEmpty()
    else -> true
}

private fun confidence(score: Int, weight: Int): Confidence = when {
    score >= weight -> Confidence.HIGH
    score >= weight - 1 -> Confidence.MEDIUM
    else -> Confidence.LOW
}

/** Rule-based symptom checker — same 2-of-9 rules, same top-3-by-score cutoff as the web app. */
fun diagnose(answers: Symptoms): List<Diagnosis> =
    RULES.map { rule -> rule to (if (matches(rule, answers)) rule.weight else 0) }
        .filter { (_, score) -> score >= 2 }
        .sortedByDescending { (_, score) -> score }
        .take(3)
        .map { (rule, score) -> Diagnosis(rule.id, score, rule.likelyCause, rule.treatment, confidence(score, rule.weight)) }

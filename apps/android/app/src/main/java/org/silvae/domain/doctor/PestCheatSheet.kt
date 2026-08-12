package org.silvae.domain.doctor

/** Port of PESTS in apps/web/src/lib/identify.ts — shown when a photo ID flags a named pest/disease. */
data class PestInfo(val pest: String, val icon: String, val severity: String, val treatments: List<String>)

private val PESTS: List<Pair<Regex, PestInfo>> = listOf(
    Regex("aphid", RegexOption.IGNORE_CASE) to PestInfo(
        "Aphids", "🦠", "easy",
        listOf(
            "Rinse the plant under a gentle spray to knock them off",
            "Spray with insecticidal soap or a neem solution every few days",
            "Repeat until no new colonies appear; check leaf undersides and new growth",
        ),
    ),
    Regex("mealybug", RegexOption.IGNORE_CASE) to PestInfo(
        "Mealybugs", "🤍", "moderate",
        listOf(
            "Wipe each fluffy spot with a cotton swab dipped in rubbing alcohol",
            "Check leaf joints and undersides — they love the crevices",
            "Re-treat weekly; inspect nearby plants, they spread quietly",
        ),
    ),
    Regex("spider mite", RegexOption.IGNORE_CASE) to PestInfo(
        "Spider mites", "🕷️", "moderate",
        listOf(
            "Isolate the plant and raise humidity — mites hate it",
            "Wash the leaves and spray with insecticidal soap or neem",
            "Repeat twice a week for two weeks; the webbing marks where they hide",
        ),
    ),
    Regex("scale insect|scale", RegexOption.IGNORE_CASE) to PestInfo(
        "Scale insects", "🛡️", "moderate",
        listOf(
            "Scrape off the hard bumps with a fingernail or old toothbrush",
            "Wipe with rubbing alcohol, then apply horticultural oil",
            "Check stems and leaf veins weekly for two or three weeks",
        ),
    ),
    Regex("whitefly", RegexOption.IGNORE_CASE) to PestInfo(
        "Whiteflies", "🦋", "moderate",
        listOf(
            "Vacuum adults off in the morning, then use yellow sticky traps",
            "Spray with insecticidal soap, focusing on leaf undersides",
            "Quarantine — whiteflies spread fast to the whole shelf",
        ),
    ),
    Regex("thrips?", RegexOption.IGNORE_CASE) to PestInfo(
        "Thrips", "🗡️", "stubborn",
        listOf(
            "Isolate the plant and prune the worst damaged leaves",
            "Wash it down, then treat with insecticidal soap or neem repeatedly",
            "Thrips are persistent — plan on weekly treatment for several weeks",
        ),
    ),
    Regex("fungus gnat|gnat", RegexOption.IGNORE_CASE) to PestInfo(
        "Fungus gnats", "🪰", "easy",
        listOf(
            "Let the top few cm of soil dry out between waterings",
            "Put up yellow sticky traps to catch the adults",
            "Bottom-water, and if they persist do a diluted hydrogen peroxide drench",
        ),
    ),
    Regex("leaf miner", RegexOption.IGNORE_CASE) to PestInfo(
        "Leaf miners", "🪱", "easy",
        listOf(
            "Remove and bin the leaves with visible tunnels",
            "Keep the plant tidy; healthy leaves are less attractive",
            "Check new leaves for fresh wiggly trails",
        ),
    ),
    Regex("broad mite|russet mite|eriophyid", RegexOption.IGNORE_CASE) to PestInfo(
        "Broad or russet mites", "🔬", "stubborn",
        listOf(
            "Treat like spider mites — wash, raise humidity, isolate",
            "Apply a miticide or sulfur according to the label",
            "These are tiny; treat generously and expect a long campaign",
        ),
    ),
)

fun pestFromDiseaseName(diseaseName: String?): PestInfo? {
    if (diseaseName.isNullOrBlank()) return null
    return PESTS.firstOrNull { (pattern, _) -> pattern.containsMatchIn(diseaseName) }?.second
}

/** Port of DISEASE_SYMPTOMS in apps/web/src/lib/identify.ts — translates a disease name into checklist flags. */
private val DISEASE_SYMPTOMS: List<Pair<Regex, Map<String, Any>>> = listOf(
    Regex("aphid", RegexOption.IGNORE_CASE) to mapOf("insects" to true, "stickyResidue" to true, "curledLeaves" to true),
    Regex("mealybug", RegexOption.IGNORE_CASE) to mapOf("whiteFluff" to true, "stickyResidue" to true),
    Regex("spider mite", RegexOption.IGNORE_CASE) to mapOf("webbing" to true, "stippling" to true),
    Regex("mite", RegexOption.IGNORE_CASE) to mapOf("stippling" to true),
    Regex("scale insect", RegexOption.IGNORE_CASE) to mapOf("insects" to true),
    Regex("whitefly", RegexOption.IGNORE_CASE) to mapOf("insects" to true, "stickyResidue" to true),
    Regex("thrips?", RegexOption.IGNORE_CASE) to mapOf("stippling" to true, "leafBurn" to "brown-spots"),
    Regex("fungus gnat|gnat", RegexOption.IGNORE_CASE) to mapOf("insects" to true),
    Regex("leaf miner", RegexOption.IGNORE_CASE) to mapOf("curledLeaves" to true),
    Regex("root rot|overwater", RegexOption.IGNORE_CASE) to mapOf("leafColor" to "yellow", "soil" to "moist"),
    Regex("underwater|dehydrat|drought", RegexOption.IGNORE_CASE) to mapOf("leafCrisp" to "dry-brown", "droop" to true, "soil" to "dry"),
    Regex("sunburn|scorch|leaf burn", RegexOption.IGNORE_CASE) to mapOf("leafBurn" to "brown-spots", "spotsOnExposed" to true, "directSun" to true),
    Regex("leaf spot|spotting|fungal|fungus", RegexOption.IGNORE_CASE) to mapOf("leafBurn" to "brown-spots"),
    Regex("yellow", RegexOption.IGNORE_CASE) to mapOf("leafColor" to "yellow"),
    Regex("chlorosis|deficien|pale", RegexOption.IGNORE_CASE) to mapOf("leafColor" to "pale"),
    Regex("drooping|wilting|wilt", RegexOption.IGNORE_CASE) to mapOf("droop" to true),
)

/** Applies matching disease-symptom flags onto a checklist Symptoms object (confirmed by the user, not auto-trusted). */
fun photoSymptoms(diseaseName: String?): Symptoms {
    if (diseaseName.isNullOrBlank()) return Symptoms()
    var s = Symptoms()
    for ((pattern, flags) in DISEASE_SYMPTOMS) {
        if (!pattern.containsMatchIn(diseaseName)) continue
        s = s.copy(
            leafColor = flags["leafColor"] as? String ?: s.leafColor,
            leafCrisp = flags["leafCrisp"] as? String ?: s.leafCrisp,
            leafBurn = flags["leafBurn"] as? String ?: s.leafBurn,
            soil = flags["soil"] as? String ?: s.soil,
            droop = (flags["droop"] as? Boolean) ?: s.droop,
            curledLeaves = (flags["curledLeaves"] as? Boolean) ?: s.curledLeaves,
            insects = (flags["insects"] as? Boolean) ?: s.insects,
            stickyResidue = (flags["stickyResidue"] as? Boolean) ?: s.stickyResidue,
            whiteFluff = (flags["whiteFluff"] as? Boolean) ?: s.whiteFluff,
            webbing = (flags["webbing"] as? Boolean) ?: s.webbing,
            stippling = (flags["stippling"] as? Boolean) ?: s.stippling,
        )
    }
    return s
}

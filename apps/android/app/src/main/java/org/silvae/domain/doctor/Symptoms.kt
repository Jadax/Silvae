package org.silvae.domain.doctor

/** Mirrors packages/core/src/dto/doctor.ts Symptoms — every field optional, filled from the checklist. */
data class Symptoms(
    val leafColor: String? = null, // green | yellow | pale | brown
    val leafCrisp: String? = null, // none | dry-brown | brown-tips
    val leafBurn: String? = null, // none | brown-spots | pale-patches
    val soil: String? = null, // dry | moist | soaked
    val light: String? = null, // low | medium | high
    val droop: Boolean? = null,
    val stretched: Boolean? = null,
    val lowerLeaves: Boolean? = null,
    val potHasDrainage: Boolean? = null,
    val spotsOnExposed: Boolean? = null,
    val directSun: Boolean? = null,
    val envHumidity: String? = null, // low | ok | high
    val webbing: Boolean? = null,
    val stippling: Boolean? = null,
    val whiteFluff: Boolean? = null,
    val stickyResidue: Boolean? = null,
    val curledLeaves: Boolean? = null,
    val insects: Boolean? = null,
) {
    /** Field access by name — mirrors `answers[key as keyof Symptoms]` in rules.ts's `matches`. */
    fun get(key: String): Any? = when (key) {
        "leafColor" -> leafColor
        "leafCrisp" -> leafCrisp
        "leafBurn" -> leafBurn
        "soil" -> soil
        "light" -> light
        "droop" -> droop
        "stretched" -> stretched
        "lowerLeaves" -> lowerLeaves
        "potHasDrainage" -> potHasDrainage
        "spotsOnExposed" -> spotsOnExposed
        "directSun" -> directSun
        "envHumidity" -> envHumidity
        "webbing" -> webbing
        "stippling" -> stippling
        "whiteFluff" -> whiteFluff
        "stickyResidue" -> stickyResidue
        "curledLeaves" -> curledLeaves
        "insects" -> insects
        else -> null
    }
}

enum class Confidence { LOW, MEDIUM, HIGH }

data class Diagnosis(
    val id: String,
    val score: Int,
    val likelyCause: String,
    val treatment: List<String>,
    val confidence: Confidence,
)

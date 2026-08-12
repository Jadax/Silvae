package org.silvae.ui.nav

object Destinations {
    const val GARDEN = "garden"
    const val DISCOVER = "discover"
    const val DOCTOR = "doctor"
    const val ACCOUNT = "account"
    const val ADD_PLANT = "add_plant"
    const val PLANT_DETAIL = "plant/{plantId}"
    const val SPECIES_GUIDE = "species/{slug}"

    fun plantDetail(id: String) = "plant/$id"
    fun speciesGuide(slug: String) = "species/$slug"
}

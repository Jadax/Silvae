package org.silvae.domain.care

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The 400-species care catalog, bundled as JSON assets (mirrors
 * apps/web/src/lib/seed.ts bundling the same data/species JSON files at
 * build time). Parsed once and cached in memory — small enough (~1.8 MB raw)
 * that there's no need for a database table.
 */
@Singleton
class SpeciesCatalog @Inject constructor(@ApplicationContext private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private var cache: List<Species>? = null

    suspend fun all(): List<Species> = withContext(Dispatchers.IO) {
        cache ?: load().also { cache = it }
    }

    suspend fun bySlug(slug: String): Species? = all().find { it.slug == slug }

    suspend fun search(query: String, limit: Int = 30): List<Species> {
        val q = query.trim().lowercase()
        val list = all()
        if (q.isEmpty()) return list.take(limit)
        return list.filter { s ->
            s.scientificName.lowercase().contains(q) || s.commonNames.any { it.lowercase().contains(q) }
        }.take(limit)
    }

    private fun load(): List<Species> {
        val names = context.assets.list("species") ?: emptyArray()
        return names.mapNotNull { name ->
            runCatching {
                context.assets.open("species/$name").bufferedReader().use { json.decodeFromString<Species>(it.readText()) }
            }.getOrNull()
        }.sortedBy { it.commonNames.firstOrNull() ?: it.scientificName }
    }
}

package org.silvae.ui.discover

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.domain.care.Species

@Composable
fun DiscoverScreen(
    padding: PaddingValues,
    onOpenSpecies: (String) -> Unit,
    viewModel: DiscoverViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp)) {
        Text("Discover", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
        Text("Browse the full species library.", color = MaterialTheme.colorScheme.onSurfaceVariant)

        OutlinedTextField(
            value = ui.query,
            onValueChange = viewModel::setQuery,
            label = { Text("Monstera, pothos, snake plant…") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp),
        )
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Checkbox(checked = ui.petSafeOnly, onCheckedChange = viewModel::setPetSafeOnly)
            Text("🐾 Pet-safe only")
        }

        if (ui.loading) {
            Text("Loading catalog…", modifier = Modifier.padding(top = 16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else if (ui.results.isEmpty()) {
            Text("No matches.", modifier = Modifier.padding(top = 16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            LazyColumn(modifier = Modifier.weight(1f).padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(ui.results, key = { it.slug }) { species -> SpeciesRow(species) { onOpenSpecies(species.slug) } }
            }
        }
    }
}

@Composable
private fun SpeciesRow(species: Species, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            Column {
                Text(species.commonNames.firstOrNull() ?: species.scientificName, fontWeight = FontWeight.Bold)
                Text(species.scientificName, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(if (species.toxicity.pets) "⚠ Toxic" else "🐾 Safe")
        }
    }
}

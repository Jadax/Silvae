package org.silvae.ui.plantdetail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.data.local.entity.CareEventEntity
import org.silvae.domain.care.waterStatusLabel
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val CARE_TYPES = listOf("water", "mist", "fertilize", "prune", "rotate", "clean")
private fun careIcon(type: String) = when (type) {
    "water" -> "💧"; "mist" -> "💦"; "fertilize" -> "🌱"; "prune" -> "✂"; "rotate" -> "↻"; "clean" -> "✨"; else -> "•"
}

@Composable
fun PlantDetailScreen(
    padding: PaddingValues,
    onBack: () -> Unit,
    viewModel: PlantDetailViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsState()

    LaunchedEffect(ui.loaded, ui.plant) {
        if (ui.loaded && ui.plant == null) onBack()
    }

    val plant = ui.plant ?: return
    val status = waterStatusLabel(plant.nextWaterAt?.let { runCatching { Instant.parse(it) }.getOrNull() })

    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp).imePadding()) {
        item {
            TextButton(onClick = onBack) { Text("← My garden") }
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                PlantAvatar(plant.avatarPhotoUrl, modifier = Modifier.padding(end = 12.dp))
                Column {
                    Text(plant.name, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                    Text(ui.species?.scientificName ?: plant.speciesSlug, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text("NEXT LITTLE TASK", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                    Text(status.label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                }
            }

            ui.outdoorTempC?.let { temp ->
                val warning = when {
                    temp < 3 -> "❄️ Frost risk. ${plant.name} is outdoors and it's under 3°C. Bring it in overnight or cover it."
                    temp > 35 -> "🔥 Heat warning. It's above 35°C today. Shade ${plant.name} and water in the early morning."
                    else -> null
                }
                warning?.let {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    ) { Text(it, modifier = Modifier.padding(14.dp)) }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp).horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CARE_TYPES.forEach { type ->
                    OutlinedButton(onClick = { viewModel.logCare(type) }) { Text("${careIcon(type)} $type", maxLines = 1, softWrap = false) }
                }
            }

            Text("Care history", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 20.dp, bottom = 8.dp))
            if (ui.events.isEmpty()) {
                Text("No care events yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        items(ui.events, key = { it.id }) { event -> CareEventRow(event) }

        item {
            JournalSection(plantId = plant.id, plantName = plant.name)

            plant.notes?.let { notes ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) { Text(notes, modifier = Modifier.padding(14.dp)) }
            }

            TextButton(onClick = viewModel::deletePlant, modifier = Modifier.padding(top = 16.dp)) {
                Text("Remove ${plant.name} from my garden", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun CareEventRow(event: CareEventEntity) {
    val formatter = remember { DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM) }
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("${careIcon(event.type)} ${event.type.replaceFirstChar { it.uppercase() }}")
        Text(
            runCatching { Instant.parse(event.at).atZone(java.time.ZoneId.systemDefault()).toLocalDate().format(formatter) }.getOrDefault(event.at),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

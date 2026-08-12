package org.silvae.ui.garden

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.data.local.entity.PlantEntity
import org.silvae.domain.care.waterStatusLabel
import java.time.Instant

@Composable
fun GardenScreen(
    padding: PaddingValues,
    onAddPlant: () -> Unit,
    onOpenPlant: (String) -> Unit,
    viewModel: GardenViewModel = hiltViewModel(),
) {
    val plants by viewModel.plants.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(Modifier.padding(24.dp)) {
                Text("YOUR LITTLE PATCH OF GREEN", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(8.dp))
                Text(
                    if (plants.isEmpty()) "Let's grow something lovely." else "Good to see you!",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold,
                )
                Spacer(Modifier.height(8.dp))
                Text("Simple, cheerful plant care — one tiny step at a time.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(18.dp))
                Button(onClick = onAddPlant, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                    Text("Add your first plant  →", fontWeight = FontWeight.Bold)
                }
            }
        }

        if (plants.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("🪴", fontSize = 72.sp)
                Spacer(Modifier.height(10.dp))
                Text("Your plants will live here", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                Text(
                    "Give your plant a name and we'll help with the rest.",
                    modifier = Modifier.padding(top = 6.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f).padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(plants, key = { it.id }) { plant ->
                    PlantRow(plant, onOpenPlant, onWaterNow = { viewModel.waterNow(plant) })
                }
            }
        }
    }
}

@Composable
private fun PlantRow(plant: PlantEntity, onOpen: (String) -> Unit, onWaterNow: () -> Unit) {
    val status = waterStatusLabel(plant.nextWaterAt?.let { runCatching { Instant.parse(it) }.getOrNull() })
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f).padding(end = 8.dp).clickable { onOpen(plant.id) },
            ) {
                Text(plant.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(status.label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
            OutlinedButton(onClick = onWaterNow) { Text("💧 Water") }
        }
    }
}

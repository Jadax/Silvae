package org.silvae.ui.speciesguide

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.domain.care.Units

@Composable
fun SpeciesGuideScreen(
    padding: PaddingValues,
    onBack: () -> Unit,
    viewModel: SpeciesGuideViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsState()
    val imperial = ui.imperial

    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp).verticalScroll(rememberScrollState()).imePadding()) {
        TextButton(onClick = onBack) { Text("← Discover") }
        val s = ui.species ?: run {
            Text("Loading…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            return
        }

        Text(s.commonNames.firstOrNull() ?: s.scientificName, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
        Text("${s.scientificName} · ${s.family}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(if (s.toxicity.pets) "⚠ Likely toxic to pets" else "🐾 Pet friendly", modifier = Modifier.padding(top = 6.dp))
        s.toxicity.note?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(16.dp)) {
                Fact("💧 Watering", "${Units.volume(s.ideal.waterAmountMl, imperial)} every ${s.ideal.waterIntervalDays.toInt()} days")
                Fact("☀️ Ideal light", "${s.ideal.luxMin.toInt()}–${s.ideal.luxMax.toInt()} lux")
                Fact("🌡️ Temperature", Units.tempRange(s.ideal.tempMinC, s.ideal.tempMaxC, imperial))
                Fact("💦 Humidity", "${s.ideal.humidityMin.toInt()}–${s.ideal.humidityMax.toInt()}%")
                Fact("🌱 Feeding", "Every ${s.ideal.fertIntervalDays.toInt()} days · NPK ${s.ideal.npk.n.toInt()}-${s.ideal.npk.p.toInt()}-${s.ideal.npk.k.toInt()}")
                Fact("🪴 Repotting", "About every ${s.ideal.repotIntervalMonths.toInt()} months")
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(16.dp)) {
                Fact("Drought tolerance", s.tolerance.drought)
                Fact("Shade tolerance", s.tolerance.shade)
                Fact("Cold tolerance", s.tolerance.cold)
                Fact("Growth rate", "${s.growth.rate} · max ${Units.length(s.growth.maxHeightCm, imperial)}")
            }
        }
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(label, fontWeight = FontWeight.Bold)
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

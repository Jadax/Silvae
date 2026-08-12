package org.silvae.ui.doctor

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.domain.doctor.Confidence
import org.silvae.domain.doctor.Symptoms

private data class SelectField(val key: String, val label: String, val options: List<Pair<String, String>>) // value to display label; "" = normal

private val SELECT_FIELDS = listOf(
    SelectField("leafColor", "Leaf colour", listOf("" to "Normal / green", "yellow" to "Yellowing", "pale" to "Pale / washed out", "brown" to "Browning")),
    SelectField("leafCrisp", "Leaf edges & texture", listOf("" to "Normal", "dry-brown" to "Crispy, dry, brown", "brown-tips" to "Brown tips only")),
    SelectField("leafBurn", "Leaf spots / scorch", listOf("" to "None", "brown-spots" to "Brown patches", "pale-patches" to "Pale / bleached patches")),
    SelectField("soil", "Soil moisture", listOf("" to "Just right", "dry" to "Dry", "moist" to "Moist / damp", "soaked" to "Soaked / waterlogged")),
    SelectField("light", "Where it sits", listOf("" to "Bright, indirect", "low" to "Low light corner", "medium" to "Medium light", "high" to "Bright light")),
    SelectField("envHumidity", "Room humidity", listOf("" to "Normal", "low" to "Dry (heating/AC)", "high" to "Humid (bathroom)")),
)

private val CHECK_FIELDS = listOf(
    "droop" to "Leaves are drooping",
    "lowerLeaves" to "Lower leaves yellowing or falling",
    "stretched" to "Stems stretched and leggy",
    "curledLeaves" to "Leaves curling or cupping",
    "spotsOnExposed" to "Spots mainly on the sun-facing side",
    "directSun" to "Plant sits in direct sun",
    "webbing" to "Fine webbing between leaves",
    "stippling" to "Tiny pale dots / stippling on leaves",
    "whiteFluff" to "White fluffy patches",
    "stickyResidue" to "Sticky residue on leaves",
    "insects" to "Tiny insects visible",
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DoctorScreen(padding: PaddingValues, viewModel: DoctorViewModel = hiltViewModel()) {
    val ui by viewModel.ui.collectAsState()
    val context = LocalContext.current

    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.identifyPhoto(context.contentResolver, uri)
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text("Plant Doctor", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
            Text(
                "Identify a plant from a photo, or describe what looks wrong.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("What plant is this?", fontWeight = FontWeight.Bold)
                    Button(
                        onClick = { pickPhoto.launch("image/*") },
                        enabled = !ui.photoId.busy,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        modifier = Modifier.padding(top = 10.dp),
                    ) { Text(if (ui.photoId.busy) "Looking…" else "Choose a photo") }

                    ui.photoId.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }

                    ui.photoId.result?.let { result ->
                        Column(Modifier.padding(top = 10.dp)) {
                            if (ui.photoId.matchedSpecies.isNotEmpty()) {
                                val best = ui.photoId.matchedSpecies.first()
                                Text("Looks like ${best.commonNames.firstOrNull() ?: best.scientificName}", fontWeight = FontWeight.Bold)
                            } else if (!result.species.isNullOrEmpty()) {
                                Text("We matched ${result.species!!.first().scientificName}, but there's no care guide for it yet.")
                            } else {
                                Text("No species recognized.")
                            }
                            result.isHealthy?.let { health ->
                                val pct = ((health.probability ?: 0.0) * 100).toInt()
                                Text(if (health.binary == true) "Health: looks healthy ($pct%)" else "Health: possible issue detected ($pct%)")
                            }
                            ui.photoId.pest?.let { pest ->
                                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text("${pest.icon} ${pest.pest} (${pest.severity})", fontWeight = FontWeight.Bold)
                                        pest.treatments.forEach { Text("• $it", modifier = Modifier.padding(top = 2.dp)) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("What does the plant look like?", fontWeight = FontWeight.Bold)
                    Text("Tick everything you can see.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        items(SELECT_FIELDS) { field ->
            Column(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
                Text(field.label, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    field.options.forEach { (value, optLabel) ->
                        val selected = ui.symptoms.stringField(field.key) == value
                        if (selected) {
                            Button(onClick = { viewModel.updateSymptom { it.withStringField(field.key, value) } }) { Text(optLabel) }
                        } else {
                            OutlinedButton(onClick = { viewModel.updateSymptom { it.withStringField(field.key, value) } }) { Text(optLabel) }
                        }
                    }
                }
            }
        }

        items(CHECK_FIELDS) { (key, label) ->
            val checked = ui.symptoms.boolField(key)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = checked, onCheckedChange = { v -> viewModel.updateSymptom { it.withBoolField(key, v) } })
                Text(label)
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = viewModel::checkSymptoms, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) { Text("Check symptoms") }
                OutlinedButton(onClick = viewModel::reset) { Text("Reset") }
            }
        }

        ui.results?.let { results ->
            item {
                Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Diagnosis", fontWeight = FontWeight.ExtraBold)
                        if (results.isEmpty()) {
                            Text("Nothing stands out from what you described. Good news.")
                        } else {
                            results.forEach { d ->
                                Column(Modifier.padding(top = 10.dp)) {
                                    Text("${d.likelyCause} · ${d.confidence.label()}", fontWeight = FontWeight.Bold)
                                    d.treatment.forEach { Text("• $it") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun Confidence.label() = when (this) {
    Confidence.HIGH -> "high confidence"
    Confidence.MEDIUM -> "medium confidence"
    Confidence.LOW -> "low confidence"
}

private fun Symptoms.stringField(key: String): String = (get(key) as? String) ?: ""

private fun Symptoms.withStringField(key: String, value: String): Symptoms {
    val v = value.ifEmpty { null }
    return when (key) {
        "leafColor" -> copy(leafColor = v)
        "leafCrisp" -> copy(leafCrisp = v)
        "leafBurn" -> copy(leafBurn = v)
        "soil" -> copy(soil = v)
        "light" -> copy(light = v)
        "envHumidity" -> copy(envHumidity = v)
        else -> this
    }
}

private fun Symptoms.boolField(key: String): Boolean = get(key) as? Boolean ?: false

private fun Symptoms.withBoolField(key: String, value: Boolean): Symptoms = when (key) {
    "droop" -> copy(droop = value)
    "lowerLeaves" -> copy(lowerLeaves = value)
    "stretched" -> copy(stretched = value)
    "curledLeaves" -> copy(curledLeaves = value)
    "spotsOnExposed" -> copy(spotsOnExposed = value)
    "directSun" -> copy(directSun = value)
    "webbing" -> copy(webbing = value)
    "stippling" -> copy(stippling = value)
    "whiteFluff" -> copy(whiteFluff = value)
    "stickyResidue" -> copy(stickyResidue = value)
    "insects" -> copy(insects = value)
    else -> this
}

package org.silvae.ui.addplant

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.domain.care.Species

@Composable
fun AddPlantScreen(
    padding: PaddingValues,
    onCreated: (String) -> Unit,
    viewModel: AddPlantViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val imperial by viewModel.imperial.collectAsState()

    LaunchedEffect(state.createdPlantId) {
        state.createdPlantId?.let(onCreated)
    }

    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp).verticalScroll(rememberScrollState()).imePadding()) {
        Text("Add a plant", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
        Text("Just a few friendly questions, then we'll make a simple care plan.", color = MaterialTheme.colorScheme.onSurfaceVariant)

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(18.dp)) {
                when (state.step) {
                    1 -> StepName(state.name, viewModel::setName)
                    2 -> StepSpecies(state, viewModel)
                    3 -> StepLastCare(state, viewModel)
                    else -> StepHome(state, viewModel, imperial)
                }

                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }

                Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    if (state.step > 1) {
                        OutlinedButton(onClick = viewModel::back) { Text("Back") }
                    } else {
                        Row {}
                    }
                    if (state.step < 4) {
                        Button(onClick = viewModel::next, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                            Text("Continue →")
                        }
                    } else {
                        Button(
                            onClick = viewModel::submit,
                            enabled = !state.saving,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        ) { Text(if (state.saving) "Saving…" else "Create care plan 🌱") }
                    }
                }
            }
        }
    }
}

@Composable
private fun StepName(name: String, onChange: (String) -> Unit) {
    Text("Who's joining your garden?", fontWeight = FontWeight.Bold)
    OutlinedTextField(
        value = name,
        onValueChange = onChange,
        label = { Text("What do you call it?") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
    )
}

@Composable
private fun StepSpecies(state: AddPlantState, viewModel: AddPlantViewModel) {
    val context = LocalContext.current
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.identifyFromPhoto(context.contentResolver, uri)
    }

    Text("What kind of plant is ${state.name.ifBlank { "this" }}?", fontWeight = FontWeight.Bold)

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("Not sure? Identify it from a photo", fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = { pickPhoto.launch("image/*") }, enabled = !state.photoId.busy, modifier = Modifier.padding(top = 8.dp)) {
                Text(if (state.photoId.busy) "Looking…" else "📷 Choose a photo")
            }
            state.photoId.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
            state.photoId.matched?.let { species ->
                Text(
                    "Looks like ${species.commonNames.firstOrNull() ?: species.scientificName} — confirm below or pick another.",
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            state.photoId.unmatchedName?.let { name ->
                Text("We matched $name, but there's no care guide for it yet. Pick the closest match below.", modifier = Modifier.padding(top = 8.dp))
            }
            if (state.photoId.healthy == false) {
                Text(
                    "🩺 This photo may show a problem${state.photoId.diseaseName?.let { ": $it" } ?: ""}. You can check the Plant Doctor after adding it.",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 8.dp),
                )
            } else if (state.photoId.healthy == true) {
                Text("✓ Looks healthy in this photo.", modifier = Modifier.padding(top = 8.dp))
            }
        }
    }

    OutlinedTextField(
        value = state.speciesQuery,
        onValueChange = viewModel::setSpeciesQuery,
        label = { Text("Or search the plant library") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 8.dp),
    )
    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp)) {
        items(state.speciesResults, key = { it.slug }) { species ->
            SpeciesRow(species, selected = species.slug == state.selectedSpecies?.slug, onClick = { viewModel.selectSpecies(species) })
        }
    }
}

@Composable
private fun SpeciesRow(species: Species, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ),
        onClick = onClick,
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text(species.commonNames.firstOrNull() ?: species.scientificName, fontWeight = FontWeight.Bold)
                Text(species.scientificName, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (selected) Text("✓", fontWeight = FontWeight.ExtraBold)
        }
    }
}

private val DAY_OPTIONS = listOf(0 to "Today", 1 to "Yesterday", 3 to "A few days ago", 7 to "About a week ago", 14 to "Two weeks ago")

@Composable
private fun StepLastCare(state: AddPlantState, viewModel: AddPlantViewModel) {
    Text("When did you last water it?", fontWeight = FontWeight.Bold)
    Text("This sets an accurate starting point for the schedule.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Column(modifier = Modifier.padding(top = 10.dp)) {
        DAY_OPTIONS.forEach { (days, label) ->
            ChoiceRow(label, selected = !state.neverWatered && state.lastWateredDaysAgo == days) { viewModel.setLastWatered(days, false) }
        }
        ChoiceRow("Not sure / a while ago", selected = state.neverWatered) { viewModel.setLastWatered(null, true) }
    }

    Text("When did you last fertilize it?", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 18.dp))
    Text("Optional — skip if you're not sure or haven't yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Column(modifier = Modifier.padding(top = 10.dp)) {
        DAY_OPTIONS.forEach { (days, label) ->
            ChoiceRow(label, selected = !state.neverFertilized && state.lastFertilizedDaysAgo == days) { viewModel.setLastFertilized(days, false) }
        }
        ChoiceRow("Haven't fed it / not sure", selected = state.neverFertilized) { viewModel.setLastFertilized(null, true) }
    }
}

@Composable
private fun ChoiceRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ),
        onClick = onClick,
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label)
            if (selected) Text("✓", fontWeight = FontWeight.ExtraBold)
        }
    }
}

private val POT_TYPES = listOf("plastic", "terracotta", "ceramic", "self-watering")
private val SOIL_TYPES = listOf("well-draining", "standard", "retentive")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepHome(state: AddPlantState, viewModel: AddPlantViewModel, imperial: Boolean) {
    Text("Where will ${state.name.ifBlank { "your plant" }} live?", fontWeight = FontWeight.Bold)
    Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("indoor" to "🏠 Indoor", "outdoor" to "☀️ Outdoor").forEach { (value, label) ->
            val selected = state.locationType == value
            if (selected) {
                Button(onClick = { viewModel.setLocationType(value) }) { Text(label) }
            } else {
                OutlinedButton(onClick = { viewModel.setLocationType(value) }) { Text(label) }
            }
        }
    }

    Text("Pot type", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 18.dp))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
        POT_TYPES.forEach { type ->
            val selected = state.potType == type
            if (selected) {
                Button(onClick = { viewModel.setPotType(type) }) { Text(type.replaceFirstChar { it.uppercase() }) }
            } else {
                OutlinedButton(onClick = { viewModel.setPotType(type) }) { Text(type.replaceFirstChar { it.uppercase() }) }
            }
        }
    }

    Text("Soil", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 18.dp))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
        SOIL_TYPES.forEach { type ->
            val selected = state.soilType == type
            if (selected) {
                Button(onClick = { viewModel.setSoilType(type) }) { Text(type.replaceFirstChar { it.uppercase() }) }
            } else {
                OutlinedButton(onClick = { viewModel.setSoilType(type) }) { Text(type.replaceFirstChar { it.uppercase() }) }
            }
        }
    }

    Text(
        "Pot size — bigger pots hold more water and soil, so this shapes the watering and feeding schedule.",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 18.dp, bottom = 6.dp),
    )
    OutlinedTextField(
        value = state.potSize,
        onValueChange = viewModel::setPotSize,
        label = { Text(if (imperial) "Pot size (in)" else "Pot size (cm)") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth(0.6f),
    )
}

package org.silvae.ui.onboarding

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.ui.account.SettingsViewModel

/**
 * First-run onboarding — location and units, before the user ever sees an
 * empty garden. Mirrors apps/web/src/pages/Onboarding.tsx's step pattern.
 * Shown once (gated on settings.onboarded) right after sign-up/sign-in.
 */
@Composable
fun OnboardingScreen(viewModel: SettingsViewModel = hiltViewModel()) {
    var step by remember { mutableIntStateOf(0) }
    val settings by viewModel.settings.collectAsState()
    val location by viewModel.location.collectAsState()
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) viewModel.detectLocation()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()).imePadding(),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 16.dp)) {
            repeat(2) { i ->
                Text(
                    if (i == step) "●" else "○",
                    color = if (i <= step) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp)) {
                when (step) {
                    0 -> {
                        Text("Welcome to Silvae", fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                        Text("Where do your plants live?", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
                        Text(
                            "Your location powers season-aware advice, real weather, and outdoor warnings. Nothing leaves this device.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 6.dp, bottom = 14.dp),
                        )
                        Button(
                            onClick = { permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
                            enabled = !location.detecting,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        ) { Text(if (location.detecting) "Finding you…" else "📍 Use my current location") }

                        OutlinedTextField(
                            value = location.query,
                            onValueChange = viewModel::setQuery,
                            label = { Text("Or search for a city") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 6.dp),
                        )
                        OutlinedButton(onClick = viewModel::search, enabled = !location.searching && location.query.isNotBlank()) {
                            Text(if (location.searching) "…" else "Search")
                        }
                        location.results.forEach { place ->
                            Text(
                                place.label,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable { viewModel.choosePlace(place) },
                            )
                        }
                        location.message?.let { Text(it, modifier = Modifier.padding(top = 8.dp)) }
                    }
                    else -> {
                        Text("Almost there", fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                        Text("Metric or imperial?", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
                        Text(
                            "How you'd like watering amounts, temperatures, and sizes shown. You can change this later.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 6.dp, bottom = 14.dp),
                        )
                        val isImperial = settings?.units == "imperial"
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            UnitChoice("Metric", "ml · °C · cm", !isImperial) { viewModel.setUnits(false) }
                            UnitChoice("Imperial", "fl oz · °F · in", isImperial) { viewModel.setUnits(true) }
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    if (step > 0) TextButton(onClick = { step -= 1 }) { Text("Back") } else Row {}
                    if (step < 1) {
                        Button(onClick = { step += 1 }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) { Text("Continue →") }
                    } else {
                        Button(
                            onClick = { viewModel.setOnboarded(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        ) { Text("Let's grow 🌱") }
                    }
                }
            }
        }
    }
}

@Composable
private fun UnitChoice(title: String, subtitle: String, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

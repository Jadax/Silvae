package org.silvae.ui.account

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import org.silvae.auth.AuthStatus
import org.silvae.auth.AuthViewModel

@Composable
fun AccountScreen(
    padding: PaddingValues,
    authViewModel: AuthViewModel = hiltViewModel(),
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    deleteAccountViewModel: DeleteAccountViewModel = hiltViewModel(),
) {
    val status by authViewModel.status.collectAsState()
    val settings by settingsViewModel.settings.collectAsState()
    val location by settingsViewModel.location.collectAsState()
    val deleteState by deleteAccountViewModel.state.collectAsState()
    val context = LocalContext.current
    var confirmingDelete by remember { mutableStateOf(false) }

    LaunchedEffect(deleteState.done) {
        if (deleteState.done) authViewModel.signOut()
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) settingsViewModel.detectLocation()
    }

    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(18.dp).verticalScroll(rememberScrollState()).imePadding()) {
        Text("You", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(18.dp)) {
                val signedIn = status as? AuthStatus.SignedIn
                Text(signedIn?.user?.displayName ?: signedIn?.user?.email ?: "", fontWeight = FontWeight.Bold)
                Text("Signed in and syncing with Firestore.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(
                    onClick = authViewModel::signOut,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                    modifier = Modifier.padding(top = 12.dp),
                ) { Text("Sign out") }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Where are your plants?", fontWeight = FontWeight.Bold)
                Text(
                    settings?.locationLabel?.let { "Using weather for $it." }
                        ?: "Set your location for real weather, seasons, and outdoor warnings.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = {
                        permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    },
                    enabled = !location.detecting,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                    modifier = Modifier.padding(top = 10.dp),
                ) { Text(if (location.detecting) "Finding you…" else "📍 Use my current location") }

                OutlinedTextField(
                    value = location.query,
                    onValueChange = settingsViewModel::setQuery,
                    label = { Text("Or search for a city") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 6.dp),
                )
                OutlinedButton(onClick = settingsViewModel::search, enabled = !location.searching && location.query.isNotBlank()) {
                    Text(if (location.searching) "…" else "Search")
                }
                location.results.forEach { place ->
                    Text(
                        place.label,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                            .clickable { settingsViewModel.choosePlace(place) },
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                }
                location.message?.let { Text(it, modifier = Modifier.padding(top = 8.dp)) }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Do pets live here?", fontWeight = FontWeight.Bold)
                Text("We'll flag risky plants for your cat or dog and add a pet-safe filter to Discover.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Checkbox(checked = settings?.petCat == true, onCheckedChange = { settingsViewModel.setPets(it, settings?.petDog == true) })
                    Text("🐱 Cat")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = settings?.petDog == true, onCheckedChange = { settingsViewModel.setPets(settings?.petCat == true, it) })
                    Text("🐶 Dog")
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 24.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Delete account", fontWeight = FontWeight.Bold)
                Text(
                    "Permanently deletes your account and every plant, photo, and care record tied to it. This can't be undone.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                deleteState.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
                OutlinedButton(
                    onClick = { confirmingDelete = true },
                    enabled = !deleteState.busy,
                    modifier = Modifier.padding(top = 10.dp),
                ) { Text(if (deleteState.busy) "Deleting…" else "Delete account and data", color = MaterialTheme.colorScheme.error) }
            }
        }
    }

    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("Delete your account?") },
            text = { Text("This permanently deletes your account, plants, photos, and care history. This can't be undone.") },
            confirmButton = {
                TextButton(onClick = { confirmingDelete = false; deleteAccountViewModel.deleteAccount() }) {
                    Text("Delete everything", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("Cancel") } },
        )
    }
}

package org.silvae.ui.plantdetail

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import org.silvae.data.local.entity.PlantPhotoEntity
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@Composable
fun PlantAvatar(avatarPath: String?, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(96.dp).clip(RoundedCornerShape(28.dp)).background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        if (avatarPath != null) {
            AsyncImage(model = avatarPath, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Text("🪴", fontSize = androidx.compose.ui.unit.TextUnit(40f, androidx.compose.ui.unit.TextUnitType.Sp))
        }
    }
}

@Composable
fun JournalSection(plantId: String, plantName: String, viewModel: JournalViewModel = hiltViewModel()) {
    val entries by viewModel.entries.collectAsState()
    var noteDraft by remember { mutableStateOf("") }
    var openEntry by remember { mutableStateOf<PlantPhotoEntity?>(null) }

    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.addPhoto(uri)
    }

    Column(modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Growth journal", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Button(onClick = { pickPhoto.launch("image/*") }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                Text("＋ Add photo")
            }
        }
        Text("Snap a photo or jot a note every so often. It's nice to look back.", color = MaterialTheme.colorScheme.onSurfaceVariant)

        Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
            OutlinedTextField(
                value = noteDraft,
                onValueChange = { noteDraft = it },
                label = { Text("How's $plantName doing today?") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = { viewModel.addNote(noteDraft); noteDraft = "" },
                enabled = noteDraft.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                modifier = Modifier.padding(start = 8.dp),
            ) { Text("Log") }
        }

        if (entries.isEmpty()) {
            Text("No journal entries yet.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
            return
        }

        val photoEntries = entries.filter { it.kind != "note" }
        if (photoEntries.size >= 2) {
            BeforeAfterRow(photoEntries.minByOrNull { it.at }!!, photoEntries.maxByOrNull { it.at }!!)
        }

        if (photoEntries.isNotEmpty()) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxWidth().height((120 * ((photoEntries.size + 2) / 3)).dp).padding(top = 12.dp),
            ) {
                items(photoEntries, key = { it.id }) { entry ->
                    AsyncImage(
                        model = entry.localPath,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.aspectRatio(1f).padding(3.dp).clip(RoundedCornerShape(10.dp)).clickable { openEntry = entry },
                    )
                }
            }
        }

        Column(modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
            entries.forEach { entry -> JournalEntryRow(entry, viewModel) }
        }
    }

    openEntry?.let { entry ->
        Dialog(onDismissRequest = { openEntry = null }) {
            Card(shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(12.dp)) {
                    AsyncImage(model = entry.localPath, contentDescription = null, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Button(onClick = { viewModel.setAvatar(entry); openEntry = null }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                            Text("Use as avatar")
                        }
                        OutlinedButton(onClick = { viewModel.deleteEntry(entry); openEntry = null }) { Text("Delete") }
                    }
                }
            }
        }
    }
}

@Composable
private fun BeforeAfterRow(before: PlantPhotoEntity, after: PlantPhotoEntity) {
    Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Before", color = MaterialTheme.colorScheme.onSurfaceVariant)
            AsyncImage(model = before.localPath, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(12.dp)))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("After", color = MaterialTheme.colorScheme.onSurfaceVariant)
            AsyncImage(model = after.localPath, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(12.dp)))
        }
    }
}

@Composable
private fun JournalEntryRow(entry: PlantPhotoEntity, viewModel: JournalViewModel) {
    val comments by viewModel.commentsFor(entry.id).collectAsState(initial = emptyList())
    var commentDraft by remember { mutableStateOf("") }
    val formatter = remember { DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM) }
    val dateLabel = runCatching { Instant.parse(entry.at).atZone(java.time.ZoneId.systemDefault()).toLocalDate().format(formatter) }.getOrDefault(entry.at)

    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(if (entry.kind == "note") "💬 $dateLabel" else "📷 $dateLabel", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("✕", modifier = Modifier.clickable { viewModel.deleteEntry(entry) })
            }
            entry.note?.let { Text(it, modifier = Modifier.padding(top = 4.dp)) }
            comments.forEach { c -> Text("🌿 ${c.text}", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp)) }
            Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                OutlinedTextField(value = commentDraft, onValueChange = { commentDraft = it }, label = { Text("Comment…") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedButton(onClick = { viewModel.addComment(entry.id, commentDraft); commentDraft = "" }, enabled = commentDraft.isNotBlank(), modifier = Modifier.padding(start = 8.dp)) {
                    Text("Reply")
                }
            }
        }
    }
}

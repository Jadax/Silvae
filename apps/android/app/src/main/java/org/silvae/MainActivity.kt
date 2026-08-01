package org.silvae

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dagger.hilt.android.AndroidEntryPoint
import org.silvae.ui.theme.SilvaeTheme
import org.silvae.ui.theme.Sunflower

private data class AppTab(val label: String, val symbol: String)

private val tabs = listOf(
    AppTab("My garden", "♧"),
    AppTab("Discover", "⌕"),
    AppTab("Doctor", "+"),
    AppTab("You", "☺"),
)

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SilvaeTheme { SilvaeShell() } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SilvaeShell() {
    var selectedTab by remember { mutableIntStateOf(0) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(13.dp))
                                .background(MaterialTheme.colorScheme.primary),
                            contentAlignment = Alignment.Center,
                        ) { Text("♧", color = MaterialTheme.colorScheme.onPrimary, fontSize = 24.sp) }
                        Column(Modifier.padding(start = 10.dp)) {
                            Text("Silvae", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                            Text("Grow happy", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        icon = { Text(tab.symbol, fontWeight = FontWeight.Bold, fontSize = 21.sp) },
                        label = { Text(tab.label, fontSize = 10.sp) },
                    )
                }
            }
        },
    ) { padding ->
        when (selectedTab) {
            0 -> GardenScreen(padding)
            1 -> FriendlyPlaceholder(padding, "Discover", "Find your next leafy friend", "⌕")
            2 -> FriendlyPlaceholder(padding, "Plant doctor", "Tell us what looks wrong", "+")
            else -> FriendlyPlaceholder(padding, "Your space", "Settings, sync, and good vibes", "☺")
        }
    }
}

@Composable
private fun GardenScreen(padding: PaddingValues) {
    Column(
        modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(Modifier.padding(24.dp)) {
                Text("YOUR LITTLE PATCH OF GREEN", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(8.dp))
                Text("Let’s grow something lovely.", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(8.dp))
                Text("Simple, cheerful plant care—one tiny step at a time.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(18.dp))
                Button(
                    onClick = { },
                    colors = ButtonDefaults.buttonColors(containerColor = Sunflower, contentColor = MaterialTheme.colorScheme.onSecondary),
                    shape = RoundedCornerShape(15.dp),
                ) { Text("Add your first plant  →", fontWeight = FontWeight.Bold) }
            }
        }
        Spacer(Modifier.height(28.dp))
        Text("🪴", fontSize = 72.sp)
        Spacer(Modifier.height(10.dp))
        Text("Your plants will live here", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        Text(
            "Give your plant a name and we’ll help with the rest.",
            modifier = Modifier.padding(top = 6.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun FriendlyPlaceholder(padding: PaddingValues, title: String, subtitle: String, symbol: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(100.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Text(symbol, color = MaterialTheme.colorScheme.primary, fontSize = 48.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(20.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
fun SilvaePreview() { SilvaeTheme { SilvaeShell() } }

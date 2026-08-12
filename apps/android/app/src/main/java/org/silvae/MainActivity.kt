package org.silvae

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import org.silvae.auth.AuthScreen
import org.silvae.auth.AuthStatus
import org.silvae.auth.AuthViewModel
import org.silvae.ui.account.AccountScreen
import org.silvae.ui.addplant.AddPlantScreen
import org.silvae.ui.discover.DiscoverScreen
import org.silvae.ui.doctor.DoctorScreen
import org.silvae.ui.garden.GardenScreen
import org.silvae.ui.nav.Destinations
import org.silvae.ui.onboarding.OnboardingScreen
import org.silvae.ui.account.SettingsViewModel
import org.silvae.ui.plantdetail.PlantDetailScreen
import org.silvae.ui.speciesguide.SpeciesGuideScreen
import org.silvae.ui.theme.SilvaeTheme

private data class AppTab(val route: String, val label: String, val symbol: String)

private val tabs = listOf(
    AppTab(Destinations.GARDEN, "My garden", "♧"),
    AppTab(Destinations.DISCOVER, "Discover", "⌕"),
    AppTab(Destinations.DOCTOR, "Doctor", "+"),
    AppTab(Destinations.ACCOUNT, "You", "☺"),
)

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SilvaeTheme { SilvaeRoot() } }
    }
}

/**
 * Auth gate — mirrors apps/web/src/App.tsx: Loading → SignedOut(AuthScreen) →
 * SignedIn(Onboarding once, then shell). No guest mode.
 */
@Composable
fun SilvaeRoot(authViewModel: AuthViewModel = hiltViewModel(), settingsViewModel: SettingsViewModel = hiltViewModel()) {
    val status by authViewModel.status.collectAsState()
    val settings by settingsViewModel.settings.collectAsState()
    val hasLoadedSettings by settingsViewModel.hasLoadedSettings.collectAsState()

    when (status) {
        is AuthStatus.Loading -> Loading()
        is AuthStatus.SignedOut -> AuthScreen()
        is AuthStatus.SignedIn -> when {
            !hasLoadedSettings -> Loading()
            settings?.onboarded != true -> OnboardingScreen()
            else -> SilvaeShell()
        }
    }
}

@Composable
private fun Loading() {
    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) { CircularProgressIndicator() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SilvaeShell() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val context = LocalContext.current

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Brand() },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            if (currentRoute in tabs.map { it.route }) {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(Destinations.GARDEN) { inclusive = false }
                                    launchSingleTop = true
                                }
                            },
                            icon = { Text(tab.symbol, fontWeight = FontWeight.Bold, fontSize = 21.sp) },
                            label = { Text(tab.label, fontSize = 10.sp) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        SilvaeNavHost(navController, padding)
    }
}

@Composable
private fun SilvaeNavHost(navController: NavHostController, padding: PaddingValues) {
    NavHost(navController = navController, startDestination = Destinations.GARDEN) {
        composable(Destinations.GARDEN) {
            GardenScreen(
                padding = padding,
                onAddPlant = { navController.navigate(Destinations.ADD_PLANT) },
                onOpenPlant = { id -> navController.navigate(Destinations.plantDetail(id)) },
            )
        }
        composable(Destinations.DISCOVER) {
            DiscoverScreen(padding = padding, onOpenSpecies = { slug -> navController.navigate(Destinations.speciesGuide(slug)) })
        }
        composable(Destinations.SPECIES_GUIDE) {
            SpeciesGuideScreen(padding = padding, onBack = { navController.popBackStack() })
        }
        composable(Destinations.DOCTOR) { DoctorScreen(padding = padding) }
        composable(Destinations.ACCOUNT) { AccountScreen(padding) }
        composable(Destinations.ADD_PLANT) {
            AddPlantScreen(
                padding = padding,
                onCreated = { id ->
                    navController.navigate(Destinations.plantDetail(id)) {
                        popUpTo(Destinations.GARDEN)
                    }
                },
            )
        }
        composable(Destinations.PLANT_DETAIL) {
            PlantDetailScreen(padding = padding, onBack = { navController.popBackStack(Destinations.GARDEN, inclusive = false) })
        }
    }
}

@Composable
private fun Brand() {
    androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(38.dp)
                .background(MaterialTheme.colorScheme.primary, shape = androidx.compose.foundation.shape.RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center,
        ) { Text("♧", color = MaterialTheme.colorScheme.onPrimary, fontSize = 24.sp) }
        Column(Modifier.padding(start = 10.dp)) {
            Text("Silvae", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            Text("Grow happy", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
        }
    }
}

package org.silvae.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Forest = Color(0xFF2D7650)
val ForestDark = Color(0xFF205C3D)
val Sage = Color(0xFFDCEBDD)
val Sunflower = Color(0xFFF2B84B)
val Cream = Color(0xFFFFFAF0)
val Ink = Color(0xFF21352B)

private val LightColors = lightColorScheme(
    primary = Forest,
    onPrimary = Color.White,
    primaryContainer = Sage,
    onPrimaryContainer = ForestDark,
    secondary = Sunflower,
    onSecondary = Ink,
    background = Cream,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFF4F7EE),
    outline = Color(0xFFDCE2D7),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF72C895),
    onPrimary = Color(0xFF07391F),
    primaryContainer = Color(0xFF274936),
    onPrimaryContainer = Color(0xFFB5EBC6),
    secondary = Color(0xFFF1BD58),
    background = Color(0xFF121B16),
    onBackground = Color(0xFFF1F6EE),
    surface = Color(0xFF1B2821),
    onSurface = Color(0xFFF1F6EE),
    surfaceVariant = Color(0xFF223229),
    outline = Color(0xFF405449),
)

@Composable
fun SilvaeTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}

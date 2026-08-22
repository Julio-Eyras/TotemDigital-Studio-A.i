package br.com.smartchannel.playeradmon.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5B8DEF),
    secondary = Color(0xFF7AD0A8),
    background = Color(0xFF101418),
    surface = Color(0xFF1A1F26),
    error = Color(0xFFE57373),
)

@Composable
fun PlayerAdMonTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}

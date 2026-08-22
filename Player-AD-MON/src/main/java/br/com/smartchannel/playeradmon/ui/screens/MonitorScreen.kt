package br.com.smartchannel.playeradmon.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import br.com.smartchannel.playeradmon.data.telemetry.PlaybackConnectionStatus
import br.com.smartchannel.playeradmon.model.PlaybackFormatting
import br.com.smartchannel.playeradmon.ui.viewmodel.MonitorViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonitorScreen(
    viewModel: MonitorViewModel,
    onBack: () -> Unit,
) {
    val totem by viewModel.totem.collectAsState()
    val totemError by viewModel.totemError.collectAsState()
    val state by viewModel.playbackState.collectAsState()
    val connection by viewModel.connectionStatus.collectAsState()
    val lastError by viewModel.lastError.collectAsState()
    val tick by viewModel.tickMs.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(totem?.name ?: "Monitor #${viewModel.totemId}") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val online = totem?.isOnline == true
            Text(
                "Totem: ${totem?.statusLabel ?: "…"}",
                color = if (online) Color(0xFF7AD0A8) else Color(0xFFE57373),
            )
            Text(
                "Ligação WS: ${connectionLabel(connection)}",
                style = MaterialTheme.typography.bodySmall,
            )

            totemError?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            lastError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(8.dp))

            val playback = state
            if (playback == null) {
                Text("A carregar estado de reprodução…")
            } else {
                Text("A reproduzir agora", style = MaterialTheme.typography.titleMedium)
                Text(playback.mediaName, style = MaterialTheme.typography.headlineSmall)
                playback.mediaType?.let {
                    Text("Tipo: $it", style = MaterialTheme.typography.bodyMedium)
                }
                Text(
                    PlaybackFormatting.statusLabel(playback),
                    color = if (playback.stale) Color(0xFFFFB74D) else MaterialTheme.colorScheme.secondary,
                )
                Text(PlaybackFormatting.timingLine(playback, tick))

                if (playback.durationMs > 0 && playback.status !in setOf("empty", "idle", "display_off")) {
                    LinearProgressIndicator(
                        progress = { playback.progressFraction(tick) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                    )
                }

                playback.nextMediaName?.let { next ->
                    Spacer(Modifier.height(12.dp))
                    Text("A seguir", style = MaterialTheme.typography.titleSmall)
                    Text(next)
                    playback.nextMediaType?.let { Text("Tipo: $it") }
                }

                totem?.currentPlaylistId?.let {
                    Spacer(Modifier.height(12.dp))
                    Text("Playlist actual: #$it", style = MaterialTheme.typography.bodySmall)
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                "Só metadados — sem preview de vídeo/imagem e sem comandos remotos.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            )
        }
    }
}

private fun connectionLabel(status: PlaybackConnectionStatus): String = when (status) {
    PlaybackConnectionStatus.Connecting -> "A ligar…"
    PlaybackConnectionStatus.Connected -> "Ligado"
    PlaybackConnectionStatus.Disconnected -> "Desligado (poll REST)"
}

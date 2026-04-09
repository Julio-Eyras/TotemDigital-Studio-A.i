package com.smartsignage.player.hls

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.*

/**
 * HLSPlayer - Player de vídeo HLS usando ExoPlayer minimalista
 * Hardware decoding automático, CPU baixíssimo
 */
class HLSPlayer(private val context: Context) {
    private var exoPlayer: ExoPlayer? = null
    private var currentStream: String? = null
    private var watchdogJob: Job? = null
    private var lastActivity: Long = System.currentTimeMillis()
    
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    companion object {
        private const val TAG = "HLSPlayer"
    }

    /**
     * Inicializa o player
     */
    fun initialize() {
        if (exoPlayer != null) {
            Log.w(TAG, "Player já inicializado")
            return
        }

        exoPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(
                DefaultMediaSourceFactory(context)
            )
            .build()
            .apply {
                // Listener para eventos
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        lastActivity = System.currentTimeMillis()
                        when (playbackState) {
                            Player.STATE_READY -> Log.d(TAG, "Player pronto")
                            Player.STATE_ENDED -> Log.d(TAG, "Reprodução finalizada")
                            Player.STATE_BUFFERING -> Log.d(TAG, "Buffering...")
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, "Erro no player", error)
                        lastActivity = System.currentTimeMillis()
                        onError?.invoke(error)
                    }
                })
            }

        Log.d(TAG, "Player inicializado")
    }

    /**
     * Reproduz stream HLS
     */
    suspend fun play(streamUrl: String) = withContext(Dispatchers.Main) {
        // Não fazer nada se já está reproduzindo o mesmo stream
        if (currentStream == streamUrl && exoPlayer?.isPlaying == true) {
            Log.d(TAG, "Stream já está sendo reproduzido: $streamUrl")
            return@withContext
        }

        Log.d(TAG, "Trocando para stream: $streamUrl")
        currentStream = streamUrl

        try {
            val mediaItem = MediaItem.fromUri(Uri.parse(streamUrl))
            exoPlayer?.setMediaItem(mediaItem)
            exoPlayer?.prepare()
            exoPlayer?.play()
            
            lastActivity = System.currentTimeMillis()
            Log.d(TAG, "Reprodução iniciada com sucesso")
        } catch (error: Exception) {
            Log.e(TAG, "Erro ao reproduzir", error)
            throw error
        }
    }

    /**
     * Para a reprodução
     */
    fun stop() {
        Log.d(TAG, "Parando reprodução")
        exoPlayer?.stop()
        exoPlayer?.clearMediaItems()
        currentStream = null
        lastActivity = System.currentTimeMillis()
    }

    /**
     * Pausa a reprodução
     */
    fun pause() {
        exoPlayer?.pause()
        lastActivity = System.currentTimeMillis()
    }

    /**
     * Resume a reprodução
     */
    fun resume() {
        exoPlayer?.play()
        lastActivity = System.currentTimeMillis()
    }

    /**
     * Define volume (0.0 a 1.0)
     */
    fun setVolume(volume: Float) {
        exoPlayer?.volume = volume.coerceIn(0f, 1f)
        lastActivity = System.currentTimeMillis()
    }

    /**
     * Obtém URL do stream atual
     */
    fun getCurrentStream(): String? {
        return currentStream
    }

    /**
     * Obtém status do player
     */
    fun getStatus(): String {
        return when (exoPlayer?.playbackState) {
            Player.STATE_IDLE -> "IDLE"
            Player.STATE_BUFFERING -> "BUFFERING"
            Player.STATE_READY -> if (exoPlayer?.isPlaying == true) "PLAYING" else "PAUSED"
            Player.STATE_ENDED -> "ENDED"
            else -> "UNKNOWN"
        }
    }

    /**
     * Inicia watchdog para detectar freezes
     */
    fun startWatchdog(interval: Long = 20000) {
        if (watchdogJob?.isActive == true) {
            Log.w(TAG, "Watchdog já está ativo")
            return
        }

        Log.d(TAG, "Watchdog iniciado (intervalo: ${interval}ms)")

        watchdogJob = scope.launch {
            while (isActive) {
                delay(interval)
                
                val now = System.currentTimeMillis()
                val timeSinceActivity = now - lastActivity

                // Verificar se player está travado
                if (exoPlayer?.playbackState != Player.STATE_READY && 
                    exoPlayer?.playbackState != Player.STATE_BUFFERING) {
                    Log.w(TAG, "Watchdog: Player travado, reiniciando...")
                    restart()
                    continue
                }

                // Verificar se há muito tempo sem atividade (mais de 30 segundos)
                if (timeSinceActivity > 30000 && exoPlayer?.isPlaying == true) {
                    Log.w(TAG, "Watchdog: Sem atividade há muito tempo, verificando estado...")
                    exoPlayer?.play() ?: restart()
                }
            }
        }
    }

    /**
     * Para o watchdog
     */
    fun stopWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
        Log.d(TAG, "Watchdog parado")
    }

    /**
     * Reinicia o player (recarrega stream atual)
     */
    private fun restart() {
        val current = currentStream
        Log.d(TAG, "Reiniciando player...")
        
        exoPlayer?.stop()
        exoPlayer?.clearMediaItems()
        
        if (current != null) {
            scope.launch {
                try {
                    play(current)
                } catch (error: Exception) {
                    Log.e(TAG, "Erro ao reiniciar", error)
                }
            }
        }
        
        lastActivity = System.currentTimeMillis()
    }

    /**
     * Obtém instância do ExoPlayer (para PlayerView)
     */
    fun getExoPlayer(): ExoPlayer? {
        return exoPlayer
    }

    /**
     * Callback para erros (pode ser definido externamente)
     */
    var onError: ((Throwable) -> Unit)? = null

    /**
     * Libera recursos
     */
    fun release() {
        stopWatchdog()
        exoPlayer?.release()
        exoPlayer = null
        scope.cancel()
    }
}


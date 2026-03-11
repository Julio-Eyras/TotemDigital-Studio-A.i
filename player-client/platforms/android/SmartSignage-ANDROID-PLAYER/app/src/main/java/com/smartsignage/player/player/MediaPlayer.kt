package com.smartsignage.player.player

import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.ImageView
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.smartsignage.player.models.PlaylistItem
import com.smartsignage.player.models.DispatchPlanMediaItem
import kotlinx.coroutines.*

/**
 * Media Player - Android
 * Player de mídia para Android TV
 * 
 * Agora suporta tanto PlaylistItem (legado) quanto DispatchPlanMediaItem (novo formato nativo)
 */
class MediaPlayer(private val context: Context) {

    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var imageView: ImageView? = null
    private var webView: WebView? = null
    private var container: ViewGroup? = null
    private var currentItem: Any? = null // Pode ser PlaylistItem ou DispatchPlanMediaItem
    private var onEndCallback: (() -> Unit)? = null
    private var playJob: Job? = null
    private var getLocalPathCallback: ((Int) -> String?)? = null // Callback para obter caminho local

    companion object {
        private const val TAG = "MediaPlayer"
    }

    /**
     * Configura container do player
     */
    fun setContainer(container: ViewGroup) {
        this.container = container
    }

    /**
     * Configura callback para obter caminho local de mídias
     */
    fun setLocalPathProvider(provider: (Int) -> String?) {
        this.getLocalPathCallback = provider
    }

    /**
     * Reproduz item de mídia (formato legado - compatibilidade)
     */
    fun play(item: PlaylistItem, onEnd: () -> Unit) {
        playJob?.cancel()
        playJob = CoroutineScope(Dispatchers.Main).launch {
            stop()

            currentItem = item
            onEndCallback = onEnd

            when (item.type) {
                "video" -> playVideo(item.url, item.duration)
                "image" -> playImage(item.url, item.duration)
                "html" -> playHTML(item.url, item.duration)
                else -> {
                    Log.e(TAG, "Unsupported media type: ${item.type}")
                    onEnd()
                }
            }
        }
    }

    /**
     * Reproduz item de mídia do DispatchPlan (formato nativo - preferencial)
     */
    fun play(mediaItem: DispatchPlanMediaItem, onEnd: () -> Unit) {
        playJob?.cancel()
        playJob = CoroutineScope(Dispatchers.Main).launch {
            stop()

            currentItem = mediaItem
            onEndCallback = onEnd

            // Tentar usar caminho local primeiro (resolução interno → USB)
            val localPath = getLocalPathCallback?.invoke(mediaItem.mediaId)
            val url = if (!localPath.isNullOrEmpty()) {
                if (localPath.startsWith("/")) "file://$localPath" else localPath
            } else {
                mediaItem.url
            }

            when (mediaItem.mediaType.lowercase()) {
                "video" -> playVideo(url, mediaItem.duration)
                "image" -> playImage(url, mediaItem.duration)
                "html", "web" -> playHTML(url, mediaItem.duration)
                else -> {
                    Log.e(TAG, "Unsupported media type: ${mediaItem.mediaType}")
                    onEnd()
                }
            }
        }
    }

    /**
     * Reproduz vídeo
     */
    private suspend fun playVideo(url: String, durationMs: Int? = null) = withContext(Dispatchers.Main) {
        try {
            // Criar ExoPlayer se não existir
            if (exoPlayer == null) {
                exoPlayer = ExoPlayer.Builder(context).build()
                exoPlayer?.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_ENDED) {
                            onEndCallback?.invoke()
                        }
                    }
                })
            }

            // Criar PlayerView se não existir
            if (playerView == null) {
                playerView = PlayerView(context).apply {
                    player = exoPlayer
                    useController = false // Modo kiosk
                }
                container?.addView(playerView)
            }

            // Carregar mídia
            val mediaItem = MediaItem.fromUri(Uri.parse(url))
            exoPlayer?.setMediaItem(mediaItem)
            exoPlayer?.prepare()
            exoPlayer?.play()

        } catch (e: Exception) {
            Log.e(TAG, "Video playback error", e)
            onEndCallback?.invoke()
        }
    }

    /**
     * Reproduz imagem
     */
    private suspend fun playImage(url: String, durationMs: Int? = null) = withContext(Dispatchers.Main) {
        try {
            // Criar ImageView se não existir
            if (imageView == null) {
                imageView = ImageView(context).apply {
                    scaleType = ImageView.ScaleType.CENTER_INSIDE
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
                container?.addView(imageView)
            }

            // Carregar imagem (usar biblioteca como Glide ou Coil)
            // Por enquanto, placeholder
            imageView?.setImageURI(Uri.parse(url))

            // Duração: converter segundos para milissegundos se necessário
            val duration = when {
                durationMs != null && durationMs > 1000 -> durationMs // Já está em ms
                durationMs != null -> durationMs * 1000 // Converter segundos para ms
                else -> 10000 // Padrão: 10 segundos
            }
            delay(duration.toLong())
            onEndCallback?.invoke()

        } catch (e: Exception) {
            Log.e(TAG, "Image playback error", e)
            onEndCallback?.invoke()
        }
    }

    /**
     * Reproduz HTML/Web
     */
    private suspend fun playHTML(url: String, durationMs: Int? = null) = withContext(Dispatchers.Main) {
        try {
            // Criar WebView se não existir
            if (webView == null) {
                webView = WebView(context).apply {
                    settings.javaScriptEnabled = true
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
                container?.addView(webView)
            }

            // Carregar URL
            webView?.loadUrl(url)

            // Duração: converter segundos para milissegundos se necessário
            val duration = when {
                durationMs != null && durationMs > 1000 -> durationMs // Já está em ms
                durationMs != null -> durationMs * 1000 // Converter segundos para ms
                else -> 30000 // Padrão: 30 segundos
            }
            delay(duration.toLong())
            onEndCallback?.invoke()

        } catch (e: Exception) {
            Log.e(TAG, "HTML playback error", e)
            onEndCallback?.invoke()
        }
    }

    /**
     * Para reprodução
     */
    fun stop() {
        playJob?.cancel()
        exoPlayer?.stop()
        exoPlayer?.clearMediaItems()
        currentItem = null
        onEndCallback = null
    }

    /**
     * Resume
     */
    fun resume() {
        exoPlayer?.play()
    }

    /**
     * Pause
     */
    fun pause() {
        exoPlayer?.pause()
    }

    /**
     * Release resources
     */
    fun release() {
        stop()
        exoPlayer?.release()
        exoPlayer = null
        playerView = null
        imageView = null
        webView = null
    }
}


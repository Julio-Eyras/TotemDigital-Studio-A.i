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
import kotlinx.coroutines.*

/**
 * Media Player - Android
 * Player de mídia para Android TV
 */
class MediaPlayer(private val context: Context) {

    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var imageView: ImageView? = null
    private var webView: WebView? = null
    private var container: ViewGroup? = null
    private var currentItem: PlaylistItem? = null
    private var onEndCallback: (() -> Unit)? = null
    private var playJob: Job? = null

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
     * Reproduz item de mídia
     */
    fun play(item: PlaylistItem, onEnd: () -> Unit) {
        playJob?.cancel()
        playJob = CoroutineScope(Dispatchers.Main).launch {
            stop()

            currentItem = item
            onEndCallback = onEnd

            when (item.type) {
                "video" -> playVideo(item)
                "image" -> playImage(item)
                "html" -> playHTML(item)
                else -> {
                    Log.e(TAG, "Unsupported media type: ${item.type}")
                    onEnd()
                }
            }
        }
    }

    /**
     * Reproduz vídeo
     */
    private suspend fun playVideo(item: PlaylistItem) = withContext(Dispatchers.Main) {
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
            val mediaItem = MediaItem.fromUri(Uri.parse(item.url))
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
    private suspend fun playImage(item: PlaylistItem) = withContext(Dispatchers.Main) {
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
            imageView?.setImageURI(Uri.parse(item.url))

            // Duração padrão: 10 segundos
            val duration = item.duration ?: 10000
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
    private suspend fun playHTML(item: PlaylistItem) = withContext(Dispatchers.Main) {
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
            webView?.loadUrl(item.url)

            // Duração padrão: 30 segundos
            val duration = item.duration ?: 30000
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


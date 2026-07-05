package br.com.smartchannel.playerad.util

import android.content.Context
import android.graphics.Bitmap
import android.view.View
import androidx.media3.common.VideoSize
import androidx.media3.ui.PlayerView

/**
 * SUSPENSO (v1.55+): auto-rotação e matriz TextureView.
 * Viewport fullscreen = [PortraitViewportLayout] + [FullscreenViewport] (sem rotação).
 *
 * Playback = ficheiro já correto no cache ([PortraitVideoCacheProcessor]) ou do servidor.
 * Runtime: ExoPlayer FIT, sem matriz TextureView.
 *
 * Reativar: restaurar implementação de v1.54 em git e [PlayerController.AUTO_MEDIA_ORIENTATION].
 */
object MediaViewportRotation {

    const val ENABLED = false

    fun isPortraitMount(displayRotation: Int): Boolean {
        val normalized = ((displayRotation % 4) + 4) % 4
        return normalized == 0 || normalized == 2
    }

    fun rawVideoSize(videoSize: VideoSize): Pair<Int, Int> {
        val w = videoSize.width
        val h = videoSize.height
        return if (w > 0 && h > 0) w to h else 0 to 0
    }

    fun effectiveVideoSize(videoSize: VideoSize): Pair<Int, Int> = rawVideoSize(videoSize)

    @Suppress("UNUSED_PARAMETER")
    fun mountCorrectionRotation(displayRotation: Int, mediaWidth: Int, mediaHeight: Int): Float = 0f

    @Suppress("UNUSED_PARAMETER")
    fun correctionRotation(displayRotation: Int, mediaWidth: Int, mediaHeight: Int): Float = 0f

    @Suppress("UNUSED_PARAMETER")
    fun logicalSurfaceCompensationDegrees(context: Context, displayRotation: Int): Int = 0

    @Suppress("UNUSED_PARAMETER")
    fun totalRotationDegrees(context: Context, displayRotation: Int, videoSize: VideoSize): Float = 0f

    @Suppress("UNUSED_PARAMETER")
    fun imageRotationDegrees(context: Context, displayRotation: Int, mediaWidth: Int, mediaHeight: Int): Float =
        0f

    @Suppress("UNUSED_PARAMETER")
    fun readImageEffectiveSize(path: String): Pair<Int, Int> = 0 to 0

    fun rotateBitmap(source: Bitmap, @Suppress("UNUSED_PARAMETER") degrees: Float): Bitmap = source

    @Suppress("UNUSED_PARAMETER")
    fun applyToPlayerView(
        context: Context,
        displayRotation: Int,
        playerView: PlayerView,
        rotationDegrees: Float,
        videoWidth: Int,
        videoHeight: Int,
    ) {
        // SUSPENSO — sem matriz / content frame expand
    }

    @Suppress("UNUSED_PARAMETER")
    fun applyToImageView(imageView: View, rotationDegrees: Float) {
        // SUSPENSO
    }

    fun resetPlayerView(playerView: PlayerView) {
        resetView(playerView)
    }

    fun resetView(view: View) {
        view.rotation = 0f
        view.translationX = 0f
        view.translationY = 0f
        view.scaleX = 1f
        view.scaleY = 1f
    }
}

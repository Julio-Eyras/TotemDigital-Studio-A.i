package br.com.smartchannel.playerad.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.RectF
import android.media.ExifInterface
import android.view.TextureView
import android.view.View
import androidx.media3.common.VideoSize
import androidx.media3.ui.PlayerView

/**
 * Alinha orientação da mídia à montagem configurada ([displayRotation] portrait vs landscape).
 *
 * Vídeo landscape (16:9) num totem portrait → rotação + zoom para preencher o ecrã.
 * Mídia já portrait (9:16), incluindo vídeo pré-virado externamente → sem rotação extra.
 *
 * Vídeo: [TextureView.setTransform] — girar a [PlayerView] não altera o frame do ExoPlayer.
 * Imagem: rotação do bitmap antes de exibir.
 */
object MediaViewportRotation {

    const val ENABLED = true

    fun isPortraitMount(displayRotation: Int): Boolean {
        val normalized = ((displayRotation % 4) + 4) % 4
        return normalized == 0 || normalized == 2
    }

    /** Dimensões brutas do stream (buffer, antes de metadados de rotação do container). */
    fun rawVideoSize(videoSize: VideoSize): Pair<Int, Int> {
        val w = videoSize.width
        val h = videoSize.height
        return if (w > 0 && h > 0) w to h else 0 to 0
    }

    /** Dimensões visuais efectivas (considera rotação ainda não aplicada pelo decoder). */
    fun effectiveVideoSize(videoSize: VideoSize): Pair<Int, Int> {
        val (w, h) = rawVideoSize(videoSize)
        if (w <= 0 || h <= 0) return 0 to 0
        return when (videoSize.unappliedRotationDegrees) {
            90, 270 -> h to w
            else -> w to h
        }
    }

    fun readImageEffectiveSize(path: String): Pair<Int, Int> {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        var w = bounds.outWidth
        var h = bounds.outHeight
        if (w <= 0 || h <= 0) return 0 to 0
        if (readExifOrientationDegrees(path) in setOf(90, 270)) {
            w = bounds.outHeight
            h = bounds.outWidth
        }
        return w to h
    }

    fun correctionRotation(displayRotation: Int, mediaWidth: Int, mediaHeight: Int): Float {
        if (mediaWidth <= 0 || mediaHeight <= 0) return 0f
        val targetPortrait = isPortraitMount(displayRotation)
        val mediaPortrait = mediaHeight > mediaWidth
        if (targetPortrait == mediaPortrait) return 0f

        val normalized = ((displayRotation % 4) + 4) % 4
        return when (normalized) {
            0, 1 -> 90f
            else -> 270f
        }
    }

    fun rotateBitmap(source: Bitmap, degrees: Float): Bitmap {
        if (degrees == 0f) return source
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }

    fun applyToPlayerView(playerView: PlayerView, rotationDegrees: Float, videoWidth: Int, videoHeight: Int) {
        if (rotationDegrees == 0f) {
            resetPlayerView(playerView)
            return
        }
        runWhenSized(playerView) {
            val texture = playerView.videoSurfaceView as? TextureView
            if (texture == null) {
                applyViewRotation(playerView, rotationDegrees)
                return@runWhenSized
            }
            applyTextureTransform(texture, rotationDegrees, videoWidth, videoHeight)
            PlayerAdLogger.i(
                "DISPLAY",
                "TextureView transform ${rotationDegrees.toInt()}° vídeo ${videoWidth}x${videoHeight} view=${texture.width}x${texture.height}",
            )
        }
    }

    fun applyToImageView(imageView: View, rotationDegrees: Float) {
        if (rotationDegrees == 0f) {
            resetView(imageView)
            return
        }
        applyViewRotation(imageView, rotationDegrees)
    }

    fun resetPlayerView(playerView: PlayerView) {
        resetView(playerView)
        (playerView.videoSurfaceView as? TextureView)?.setTransform(Matrix())
    }

    fun resetView(view: View) {
        view.rotation = 0f
        view.translationX = 0f
        view.translationY = 0f
        view.scaleX = 1f
        view.scaleY = 1f
    }

    private fun applyViewRotation(view: View, rotationDegrees: Float) {
        runWhenSized(view) {
            val w = view.width.toFloat()
            val h = view.height.toFloat()
            view.pivotX = w / 2f
            view.pivotY = h / 2f
            view.rotation = rotationDegrees
            when ((rotationDegrees.toInt() % 360 + 360) % 360) {
                90, 270 -> {
                    view.translationX = (h - w) / 2f
                    view.translationY = (w - h) / 2f
                }
                else -> {
                    view.translationX = 0f
                    view.translationY = 0f
                }
            }
        }
    }

    private fun applyTextureTransform(
        textureView: TextureView,
        rotationDegrees: Float,
        videoWidth: Int,
        videoHeight: Int,
    ) {
        val viewW = textureView.width.toFloat()
        val viewH = textureView.height.toFloat()
        if (viewW <= 0f || viewH <= 0f || videoWidth <= 0 || videoHeight <= 0) return

        val matrix = Matrix()
        val viewRect = RectF(0f, 0f, viewW, viewH)
        val centerX = viewRect.centerX()
        val centerY = viewRect.centerY()
        val degrees = ((rotationDegrees.toInt() % 360) + 360) % 360

        val srcW: Float
        val srcH: Float
        when (degrees) {
            90, 270 -> {
                srcW = videoHeight.toFloat()
                srcH = videoWidth.toFloat()
            }
            else -> {
                srcW = videoWidth.toFloat()
                srcH = videoHeight.toFloat()
            }
        }

        val bufferRect = RectF(0f, 0f, srcW, srcH)
        bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
        matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
        matrix.postRotate(rotationDegrees, centerX, centerY)
        textureView.setTransform(matrix)
    }

    private fun runWhenSized(view: View, block: () -> Unit) {
        fun tryRun() {
            if (view.width > 0 && view.height > 0) {
                block()
            }
        }
        view.post {
            tryRun()
            if (view.width <= 0 || view.height <= 0) {
                val listener = object : View.OnLayoutChangeListener {
                    override fun onLayoutChange(
                        v: View,
                        left: Int,
                        top: Int,
                        right: Int,
                        bottom: Int,
                        oldLeft: Int,
                        oldTop: Int,
                        oldRight: Int,
                        oldBottom: Int,
                    ) {
                        if (v.width > 0 && v.height > 0) {
                            v.removeOnLayoutChangeListener(this)
                            block()
                        }
                    }
                }
                view.addOnLayoutChangeListener(listener)
            }
        }
    }

    private fun readExifOrientationDegrees(path: String): Int {
        return try {
            exifOrientationToDegrees(
                ExifInterface(path).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                ),
            )
        } catch (_: Exception) {
            0
        }
    }

    private fun exifOrientationToDegrees(orientation: Int): Int = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90,
        ExifInterface.ORIENTATION_TRANSPOSE -> 90
        ExifInterface.ORIENTATION_ROTATE_180 -> 180
        ExifInterface.ORIENTATION_ROTATE_270,
        ExifInterface.ORIENTATION_TRANSVERSE -> 270
        else -> 0
    }
}

package br.com.smartchannel.playerad.util

import android.content.Context
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
 * Alinha orientação da mídia ao **viewport / montagem do totem**.
 *
 * Bake v3+ (servidor): ficheiro neutro (EXIF/stream já aplicado, portrait ou landscape).
 * Cada totem aplica [displayRotation] e pode cachear o resultado.
 *
 * Bake ≤2 (legado): entrega 16:9 com `_delivery_rotation` de montagem — compensações legacy.
 */
object MediaViewportRotation {

    const val ENABLED = true

    /** Compensa faixas 16:9 legacy com `_delivery_rotation:0` (Allwinner). */
    const val LANDSCAPE_STRIP_FLIP_180 = true

    /** Bake neutro: UI portrait; player resolve montagem. */
    const val NEUTRAL_BAKE_VERSION = 3

    fun landscapeStripPlaybackRotation(deliveryRotation: Int?, videoSize: VideoSize): Float {
        if (!LANDSCAPE_STRIP_FLIP_180 || deliveryRotation != 0) return 0f
        val (w, h) = rawVideoSize(videoSize)
        if (w <= 0 || h <= 0 || w <= h) return 0f
        return 180f
    }

    fun needsLandscapeStripFlip(deliveryRotation: Int?, deliveryBakeVersion: Int? = null): Boolean {
        if (isNeutralBake(deliveryBakeVersion)) return false
        return LANDSCAPE_STRIP_FLIP_180 && deliveryRotation == 0
    }

    fun isNeutralBake(deliveryBakeVersion: Int?): Boolean {
        return (deliveryBakeVersion ?: 0) >= NEUTRAL_BAKE_VERSION
    }

    fun isPortraitMount(displayRotation: Int): Boolean {
        val normalized = ((displayRotation % 4) + 4) % 4
        return normalized == 0 || normalized == 2
    }

    fun isViewportPortrait(context: Context): Boolean {
        val dm = context.resources.displayMetrics
        return dm.heightPixels > dm.widthPixels
    }

    fun rawVideoSize(videoSize: VideoSize): Pair<Int, Int> {
        val w = videoSize.width
        val h = videoSize.height
        return if (w > 0 && h > 0) w to h else 0 to 0
    }

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

    /**
     * BitmapFactory **não** aplica EXIF. Rodar pixels para “em pé” antes da montagem do totem.
     * Evita imagem de lado + zoom errado em fotos de telemóvel.
     */
    fun applyExifToBitmap(bitmap: Bitmap, path: String?): Bitmap {
        if (path.isNullOrBlank()) return bitmap
        val degrees = readExifOrientationDegrees(path).toFloat()
        if (degrees == 0f) return bitmap
        return try {
            rotateBitmap(bitmap, degrees)
        } catch (_: Exception) {
            bitmap
        }
    }

    fun isTargetPortrait(context: Context, displayRotation: Int): Boolean {
        return isPortraitMount(displayRotation) || isViewportPortrait(context)
    }

    /**
     * Ângulo que este totem deve aplicar à mídia neutra (ou legado) para bater certo no ecrã.
     */
    fun mountCorrectionDegrees(
        displayRotation: Int,
        mediaWidth: Int,
        mediaHeight: Int,
    ): Float {
        if (mediaWidth <= 0 || mediaHeight <= 0) return 0f
        val mount = ((displayRotation % 4) + 4) % 4
        val portraitMedia = mediaHeight >= mediaWidth
        return when (mount) {
            // Retrato normal
            0 -> if (portraitMedia) 0f else 90f
            // Paisagem (HDMI 0°)
            1 -> if (portraitMedia) 270f else 0f
            // Retrato invertido
            2 -> if (portraitMedia) 180f else 270f
            // Paisagem invertida
            3 -> if (portraitMedia) 90f else 180f
            else -> 0f
        }
    }

    fun playbackCorrectionDegrees(
        context: Context,
        displayRotation: Int,
        mediaWidth: Int,
        mediaHeight: Int,
        deliveryRotation: Int? = null,
        deliveryBakeVersion: Int? = null,
        isVideo: Boolean = false,
    ): Float {
        if (!ENABLED) return 0f

        // Bake v3+: ficheiro neutro — cada totem resolve a montagem
        if (isNeutralBake(deliveryBakeVersion)) {
            return mountCorrectionDegrees(displayRotation, mediaWidth, mediaHeight)
        }

        val mount = ((displayRotation % 4) + 4) % 4
        if (deliveryRotation != null) {
            // Legado bake ≤2: ficheiro preparado para montagem 0
            var deg = when (mount) {
                2, 3 -> 180f
                else -> 0f
            }
            if (
                LANDSCAPE_STRIP_FLIP_180 &&
                deliveryRotation == 0 &&
                mediaWidth > mediaHeight
            ) {
                deg = (deg + 180f) % 360f
            }
            if (isVideo && needsV1VideoStreamParityFix(deliveryRotation, deliveryBakeVersion)) {
                deg = (deg + 90f) % 360f
            }
            return deg
        }
        return correctionRotation(context, displayRotation, mediaWidth, mediaHeight)
    }

    fun needsV1VideoStreamParityFix(deliveryRotation: Int?, deliveryBakeVersion: Int?): Boolean {
        if (isNeutralBake(deliveryBakeVersion)) return false
        if (deliveryRotation != 180) return false
        val ver = deliveryBakeVersion ?: 1
        return ver < 2
    }

    fun correctionRotation(
        context: Context,
        displayRotation: Int,
        mediaWidth: Int,
        mediaHeight: Int,
    ): Float {
        if (mediaWidth <= 0 || mediaHeight <= 0) return 0f
        // Preferir modelo por montagem (funciona para portrait e landscape media)
        return mountCorrectionDegrees(displayRotation, mediaWidth, mediaHeight)
    }

    fun correctionRotationForVideo(
        context: Context,
        displayRotation: Int,
        videoSize: VideoSize,
        deliveryRotation: Int? = null,
        deliveryBakeVersion: Int? = null,
    ): Float {
        // Dimensões “em pé” (após metadado rotate do telemóvel) para decidir portrait vs landscape
        val (ew, eh) = effectiveVideoSize(videoSize)
        if (deliveryRotation != null || isNeutralBake(deliveryBakeVersion)) {
            return playbackCorrectionDegrees(
                context,
                displayRotation,
                ew,
                eh,
                deliveryRotation,
                deliveryBakeVersion,
                isVideo = true,
            )
        }
        val metaRot = normalizeRotationDegrees(videoSize.unappliedRotationDegrees)
        if (metaRot != 0 && !isNeutralBake(deliveryBakeVersion)) {
            // Legado: ExoPlayer ainda tem rotate; combinar com montagem se necessário
            val mount = mountCorrectionDegrees(displayRotation, ew, eh)
            return ((metaRot + mount) % 360f + 360f) % 360f
        }
        return correctionRotation(context, displayRotation, ew, eh)
    }

    private fun normalizeRotationDegrees(degrees: Int): Int {
        val n = ((degrees / 90) * 90 % 360 + 360) % 360
        return if (n in setOf(90, 180, 270)) n else 0
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
        try {
            (playerView.videoSurfaceView as? TextureView)?.setTransform(Matrix())
        } catch (_: Exception) {
            // TextureView pode ainda não ter surface (Allwinner) — ignorar.
        }
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

        val scale = maxOf(viewW / srcW, viewH / srcH)
        matrix.setScale(scale, scale, centerX, centerY)
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

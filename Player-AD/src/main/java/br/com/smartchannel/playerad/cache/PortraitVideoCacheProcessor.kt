package br.com.smartchannel.playerad.cache

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import br.com.smartchannel.playerad.util.MediaViewportRotation
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.SystemDisplayRotation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Cache local já adequado ao [displayRotation] do totem (bake v3 neutro no servidor).
 */
@UnstableApi
object PortraitVideoCacheProcessor {

    private val mainHandler = Handler(Looper.getMainLooper())

    data class Result(
        val file: File,
        val sizeBytes: Long,
        val rotated: Boolean,
        val orientationReady: Boolean,
    )

    suspend fun normalizeIfNeeded(
        context: Context,
        file: File,
        displayRotation: Int,
        mediaType: String?,
        url: String,
    ): Result {
        if (!isVideoFile(mediaType, url)) {
            return withContext(Dispatchers.IO) {
                Result(file, file.length(), rotated = false, orientationReady = true)
            }
        }

        val (width, height) = withContext(Dispatchers.IO) {
            probeVideoSize(file)
        }
        if (width <= 0 || height <= 0) {
            PlayerAdLogger.w("CACHE", "Não foi possível ler dimensões de ${file.name}")
            return Result(file, file.length(), rotated = false, orientationReady = false)
        }

        // ViewDisplayRotation / systemMount tratam a montagem em runtime.
        // Assar no ficheiro com fallback visual activo = dupla rotação (TV_BOX_3).
        if (!SystemDisplayRotation.isViewportMatchingMount(context, displayRotation)) {
            PlayerAdLogger.i(
                "CACHE",
                "Skip normalização cache ${file.name}: visualFallback activo " +
                    "mount=$displayRotation ${width}x${height}",
            )
            return Result(file, file.length(), rotated = false, orientationReady = true)
        }

        val degrees = MediaViewportRotation.mountCorrectionDegrees(displayRotation, width, height)
        if (degrees == 0f) {
            PlayerAdLogger.i(
                "CACHE",
                "Cache OK sem rotação ${file.name} ${width}x${height} mount=$displayRotation",
            )
            return Result(file, file.length(), rotated = false, orientationReady = true)
        }

        PlayerAdLogger.i(
            "CACHE",
            "A normalizar cache ${file.name} ${width}x${height} → ${degrees.toInt()}° mount=$displayRotation",
        )

        val tempOut = File(file.parent, "${file.nameWithoutExtension}_norm.mp4")
        return try {
            withContext(Dispatchers.IO) {
                if (tempOut.exists()) tempOut.delete()
            }
            transcodeRotated(context, file, tempOut, degrees)
            withContext(Dispatchers.IO) {
                if (!file.delete()) {
                    PlayerAdLogger.w("CACHE", "Falha ao remover original ${file.name} após normalização")
                }
                val finalFile = File(file.parent, file.name)
                if (!tempOut.renameTo(finalFile)) {
                    tempOut.copyTo(finalFile, overwrite = true)
                    tempOut.delete()
                }
                PlayerAdLogger.i(
                    "CACHE",
                    "Cache normalizado ${finalFile.name} (${finalFile.length()} bytes)",
                )
                Result(finalFile, finalFile.length(), rotated = true, orientationReady = true)
            }
        } catch (e: Exception) {
            withContext(Dispatchers.IO) {
                tempOut.delete()
            }
            PlayerAdLogger.e("CACHE", "Falha ao normalizar cache ${file.name}; mantém original", e)
            Result(file, file.length(), rotated = false, orientationReady = true)
        }
    }

    fun isVideoFile(mediaType: String?, url: String): Boolean {
        val mt = mediaType?.lowercase().orEmpty()
        if (mt.startsWith("video") || mt == "mp4" || mt == "webm") return true
        val path = url.substringBefore('?').lowercase()
        return path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".mkv")
    }

    fun needsPortraitCacheRotation(displayRotation: Int, width: Int, height: Int): Boolean {
        return MediaViewportRotation.mountCorrectionDegrees(displayRotation, width, height) != 0f
    }

    fun probeVideoSize(file: File): Pair<Int, Int> {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            var w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: 0
            var h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: 0
            when (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull()) {
                90, 270 -> {
                    val t = w
                    w = h
                    h = t
                }
            }
            w to h
        } catch (_: Exception) {
            0 to 0
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    private suspend fun transcodeRotated(
        context: Context,
        input: File,
        output: File,
        degrees: Float,
    ) = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { cont ->
            val rotateEffect = ScaleAndRotateTransformation.Builder()
                .setRotationDegrees(degrees)
                .build()
            val editedMediaItem = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(input)))
                .setEffects(Effects(emptyList(), listOf(rotateEffect)))
                .build()

            val transformer = Transformer.Builder(context.applicationContext)
                .addListener(
                    object : Transformer.Listener {
                        override fun onCompleted(
                            composition: androidx.media3.transformer.Composition,
                            exportResult: ExportResult,
                        ) {
                            if (cont.isActive) cont.resume(Unit)
                        }

                        override fun onError(
                            composition: androidx.media3.transformer.Composition,
                            exportResult: ExportResult,
                            exportException: ExportException,
                        ) {
                            if (cont.isActive) cont.resumeWithException(exportException)
                        }
                    },
                )
                .build()

            cont.invokeOnCancellation {
                mainHandler.post {
                    try {
                        transformer.cancel()
                    } catch (_: Exception) {
                    }
                }
            }
            transformer.start(editedMediaItem, output.absolutePath)
        }
    }
}

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
import br.com.smartchannel.playerad.util.PlayerAdLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Normaliza vídeos **landscape** (16:9) uma única vez ao gravar no cache, em totem portrait.
 * Vídeos 9:16 do servidor não são alterados.
 *
 * Playback = ficheiro já correto, sem matriz/rotação em runtime.
 */
@UnstableApi
object PortraitVideoCacheProcessor {

    private const val ROTATION_DEGREES = 90f
    private val mainHandler = Handler(Looper.getMainLooper())

    data class Result(
        val file: File,
        val sizeBytes: Long,
        /** true se correu transformação (rotação). */
        val rotated: Boolean,
        /** true se avaliado (com ou sem rotação) — não repetir. */
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

        if (!needsPortraitCacheRotation(displayRotation, width, height)) {
            PlayerAdLogger.i(
                "CACHE",
                "Cache OK sem rotação ${file.name} ${width}x${height} (landscape/deitado)",
            )
            return Result(file, file.length(), rotated = false, orientationReady = true)
        }

        PlayerAdLogger.i(
            "CACHE",
            "A normalizar portrait ${file.name} ${width}x${height} → rotação ${ROTATION_DEGREES.toInt()}° (uma vez)",
        )

        val tempOut = File(file.parent, "${file.nameWithoutExtension}_norm.mp4")
        return try {
            withContext(Dispatchers.IO) {
                if (tempOut.exists()) tempOut.delete()
            }
            transcodeRotated(context, file, tempOut, ROTATION_DEGREES)
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
                    "Portrait normalizado ${finalFile.name} (${finalFile.length()} bytes)",
                )
                Result(finalFile, finalFile.length(), rotated = true, orientationReady = true)
            }
        } catch (e: Exception) {
            withContext(Dispatchers.IO) {
                tempOut.delete()
            }
            PlayerAdLogger.e("CACHE", "Falha ao normalizar portrait ${file.name}; mantém original", e)
            Result(file, file.length(), rotated = false, orientationReady = true)
        }
    }

    fun isVideoFile(mediaType: String?, url: String): Boolean {
        val mt = mediaType?.lowercase().orEmpty()
        if (mt.startsWith("video") || mt == "mp4" || mt == "webm") return true
        val path = url.substringBefore('?').lowercase()
        return path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".mkv")
    }

    /**
     * Rotação no cache desactivada: a mídia correcta vem do servidor (transform 9:16).
     * Reativar só se o dispatch entregar landscape bruto sem normalização.
     */
    fun needsPortraitCacheRotation(displayRotation: Int, width: Int, height: Int): Boolean = false

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

    /** Media3 Transformer exige create/start/cancel na main thread. */
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

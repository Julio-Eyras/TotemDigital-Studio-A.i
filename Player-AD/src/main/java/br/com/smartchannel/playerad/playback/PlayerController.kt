package br.com.smartchannel.playerad.playback

import android.content.Context
import android.net.Uri
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.api.PlayerEventsClient
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.util.AppDirs
import br.com.smartchannel.playerad.util.PlayerAdLogger
import android.widget.ImageView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

/**
 * PlayerController – orquestra Dispatcher, cache e ExoPlayer.
 *
 * Responsabilidades:
 * - Converter JSON do DispatchPlan em lista de itens tipados
 * - Garantir download assíncrono das mídias para a pasta `propagandas`
 * - Tocar mídias usando ExoPlayer, preferindo cache local
 */
class PlayerController(
    private val context: Context,
    private val apiClient: DispatcherApiClient,
    private val cacheManager: MediaCacheManager,
    private val exoPlayer: ExoPlayer,
    private val imageView: ImageView
) {
    private val DEFAULT_IMAGE_DURATION_SECONDS = 20L

    data class DispatchMediaItem(
        val mediaId: Long,
        val url: String,
        val duration: Long?, // em segundos
        val mediaType: String?
    )

    data class DispatchPlan(
        val playlistId: Long,
        val playlistName: String,
        val mediaItems: List<DispatchMediaItem>,
        val campaignId: Long?
    )

    private val propagandasDir: File by lazy { AppDirs.propagandas(context) }

    private val vinhetasDir: File by lazy { AppDirs.vinhetas(context) }

    private lateinit var eventsClient: PlayerEventsClient

    /**
     * Obtém token, faz dispatch e começa o loop de playback.
     */
    suspend fun start() {
        val token = try {
            val t = apiClient.heartbeat()
            PlayerAdLogger.i("HEARTBEAT", "OK — sessão/token renovados")
            t
        } catch (e: Exception) {
            PlayerAdLogger.e("HEARTBEAT", "Falha no heartbeat inicial", e)
            throw e
        }
        val dispatchJson = try {
            apiClient.getDispatchPlan(token)
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha ao obter DispatchPlan", e)
            throw e
        }
        val plan = parseDispatchPlan(dispatchJson)
        PlayerAdLogger.logDispatchPlanReceived(
            plan.playlistId,
            plan.playlistName,
            plan.mediaItems.size,
            plan.campaignId
        )
        eventsClient = PlayerEventsClient(
            baseUrl = apiClient.baseUrl.trimEnd('/'),
            uin = apiClient.uin,
            deviceId = apiClient.deviceId
        )
        preloadPlan(plan)
        playLoop(plan, token)
    }

    private fun parseDispatchPlan(json: JSONObject): DispatchPlan {
        val planObj = json.optJSONObject("plan") ?: JSONObject()
        val playlistId = planObj.optLong("playlistId", 0L)
        val playlistName = planObj.optString("playlistName", "DispatchPlan")
        val campaignId = planObj.optLong("campaignId", 0L).takeIf { it > 0L }
        val itemsArray = planObj.optJSONArray("mediaItems") ?: JSONArray()

        val items = mutableListOf<DispatchMediaItem>()
        for (i in 0 until itemsArray.length()) {
            val obj = itemsArray.optJSONObject(i) ?: continue
            val mediaId = obj.optLong("mediaId", -1L)
            if (mediaId <= 0L) continue
            val url = obj.optString("url", "")
            if (url.isBlank()) continue
            val duration = obj.optLong("duration", 0L).takeIf { it > 0L }
            val mediaType = obj.optString("mediaType", "").takeIf { it.isNotBlank() }
            items += DispatchMediaItem(mediaId, apiClient.resolveUrl(url), duration, mediaType)
        }

        return DispatchPlan(playlistId, playlistName, items, campaignId)
    }

    /**
     * Pré-carrega o plano:
     * - executa limpeza LRU se necessário
     * - agenda downloads para mídias que ainda não estão em cache
     */
    private suspend fun preloadPlan(plan: DispatchPlan) = withContext(Dispatchers.IO) {
        cacheManager.cleanupIfNeeded()

        for (item in plan.mediaItems) {
            val meta = cacheManager.getMetadata(item.mediaId)
            val file = meta?.fileName?.let { File(propagandasDir, it) }
            val hasValidCache =
                meta?.valid == true &&
                file != null && file.exists()

            if (!hasValidCache) {
                downloadToCache(item)
            }
        }
    }

    /**
     * Baixa uma mídia e registra no MediaCacheManager.
     */
    private suspend fun downloadToCache(item: DispatchMediaItem) = withContext(Dispatchers.IO) {
        try {
            val url = java.net.URL(item.url)
            val conn = url.openConnection()
            val ext = guessExtension(item.mediaType, item.url)
            val fileName = "${item.mediaId}.$ext"
            val outFile = File(propagandasDir, fileName)

            conn.getInputStream().use { input ->
                FileOutputStream(outFile).use { out ->
                    input.copyTo(out)
                }
            }

            val size = outFile.length()
            // Para o primeiro esqueleto, não calculamos checksum aqui.
            cacheManager.onDownloadCompleted(
                mediaId = item.mediaId,
                fileName = fileName,
                sizeBytes = size,
                checksum = null,
                mimeType = item.mediaType
            )
        } catch (e: Exception) {
            PlayerAdLogger.logDownloadFailed(item.mediaId, item.url, e)
        }
    }

    /**
     * Loop simples: toca todos os itens em ordem, repetindo em ciclo.
     * Preferindo cache local, caindo para streaming via URL.
     */
    private suspend fun playLoop(plan: DispatchPlan, token: String) = withContext(Dispatchers.Main) {
        var currentPlan = plan
        var index = 0
        while (true) {
            if (currentPlan.mediaItems.isEmpty()) {
                // Plano vazio: tentar usar fallback sintético (propagandas + vinhetas locais)
                val fallback = buildFallbackPlan()
                if (fallback == null || fallback.mediaItems.isEmpty()) {
                    PlayerAdLogger.e(
                        "PLAYBACK",
                        "Loop terminado: DispatchPlan sem itens e fallback local indisponível",
                        null
                    )
                    break
                } else {
                    PlayerAdLogger.logFallbackActivated(
                        "plano remoto vazio — ${fallback.mediaItems.size} itens locais (propagandas/vinhetas)"
                    )
                    currentPlan = fallback
                    index = 0
                }
            }
            val item = currentPlan.mediaItems[index]
            playItem(plan, item, token)

            index = (index + 1) % currentPlan.mediaItems.size
        }
    }

    private suspend fun playItem(plan: DispatchPlan, item: DispatchMediaItem, token: String) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        // Fallback local (file://) não usa cache/metadata
        val isFileUrl = item.url.startsWith("file://")
        val mediaTypeLower = item.mediaType?.lowercase() ?: "video"
        val isVideo = mediaTypeLower == "video"

        val meta = if (!isFileUrl) cacheManager.getMetadata(item.mediaId) else null
        val file = meta?.fileName?.let { File(propagandasDir, it) }
        val hasValidCache =
            !isFileUrl &&
                meta?.valid == true &&
                file != null &&
                file.exists()

        // Para imagens, não usamos ExoPlayer: mostramos em ImageView.
        if (!isVideo) {
            imageView.visibility = android.view.View.VISIBLE
            exoPlayer.stop()
            val durationSeconds = item.duration ?: DEFAULT_IMAGE_DURATION_SECONDS
            val durationMs = durationSeconds * 1000L

            PlayerAdLogger.logPlaybackStart(
                "imagem",
                item.mediaId,
                plan.playlistName,
                plan.playlistId
            )

            // Atualiza eventos para imagem (equivalente ao player-web)
            try {
                eventsClient.sendEvent(
                    token = token,
                    eventType = "image_display",
                    mediaId = item.mediaId,
                    playlistId = plan.playlistId,
                    campaignId = plan.campaignId,
                    durationSeconds = null,
                    completed = null,
                    metadata = emptyMap()
                )
            } catch (_: Exception) { }

            // Tentar obter bitmap de cache local ou do arquivo fallback local
            val imageUri = when {
                isFileUrl -> Uri.parse(item.url)
                hasValidCache -> {
                    cacheManager.onPlayFromCache(item.mediaId, today)
                    Uri.fromFile(file)
                }
                else -> Uri.parse(item.url)
            }

            val bitmap = withContext(Dispatchers.IO) {
                try {
                    if (imageUri.scheme == "file") {
                        android.graphics.BitmapFactory.decodeFile(imageUri.path)
                    } else {
                        // Fallback: tenta decodificar via HTTP (pode ser lento mas evita tela vazia)
                        val conn = java.net.URL(imageUri.toString()).openConnection()
                        conn.getInputStream().use { input ->
                            android.graphics.BitmapFactory.decodeStream(input)
                        }
                    }
                } catch (_: Exception) {
                    null
                }
            }

            if (bitmap != null) {
                imageView.setImageBitmap(bitmap)
            } else {
                imageView.setImageDrawable(null)
            }

            kotlinx.coroutines.delay(durationMs)
            imageView.visibility = android.view.View.GONE
            PlayerAdLogger.logPlaybackEnd("imagem", item.mediaId, durationSeconds)
            return
        }

        // Vídeos: garantir que ImageView está escondido e usar ExoPlayer com duração natural.
        imageView.visibility = android.view.View.GONE

        PlayerAdLogger.logPlaybackStart(
            "vídeo",
            item.mediaId,
            plan.playlistName,
            plan.playlistId
        )

        val mediaItem: MediaItem = when {
            isFileUrl -> MediaItem.fromUri(Uri.parse(item.url))
            hasValidCache -> {
                cacheManager.onPlayFromCache(item.mediaId, today)
                MediaItem.fromUri(Uri.fromFile(file))
            }
            else -> MediaItem.fromUri(Uri.parse(item.url))
        }

        // Evento de início de reprodução
        try {
            eventsClient.sendEvent(
                token = token,
                eventType = "video_playback_start",
                mediaId = item.mediaId,
                playlistId = plan.playlistId,
                campaignId = plan.campaignId,
                durationSeconds = null,
                completed = null,
                metadata = emptyMap()
            )
        } catch (_: Exception) { }

        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()

        val playedMs = waitForPlaybackEnd()
        PlayerAdLogger.logPlaybackEnd(
            "vídeo",
            item.mediaId,
            (playedMs / 1000L).coerceAtLeast(0L)
        )

        // Evento de fim de reprodução
        try {
            eventsClient.sendEvent(
                token = token,
                eventType = "video_playback_end",
                mediaId = item.mediaId,
                playlistId = plan.playlistId,
                campaignId = plan.campaignId,
                durationSeconds = (playedMs / 1000L).coerceAtLeast(0L),
                completed = true,
                metadata = emptyMap()
            )
        } catch (_: Exception) { }
    }

    /**
     * Constrói um DispatchPlan sintético de fallback usando arquivos locais:
     * - Usa arquivos em propagandas/ e vinhetas/
     * - Intercala: 3 propagandas, 1 vinheta
     * - duration dos vídeos fica a cargo do player (duration=null),
     *   mantendo o "padrão da mídia" (duração real do arquivo).
     */
    private fun buildFallbackPlan(): DispatchPlan? {
        val propagandas = listFallbackFiles(propagandasDir)
        val vinhetas = listFallbackFiles(vinhetasDir)

        // Para o cenário pedido: um vídeo em propagandas e um em vinhetas,
        // a regra do fallback deve gerar sempre 3 propagandas + 1 vinheta (total 4 itens),
        // repetindo o único arquivo quando necessário.
        if (propagandas.isEmpty() || vinhetas.isEmpty()) return null

        val items = mutableListOf<DispatchMediaItem>()

        // 3 propagandas
        for (k in 0 until 3) {
            val file = propagandas[k % propagandas.size]
            val mediaType = guessFallbackMediaType(file.name)
            val durationSeconds = if (mediaType == "image") DEFAULT_IMAGE_DURATION_SECONDS else null
            items += DispatchMediaItem(
                mediaId = 0L,
                url = file.toURI().toString(),
                duration = durationSeconds,
                mediaType = mediaType
            )
        }

        // 1 vinheta
        run {
            val file = vinhetas[0 % vinhetas.size]
            val mediaType = guessFallbackMediaType(file.name)
            val durationSeconds = if (mediaType == "image") DEFAULT_IMAGE_DURATION_SECONDS else null
            items += DispatchMediaItem(
                mediaId = 0L,
                url = file.toURI().toString(),
                duration = durationSeconds,
                mediaType = mediaType
            )
        }

        return DispatchPlan(
            playlistId = 0L,
            playlistName = "Fallback (Propagandas padrão)",
            mediaItems = items,
            campaignId = null
        )
    }

    private fun listFallbackFiles(dir: File): List<File> {
        if (!dir.exists() || !dir.isDirectory) return emptyList()
        return dir.listFiles { f ->
            f.isFile && (f.name.endsWith(".mp4", true) ||
                f.name.endsWith(".webm", true) ||
                f.name.endsWith(".mov", true) ||
                f.name.endsWith(".jpg", true) ||
                f.name.endsWith(".jpeg", true) ||
                f.name.endsWith(".png", true))
        }?.sortedBy { it.name.lowercase() } ?: emptyList()
    }

    private fun guessFallbackMediaType(fileName: String): String {
        val lower = fileName.lowercase()
        return when {
            lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") -> "video"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") -> "image"
            else -> "video"
        }
    }

    private fun guessExtension(mediaType: String?, url: String): String {
        mediaType?.let {
            if (it.startsWith("video/")) return "mp4"
            if (it.startsWith("image/")) return "jpg"
        }
        return when {
            url.contains(".mp4", ignoreCase = true) -> "mp4"
            url.contains(".webm", ignoreCase = true) -> "webm"
            url.contains(".jpg", ignoreCase = true) || url.contains(".jpeg", ignoreCase = true) -> "jpg"
            url.contains(".png", ignoreCase = true) -> "png"
            else -> "bin"
        }
    }

    /**
     * Suspende até o ExoPlayer sinalizar fim ou erro, retornando a posição tocada em ms.
     */
    private suspend fun waitForPlaybackEnd(): Long = suspendCancellableCoroutine { cont ->
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    exoPlayer.removeListener(this)
                    cont.resume(exoPlayer.currentPosition)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                exoPlayer.removeListener(this)
                cont.resume(exoPlayer.currentPosition)
            }
        }
        exoPlayer.addListener(listener)

        cont.invokeOnCancellation {
            exoPlayer.removeListener(listener)
        }
    }
}


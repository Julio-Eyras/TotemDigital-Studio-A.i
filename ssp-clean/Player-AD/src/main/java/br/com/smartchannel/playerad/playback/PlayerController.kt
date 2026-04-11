package br.com.smartchannel.playerad.playback

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
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
    private val imageView: ImageView,
    private val acceptImagesInPlaylist: Boolean = true,
    private val fallbackPropagandasPerVinheta: Int = 3
) {
    private enum class PlanSource { ONLINE, PERSISTED, FALLBACK_LOCAL }

    private val DEFAULT_IMAGE_DURATION_SECONDS = 20L
    private val persistedDispatchFile: File
        get() = File(AppDirs.root(context), "last-dispatch-plan.json")
    private val currentPlanSourceFile: File
        get() = File(AppDirs.root(context), "current-plan-source.txt")

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

    private val propagandasDir: File
        get() = AppDirs.propagandas(context)

    private val vinhetasDir: File
        get() = AppDirs.vinhetas(context)

    private lateinit var eventsClient: PlayerEventsClient

    /**
     * Obtém token, faz dispatch e começa o loop de playback.
     */
    suspend fun start() {
        eventsClient = PlayerEventsClient(
            baseUrl = apiClient.baseUrl.trimEnd('/'),
            uin = apiClient.uin,
            deviceId = apiClient.deviceId,
            dispatcher = apiClient
        )

        PlayerAdLogger.i("LIFECYCLE", "(1) Heartbeat inicial — token/sessão (GET /token se necessário + POST /heartbeat)")
        var sessionToken = apiClient.cachedToken() ?: ""
        val initialPlanWithSource = try {
            val token = apiClient.heartbeat()
            PlayerAdLogger.i("HEARTBEAT", "OK — sessão/token renovados")
            PlayerAdLogger.i("LIFECYCLE", "(2) DispatchPlan + pré-cache (GET /api/player/dispatch)")
            val dispatchJson = apiClient.getDispatchPlan(token)
            saveDispatchPlanToDisk(dispatchJson)
            sessionToken = apiClient.cachedToken() ?: token
            val plan = parseDispatchPlan(dispatchJson)
            PlayerAdLogger.logDispatchPlanReceived(
                plan.playlistId,
                plan.playlistName,
                plan.mediaItems.size,
                plan.campaignId
            )
            preloadPlan(plan)
            plan to PlanSource.ONLINE
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha no arranque online (heartbeat/dispatch); tentando fallback local", e)
            val persistedPlan = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
            if (persistedPlan != null && persistedPlan.mediaItems.isNotEmpty()) {
                PlayerAdLogger.logFallbackActivated(
                    "arranque offline — usando ultimo DispatchPlan persistido (${persistedPlan.mediaItems.size} itens)"
                )
                persistedPlan to PlanSource.PERSISTED
            } else {
            val fallback = buildFallbackPlan()
            if (fallback == null || fallback.mediaItems.isEmpty()) {
                PlayerAdLogger.e("PLAYBACK", "Sem rede, sem DispatchPlan persistido util e sem fallback local", e)
                throw e
            }
            PlayerAdLogger.logFallbackActivated(
                "arranque offline — ${fallback.mediaItems.size} itens locais (propagandas/vinhetas), proporcao=${fallbackPropagandasPerVinheta}:1"
            )
            fallback to PlanSource.FALLBACK_LOCAL
            }
        }
        val (initialPlan, initialSource) = initialPlanWithSource
        updatePlanSource(initialSource, "Fonte inicial do plano")
        PlayerAdLogger.i("LIFECYCLE", "(3) Loop de playback; após cada ciclo: heartbeat + novo dispatch; eventos com token atualizado")
        playLoop(initialPlan, sessionToken, initialSource)
    }

    private fun parseDispatchPlan(json: JSONObject): DispatchPlan {
        if (!json.optBoolean("success", true)) {
            val err = json.optString("error", "").ifBlank { "(sem mensagem)" }
            PlayerAdLogger.e("DISPATCH", "Resposta com success=false: $err", null)
        }
        val planObj = extractPlanObject(json)
        val playlistId = planObj.optLong("playlistId", planObj.optLong("playlist_id", 0L))
        val playlistName = planObj.optString("playlistName", planObj.optString("playlist_name", "DispatchPlan"))
        val campaignId = planObj.optLong("campaignId", planObj.optLong("campaign_id", 0L)).takeIf { it > 0L }
        val itemsArray = planObj.optJSONArray("mediaItems")
            ?: planObj.optJSONArray("media_items")
            ?: JSONArray()

        val items = mutableListOf<DispatchMediaItem>()
        for (i in 0 until itemsArray.length()) {
            val obj = itemsArray.optJSONObject(i) ?: continue
            val mediaId = parsePositiveLong(obj, "mediaId", "media_id")
            if (mediaId <= 0L) continue
            val url = firstNonBlankString(obj, "url", "file_path", "filePath", "src")
            if (url.isBlank()) continue
            val duration = parsePositiveLong(obj, "duration", "display_seconds", "displaySeconds")
                .takeIf { it > 0L }
            val mediaType = firstNonBlankString(obj, "mediaType", "media_type", "mimeType", "mime_type")
                .takeIf { it.isNotBlank() }
            items += DispatchMediaItem(mediaId, apiClient.resolveUrl(url), duration, mediaType)
        }

        val rawCount = itemsArray.length()
        if (rawCount > 0 && items.isEmpty()) {
            val sample = itemsArray.optJSONObject(0)
            val keys = sample?.let { o ->
                buildList {
                    val it = o.keys()
                    while (it.hasNext()) add(it.next())
                }.joinToString(",")
            } ?: "(sem amostra)"
            PlayerAdLogger.w(
                "DISPATCH",
                "JSON tem $rawCount mediaItems mas 0 itens reproduzíveis após parse (mediaId>0 e url não vazios) — chaves do 1º item: $keys"
            )
        }

        return DispatchPlan(playlistId, playlistName, items, campaignId)
    }

    /** Suporta `plan` na raiz ou dentro de `data` (proxies / versões antigas). */
    private fun extractPlanObject(json: JSONObject): JSONObject {
        json.optJSONObject("plan")?.let { return it }
        json.optJSONObject("data")?.optJSONObject("plan")?.let { return it }
        return JSONObject()
    }

    /** Primeiro campo presente com texto não vazio. */
    private fun firstNonBlankString(obj: JSONObject, vararg keys: String): String {
        for (key in keys) {
            val v = obj.optString(key, "").trim()
            if (v.isNotBlank()) return v
        }
        return ""
    }

    /** Primeiro identificador numérico > 0 entre as chaves listadas. */
    private fun parsePositiveLong(obj: JSONObject, vararg keys: String): Long {
        for (key in keys) {
            if (!obj.has(key)) continue
            val parsed = try {
                when (val v = obj.get(key)) {
                    is Number -> v.toLong()
                    is String -> v.trim().toLongOrNull()
                    else -> null
                }
            } catch (_: Exception) {
                obj.optString(key, "").trim().toLongOrNull()
            }
            if (parsed != null && parsed > 0L) return parsed
        }
        return -1L
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
    private suspend fun playLoop(
        plan: DispatchPlan,
        token: String,
        initialSource: PlanSource
    ) = withContext(Dispatchers.Main) {
        var currentPlan = plan
        var currentToken = token
        var currentPlanSource = initialSource
        var index = 0
        var completedFullCycle = false
        while (true) {
            if (currentPlan.mediaItems.isEmpty()) {
                val persistedPlan = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
                if (persistedPlan != null && persistedPlan.mediaItems.isNotEmpty()) {
                    PlayerAdLogger.logFallbackActivated(
                        "plano remoto vazio — usando ultimo DispatchPlan persistido (${persistedPlan.mediaItems.size} itens)"
                    )
                    currentPlan = persistedPlan
                    currentPlanSource = PlanSource.PERSISTED
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    index = 0
                    completedFullCycle = false
                    continue
                }
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
                    currentPlanSource = PlanSource.FALLBACK_LOCAL
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    index = 0
                    completedFullCycle = false
                }
            }

            if (currentPlan.mediaItems.isNotEmpty() && index == 0 && completedFullCycle) {
                try {
                    currentToken = withContext(Dispatchers.IO) { apiClient.heartbeat() }
                    val dispatchJson = withContext(Dispatchers.IO) {
                        apiClient.getDispatchPlan(currentToken)
                    }
                    withContext(Dispatchers.IO) { saveDispatchPlanToDisk(dispatchJson) }
                    apiClient.cachedToken()?.let { currentToken = it }
                    val newPlan = parseDispatchPlan(dispatchJson)
                    PlayerAdLogger.i(
                        "DISPATCH",
                        "Plano atualizado após ciclo — playlist=${newPlan.playlistName} (${newPlan.mediaItems.size} itens)"
                    )
                    PlayerAdLogger.logDispatchPlanReceived(
                        newPlan.playlistId,
                        newPlan.playlistName,
                        newPlan.mediaItems.size,
                        newPlan.campaignId
                    )
                    currentPlan = newPlan
                    currentPlanSource = PlanSource.ONLINE
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    withContext(Dispatchers.IO) { preloadPlan(currentPlan) }
                } catch (e: Exception) {
                    PlayerAdLogger.e(
                        "DISPATCH",
                        "Falha ao atualizar plano após ciclo; mantém plano atual ($currentPlanSource)",
                        e
                    )
                }
            }

            val item = currentPlan.mediaItems[index]
            currentToken = playItem(currentPlan, item, currentToken)

            index = (index + 1) % currentPlan.mediaItems.size
            if (index == 0) completedFullCycle = true
        }
    }

    /** @return token a usar no próximo item (pode ter sido renovado ao enviar eventos). */
    private suspend fun playItem(plan: DispatchPlan, item: DispatchMediaItem, token: String): String {
        var t = token
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
            if (!acceptImagesInPlaylist) {
                imageView.visibility = android.view.View.GONE
                imageView.setImageDrawable(null)
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Imagem ignorada (aceitar imagens na playlist desligado) — mediaId=${item.mediaId}"
                )
                delay(1L)
                return t
            }
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
                t = eventsClient.sendEvent(
                    token = t,
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

            val maxSide = targetMaxBitmapSidePx()
            val bitmap = withContext(Dispatchers.IO) {
                try {
                    when (imageUri.scheme) {
                        "file" -> {
                            val path = imageUri.path ?: return@withContext null
                            decodeScaledBitmapFromFile(path, maxSide)
                        }
                        else -> decodeScaledBitmapFromHttp(imageUri.toString(), maxSide)
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

            delay(durationMs)
            imageView.visibility = android.view.View.GONE
            PlayerAdLogger.logPlaybackEnd("imagem", item.mediaId, durationSeconds)
            return t
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
            t = eventsClient.sendEvent(
                token = t,
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
            t = eventsClient.sendEvent(
                token = t,
                eventType = "video_playback_end",
                mediaId = item.mediaId,
                playlistId = plan.playlistId,
                campaignId = plan.campaignId,
                durationSeconds = (playedMs / 1000L).coerceAtLeast(0L),
                completed = true,
                metadata = emptyMap()
            )
        } catch (_: Exception) { }
        return t
    }

    /**
     * Constrói um DispatchPlan sintético de fallback usando arquivos locais:
     * - Usa arquivos em propagandas/ e vinhetas/
     * - Intercala: N propagandas, 1 vinheta (N vindo de config)
     * - duration dos vídeos fica a cargo do player (duration=null),
     *   mantendo o "padrão da mídia" (duração real do arquivo).
     */
    private fun buildFallbackPlan(): DispatchPlan? {
        val propagandas = listFallbackFiles(propagandasDir)
        val vinhetas = listFallbackFiles(vinhetasDir)

        // Regra configurável: N propagandas + 1 vinheta, repetindo arquivos se necessário.
        if (propagandas.isEmpty() || vinhetas.isEmpty()) return null

        val items = mutableListOf<DispatchMediaItem>()
        val propagandasPerVinheta = fallbackPropagandasPerVinheta.coerceAtLeast(1)

        // N propagandas
        for (k in 0 until propagandasPerVinheta) {
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
            playlistName = "Fallback (Propagandas padrão ${propagandasPerVinheta}:1)",
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

    private suspend fun saveDispatchPlanToDisk(json: JSONObject) = withContext(Dispatchers.IO) {
        try {
            val parent = persistedDispatchFile.parentFile
            if (parent != null && !parent.exists()) parent.mkdirs()
            persistedDispatchFile.writeText(json.toString(), Charsets.UTF_8)
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha ao persistir ultimo DispatchPlan em disco", e)
        }
    }

    private suspend fun loadDispatchPlanFromDisk(): JSONObject? = withContext(Dispatchers.IO) {
        try {
            if (!persistedDispatchFile.exists()) return@withContext null
            val raw = persistedDispatchFile.readText(Charsets.UTF_8)
            if (raw.isBlank()) return@withContext null
            JSONObject(raw)
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha ao ler DispatchPlan persistido", e)
            null
        }
    }

    private suspend fun persistCurrentPlanSource(source: PlanSource) = withContext(Dispatchers.IO) {
        try {
            val parent = currentPlanSourceFile.parentFile
            if (parent != null && !parent.exists()) parent.mkdirs()
            currentPlanSourceFile.writeText(source.name, Charsets.UTF_8)
        } catch (e: Exception) {
            PlayerAdLogger.e("PLAYBACK", "Falha ao persistir fonte atual do plano", e)
        }
    }

    private suspend fun updatePlanSource(source: PlanSource, logPrefix: String) {
        PlayerAdLogger.i("PLAYBACK", "$logPrefix: $source")
        persistCurrentPlanSource(source)
    }

    /**
     * Suspende até o ExoPlayer sinalizar fim ou erro, retornando a posição tocada em ms.
     */
    /**
     * Limite do maior lado do bitmap em px (ligado ao ecrã, com teto para 4K).
     */
    private fun targetMaxBitmapSidePx(): Int {
        val dm = context.resources.displayMetrics
        val longest = maxOf(dm.widthPixels, dm.heightPixels)
        return longest.coerceIn(720, 3840)
    }

    private fun calculateInSampleSizeForMaxSide(bounds: BitmapFactory.Options, maxSide: Int): Int {
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return 1
        var w = bounds.outWidth
        var h = bounds.outHeight
        var sample = 1
        while (w > maxSide || h > maxSide) {
            sample *= 2
            w = (w + 1) / 2
            h = (h + 1) / 2
        }
        return sample.coerceAtLeast(1)
    }

    private fun decodeScaledBitmapFromFile(path: String, maxSide: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val opts = BitmapFactory.Options().apply {
            inSampleSize = calculateInSampleSizeForMaxSide(bounds, maxSide)
            inJustDecodeBounds = false
        }
        return BitmapFactory.decodeFile(path, opts)
    }

    private fun openImageHttpConnection(imageUrl: String): HttpURLConnection {
        val conn = URL(imageUrl).openConnection() as HttpURLConnection
        conn.connectTimeout = 12_000
        conn.readTimeout = 30_000
        return conn
    }

    /** Duas leituras HTTP: bounds + decode com inSampleSize (evita OOM em imagens grandes). */
    private fun decodeScaledBitmapFromHttp(imageUrl: String, maxSide: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val connBounds = openImageHttpConnection(imageUrl)
        try {
            connBounds.inputStream.use { input ->
                BitmapFactory.decodeStream(input, null, bounds)
            }
        } finally {
            connBounds.disconnect()
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val opts = BitmapFactory.Options().apply {
            inSampleSize = calculateInSampleSizeForMaxSide(bounds, maxSide)
            inJustDecodeBounds = false
        }
        val connDecode = openImageHttpConnection(imageUrl)
        try {
            return connDecode.inputStream.use { input ->
                BitmapFactory.decodeStream(input, null, opts)
            }
        } finally {
            connDecode.disconnect()
        }
    }

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


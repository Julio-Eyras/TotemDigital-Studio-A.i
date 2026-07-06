package br.com.smartchannel.playerad.playback

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.ota.OtaUpdateCoordinator
import br.com.smartchannel.playerad.api.PlayerEventsClient
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.cache.PortraitVideoCacheProcessor
import br.com.smartchannel.playerad.util.AppDirs
import br.com.smartchannel.playerad.util.FullscreenViewport
import br.com.smartchannel.playerad.util.MediaViewportRotation
import br.com.smartchannel.playerad.util.PlayerAdLogger
import android.content.Intent
import android.view.View
import android.webkit.WebView
import android.widget.ImageView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.system.exitProcess
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
    private val playerView: PlayerView,
    private val imageView: ImageView,
    private val htmlWebView: WebView,
    private val acceptImagesInPlaylist: Boolean = true,
    /** Se false, [exoPlayer] permanece em volume 0 durante vídeo/áudio. */
    private val allowPlaybackAudio: Boolean = true,
    private val fallbackPropagandasPerVinheta: Int = 3,
    /** Intervalo do batimento cardiaco (segundos) — heartbeat sem dispatch. */
    private val batimentoCardiaco: Int = 120,
    /** Intervalo (segundos) para atualizar dispatch/plano — independente do ciclo de reprodução. */
    private val maxSecondsWithoutServerCheck: Int = 60,
    /** Montagem do painel (0=portrait … 3=landscape invertido) — alinha orientação da mídia. */
    private val displayRotation: Int = 0,
    private val otaUpdateCoordinator: OtaUpdateCoordinator? = null
) {
    private var restartRequested = false
    private var videoOrientationListener: Player.Listener? = null
    private var pendingVideoOrientationReveal = false

    private enum class PlanSource { ONLINE, PERSISTED, FALLBACK_LOCAL }

    private val DEFAULT_IMAGE_DURATION_SECONDS = 20L
    /** Cardápio HTML ao vivo: poll default 30s — exposição mínima 60s. */
    private val DEFAULT_HTML_DURATION_SECONDS = 60L
    private val MIN_HTML_DURATION_SECONDS = 30L
    private val persistedDispatchFile: File
        get() = File(AppDirs.root(context), "last-dispatch-plan.json")
    private val currentPlanSourceFile: File
        get() = File(AppDirs.root(context), "current-plan-source.txt")

    data class DispatchMediaItem(
        val mediaId: Long,
        val url: String,
        val duration: Long?, // em segundos
        val mediaType: String?,
        val order: Int = 0,
        val label: String? = null,
        /** true quando o item veio marcado como vinheta no dispatch (tag/cacheBucket/caminho). */
        val isVinheta: Boolean = false,
        /** Rotação pré-aplicada no servidor (_delivery_rotation:N). null = desconhecido. */
        val deliveryRotation: Int? = null,
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
        HtmlWebViewPlayback.configure(htmlWebView)
        eventsClient = PlayerEventsClient(
            baseUrl = apiClient.baseUrl.trimEnd('/'),
            uin = apiClient.uin,
            deviceId = apiClient.deviceId,
            dispatcher = apiClient
        )

        PlayerAdLogger.i("LIFECYCLE", "(1) Heartbeat inicial — token/sessão (GET /token se necessário + POST /heartbeat)")
        var sessionToken = apiClient.cachedToken() ?: ""
        val initialPlanWithSource = try {
            val online = fetchOnlinePlan(sessionToken, "arranque")
            sessionToken = online.token
            online.plan to PlanSource.ONLINE
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha no arranque online (heartbeat/dispatch); tentando fallback local", e)
            val persistedPlan = loadDispatchPlanFromDisk()?.let { applyVinhetaMixToDispatchPlan(parseDispatchPlan(it)) }
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
        PlayerAdLogger.i("LIFECYCLE", "(3) Loop de playback; batimento cardiaco=${batimentoCardiaco}s; dispatch a cada ${maxSecondsWithoutServerCheck}s")
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
            val order = parsePositiveLong(obj, "order").takeIf { it > 0L }?.toInt() ?: (i + 1)
            val label = firstNonBlankString(
                obj,
                "mediaName",
                "media_name",
                "title",
                "name",
                "fileName",
                "file_name",
            ).ifBlank {
                url.substringAfterLast('/').substringBefore('?').ifBlank { null }
            }
            val isVinheta = isVinhetaDispatchJson(obj, url)
            val deliveryRotation = parseDispatchDeliveryRotation(obj)
            items += DispatchMediaItem(
                mediaId = mediaId,
                url = apiClient.resolveUrl(url),
                duration = duration,
                mediaType = mediaType,
                order = order,
                label = label,
                isVinheta = isVinheta,
                deliveryRotation = deliveryRotation,
            )
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

    /** Alinhado ao backend (`cacheBucket`, tag `vinheta`, pasta `/vinhetas/`). */
    private fun parseDispatchDeliveryRotation(obj: JSONObject): Int? {
        val metadata = obj.optJSONObject("metadata")
        val fromMeta = metadata?.optInt("deliveryRotation", -1)
            ?.takeIf { it >= 0 }
            ?: metadata?.optInt("delivery_rotation", -1)?.takeIf { it >= 0 }
        if (fromMeta != null) return normalizeDispatchRotation(fromMeta)
        return parseDeliveryRotationFromDispatchTags(obj)
    }

    private fun parseDeliveryRotationFromDispatchTags(obj: JSONObject): Int? {
        val tagsArray = obj.optJSONArray("tags") ?: return null
        for (i in 0 until tagsArray.length()) {
            val tag = tagsArray.optString(i, "")
            if (!tag.startsWith("_delivery_rotation:")) continue
            val raw = tag.removePrefix("_delivery_rotation:").trim()
            val parsed = raw.toIntOrNull() ?: continue
            return normalizeDispatchRotation(parsed)
        }
        return null
    }

    private fun normalizeDispatchRotation(degrees: Int): Int {
        val normalized = ((degrees / 90) * 90 % 360 + 360) % 360
        return if (normalized in setOf(0, 90, 180, 270)) normalized else 0
    }

    private fun isVinhetaDispatchJson(obj: JSONObject, url: String): Boolean {
        val bucket = firstNonBlankString(obj, "cacheBucket", "cache_bucket").lowercase()
        if (bucket == "vinhetas") return true

        val tagsArray = obj.optJSONArray("tags")
        if (tagsArray != null) {
            for (i in 0 until tagsArray.length()) {
                if (tagsArray.optString(i, "").trim().equals("vinheta", ignoreCase = true)) return true
            }
        }
        val tagsRaw = obj.optString("tags", "").trim()
        if (tagsRaw.isNotBlank()) {
            if (tagsRaw.split(',').any { it.trim().equals("vinheta", ignoreCase = true) }) return true
        }

        val lower = url.lowercase()
        return lower.contains("/vinhetas/") || lower.contains("\\vinhetas\\")
    }

    /**
     * Intercala o plano do dispatcher (propagandas/campanha) com vinhetas do plano e/ou pasta local,
     * na proporção [fallbackPropagandasPerVinheta]:1 (ex.: 3 propagandas, 1 vinheta).
     */
    private fun applyVinhetaMixToDispatchPlan(plan: DispatchPlan): DispatchPlan {
        val propagandas = plan.mediaItems.filter { !it.isVinheta }
        val planVinhetas = plan.mediaItems.filter { it.isVinheta }
        val vinhetaPool = buildVinhetaPlaybackPool(planVinhetas, collectFallbackVinhetas())

        if (propagandas.isEmpty()) {
            if (vinhetaPool.isEmpty()) return plan
            return plan.copy(
                playlistName = "${plan.playlistName} (somente vinhetas)",
                mediaItems = vinhetaPool.mapIndexed { index, item -> item.copy(order = index + 1) },
            )
        }

        if (vinhetaPool.isEmpty()) {
            return plan.copy(mediaItems = propagandas.mapIndexed { index, item -> item.copy(order = index + 1) })
        }

        val ratio = fallbackPropagandasPerVinheta.coerceAtLeast(1)
        val mixed = mutableListOf<DispatchMediaItem>()
        var propsSinceVinheta = 0
        var vinIdx = 0
        for (prop in propagandas) {
            mixed += prop.copy(order = mixed.size + 1)
            propsSinceVinheta++
            if (propsSinceVinheta >= ratio) {
                val vin = vinhetaPool[vinIdx % vinhetaPool.size]
                mixed += vin.copy(order = mixed.size + 1)
                vinIdx++
                propsSinceVinheta = 0
            }
        }

        // Com poucas propagandas (< N), ainda inclui ao menos 1 vinheta no ciclo
        if (vinIdx == 0 && vinhetaPool.isNotEmpty() && propagandas.isNotEmpty()) {
            val vin = vinhetaPool[vinIdx % vinhetaPool.size]
            mixed += vin.copy(order = mixed.size + 1)
            vinIdx++
        }

        PlayerAdLogger.i(
            "DISPATCH",
            "Mix vinhetas ${ratio}:1 — campanha=${propagandas.size} vinhetas=${vinhetaPool.size} → reprodução=${mixed.size} itens"
        )
        return plan.copy(
            playlistName = "${plan.playlistName} (mix ${ratio}:1)",
            mediaItems = mixed,
        )
    }

    private fun buildVinhetaPlaybackPool(
        planVinhetas: List<DispatchMediaItem>,
        localVinhetas: List<FallbackMediaSource>,
    ): List<DispatchMediaItem> {
        val seen = mutableSetOf<String>()
        val out = mutableListOf<DispatchMediaItem>()
        fun add(item: DispatchMediaItem) {
            val key = item.url.ifBlank { "id:${item.mediaId}" }
            if (!seen.add(key)) return
            out += item
        }
        for (item in planVinhetas) add(item)
        for (src in localVinhetas) {
            add(
                fallbackItemFromSource(src, out.size + 1).copy(isVinheta = true)
            )
        }
        return out
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
        val currentIds = plan.mediaItems.map { it.mediaId }.toSet()
        val removed = cacheManager.removeValidEntriesNotIn(currentIds)
        if (removed > 0) {
            PlayerAdLogger.i(
                "CACHE",
                "Removidas $removed mídia(s) do cache local (fora da playlist id=${plan.playlistId})"
            )
        }

        cacheManager.cleanupIfNeeded()

        for (item in plan.mediaItems) {
            if (item.url.startsWith("file://") || item.mediaId <= 0L) continue
            val meta = cacheManager.getMetadata(item.mediaId)
            val file = meta?.fileName?.let { File(propagandasDir, it) }
            val hasValidCache =
                meta?.valid == true &&
                file != null && file.exists()

            if (!hasValidCache) {
                downloadToCache(item)
            } else if (
                PortraitVideoCacheProcessor.isVideoFile(item.mediaType, item.url) &&
                meta?.cacheOrientationReady != true &&
                file != null
            ) {
                normalizeCachedVideo(item, file)
            }
        }
    }

    private suspend fun normalizeCachedVideo(
        item: DispatchMediaItem,
        file: File,
    ) = withContext(Dispatchers.IO) {
        val result = PortraitVideoCacheProcessor.normalizeIfNeeded(
            context,
            file,
            displayRotation,
            item.mediaType,
            item.url,
        )
        if (result.orientationReady) {
            cacheManager.updateCacheOrientationState(
                mediaId = item.mediaId,
                fileName = result.file.name,
                sizeBytes = result.sizeBytes,
                cacheOrientationReady = true,
                cacheRotated = result.rotated,
            )
        }
    }

    /**
     * Baixa uma mídia e registra no MediaCacheManager.
     */
    private suspend fun downloadToCache(item: DispatchMediaItem) = withContext(Dispatchers.IO) {
        try {
            val url = java.net.URL(item.url)
            val conn = url.openConnection()
            val ext = if (PortraitVideoCacheProcessor.isVideoFile(item.mediaType, item.url)) {
                "mp4"
            } else {
                guessExtension(item.mediaType, item.url)
            }
            val fileName = "${item.mediaId}.$ext"
            val outFile = File(propagandasDir, fileName)

            conn.getInputStream().use { input ->
                FileOutputStream(outFile).use { out ->
                    input.copyTo(out)
                }
            }

            var finalFile = outFile
            var finalSize = outFile.length()
            var orientationReady = true
            var rotated = false
            if (PortraitVideoCacheProcessor.isVideoFile(item.mediaType, item.url)) {
                val result = PortraitVideoCacheProcessor.normalizeIfNeeded(
                    context,
                    outFile,
                    displayRotation,
                    item.mediaType,
                    item.url,
                )
                finalFile = result.file
                finalSize = result.sizeBytes
                orientationReady = result.orientationReady
                rotated = result.rotated
            }

            cacheManager.onDownloadCompleted(
                mediaId = item.mediaId,
                fileName = finalFile.name,
                sizeBytes = finalSize,
                checksum = null,
                mimeType = item.mediaType,
                cacheOrientationReady = orientationReady,
                cacheRotated = rotated,
            )
        } catch (e: Exception) {
            PlayerAdLogger.logDownloadFailed(item.mediaId, item.url, e)
        }
    }

    /** Volume do ExoPlayer: 0 se áudio desabilitado na config (totem sempre mudo para vídeo). */
    private fun applyPlaybackVolumePolicy() {
        exoPlayer.volume = if (allowPlaybackAudio) 1f else 0f
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
        val heartbeatGapMs = batimentoCardiaco.coerceAtLeast(10) * 1000L
        val dispatchGapMs = maxSecondsWithoutServerCheck.coerceAtLeast(10) * 1000L
        var lastHeartbeatAtMs = System.currentTimeMillis()
        var lastDispatchAtMs = System.currentTimeMillis()
        var index = 0
        applyPlaybackVolumePolicy()
        while (true) {
            val nowMs = System.currentTimeMillis()

            if (nowMs - lastHeartbeatAtMs >= heartbeatGapMs) {
                try {
                    val heartbeat = performHeartbeat(currentToken)
                    currentToken = heartbeat.token
                    if (heartbeat.refreshDispatch) {
                        val refreshed = refreshPlanAfterRemoteCommand(
                            currentToken,
                            index,
                            "heartbeat_media_refresh"
                        )
                        currentToken = refreshed.first
                        currentPlan = refreshed.second
                        index = refreshed.third
                        currentPlanSource = PlanSource.ONLINE
                        lastDispatchAtMs = System.currentTimeMillis()
                    }
                    PlayerAdLogger.i(
                        "HEARTBEAT",
                        "Batimento cardiaco (${batimentoCardiaco}s) — OK; comandos/servidor"
                    )
                } catch (e: Exception) {
                    PlayerAdLogger.e(
                        "HEARTBEAT",
                        "Batimento cardiaco (${batimentoCardiaco}s) falhou; mantém token/plano atuais",
                        e
                    )
                } finally {
                    lastHeartbeatAtMs = System.currentTimeMillis()
                }
            }

            if (nowMs - lastDispatchAtMs >= dispatchGapMs) {
                try {
                    val refreshed = fetchDispatchPlan(currentToken, "checagem_temporal")
                    currentToken = refreshed.token
                    currentPlan = refreshed.plan
                    currentPlanSource = PlanSource.ONLINE
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    if (index >= currentPlan.mediaItems.size) index = 0
                    PlayerAdLogger.i(
                        "DISPATCH",
                        "Atualização de plano (${maxSecondsWithoutServerCheck}s) — ${currentPlan.mediaItems.size} itens"
                    )
                } catch (e: Exception) {
                    PlayerAdLogger.e(
                        "DISPATCH",
                        "Atualização de plano (${maxSecondsWithoutServerCheck}s) falhou; mantém plano atual ($currentPlanSource)",
                        e
                    )
                } finally {
                    lastDispatchAtMs = System.currentTimeMillis()
                }
            }

            if (currentPlan.mediaItems.isEmpty()) {
                val persistedPlan = loadDispatchPlanFromDisk()?.let { applyVinhetaMixToDispatchPlan(parseDispatchPlan(it)) }
                if (persistedPlan != null && persistedPlan.mediaItems.isNotEmpty()) {
                    PlayerAdLogger.logFallbackActivated(
                        "plano remoto vazio — usando ultimo DispatchPlan persistido (${persistedPlan.mediaItems.size} itens)"
                    )
                    currentPlan = persistedPlan
                    currentPlanSource = PlanSource.PERSISTED
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    index = 0
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
                }
            }

            if (currentPlan.mediaItems.isEmpty()) {
                // Guarda final de segurança contra planos vazios em qualquer caminho de atualização.
                PlayerAdLogger.w(
                    "PLAYBACK",
                    "Proteção acionada: plano ainda vazio antes da indexação; novo ciclo para fallback/retry"
                )
                delay(250L)
                continue
            }

            val item = currentPlan.mediaItems[index]
            currentToken = playItem(currentPlan, item, currentToken)

            index = (index + 1) % currentPlan.mediaItems.size
            if (index == 0 && currentPlan.mediaItems.size > 1) {
                currentPlan = shufflePlanForNewCycle(currentPlan)
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Ciclo completo — fila embaralhada (${currentPlan.mediaItems.size} itens); vinhetas ${fallbackPropagandasPerVinheta}:1 reaplicadas"
                )
            }
        }
    }

    /** Embaralha propagandas ao fim do ciclo e reaplica mix de vinhetas (sem novo dispatch). */
    private fun shufflePlanForNewCycle(plan: DispatchPlan): DispatchPlan {
        val propagandas = plan.mediaItems.filter { !it.isVinheta }
        if (propagandas.size < 2) return plan
        val shuffled = propagandas.shuffled().mapIndexed { idx, item ->
            item.copy(order = idx + 1)
        }
        return applyVinhetaMixToDispatchPlan(plan.copy(mediaItems = shuffled))
    }

    private data class HeartbeatOutcome(
        val token: String,
        val refreshDispatch: Boolean
    )

    private data class RemoteCommandOutcome(
        val token: String,
        val refreshDispatch: Boolean
    )

    private data class OnlinePlanResult(
        val token: String,
        val plan: DispatchPlan
    )

    private suspend fun refreshPlanAfterRemoteCommand(
        currentToken: String,
        currentIndex: Int,
        logSource: String
    ): Triple<String, DispatchPlan, Int> {
        val refreshed = fetchDispatchPlan(currentToken, logSource)
        var index = currentIndex
        if (index >= refreshed.plan.mediaItems.size) index = 0
        updatePlanSource(PlanSource.ONLINE, "Fonte do plano alterada")
        PlayerAdLogger.i(
            "DISPATCH",
            "Plano atualizado após comando remoto ($logSource) — ${refreshed.plan.mediaItems.size} itens"
        )
        return Triple(refreshed.token, refreshed.plan, index)
    }

    private suspend fun fetchOnlinePlan(previousToken: String, logSource: String = "online"): OnlinePlanResult {
        val heartbeat = performHeartbeat(previousToken)
        return fetchDispatchPlan(heartbeat.token, logSource)
    }

    /** Heartbeat: comandos remotos, OTA, token e presença — sem GET dispatch. */
    private suspend fun performHeartbeat(previousToken: String): HeartbeatOutcome {
        PlayerAdLogger.i("LIFECYCLE", "Heartbeat — token/sessão/comandos (POST /api/player/heartbeat)")
        val hb = apiClient.heartbeatWithCommands(buildHealthMetrics())
        var token = hb.token
        PlayerAdLogger.i("HEARTBEAT", "OK — sessão/token renovados; comandos=${hb.pendingCommands.size}")
        otaUpdateCoordinator?.handleFromHeartbeat(hb.otaUpdate)
        var refreshDispatch = false
        if (hb.pendingCommands.isNotEmpty()) {
            val outcome = processPendingCommands(hb.pendingCommands, token)
            token = outcome.token
            refreshDispatch = outcome.refreshDispatch
        }
        val effectiveToken = apiClient.cachedToken() ?: token.ifBlank { previousToken }
        return HeartbeatOutcome(effectiveToken, refreshDispatch)
    }

    /** Atualiza plano de mídia (GET dispatch) sem novo heartbeat. */
    private suspend fun fetchDispatchPlan(previousToken: String, logSource: String = "dispatch"): OnlinePlanResult {
        PlayerAdLogger.i("LIFECYCLE", "DispatchPlan + pré-cache (GET /api/player/dispatch)")
        val token = apiClient.cachedToken()?.takeIf { it.isNotBlank() } ?: previousToken
        val dispatchJson = apiClient.getDispatchPlan(token)
        val savedJsonPath = saveDispatchPlanToDisk(dispatchJson)
        val effectiveToken = apiClient.cachedToken() ?: token.ifBlank { previousToken }
        val parsed = parseDispatchPlan(dispatchJson)
        preloadPlan(parsed)
        val plan = applyVinhetaMixToDispatchPlan(parsed)
        PlayerAdLogger.logDispatchPlanDetail(
            source = logSource,
            playlistId = plan.playlistId,
            playlistName = plan.playlistName,
            campaignId = plan.campaignId,
            sequenceEntries = formatDispatchSequence(plan.mediaItems),
            savedJsonPath = savedJsonPath
        )
        return OnlinePlanResult(
            token = effectiveToken,
            plan = plan
        )
    }

    private fun formatDispatchSequence(items: List<DispatchMediaItem>): List<String> =
        items.sortedBy { it.order }.map { item ->
            val kind = if (item.isVinheta) "vinheta" else (item.mediaType?.takeIf { it.isNotBlank() } ?: "-")
            val durLabel = item.duration?.let { "${it}s" } ?: "-"
            val label = item.label?.takeIf { it.isNotBlank() } ?: "-"
            "${item.order}:${item.mediaId},$kind,$durLabel,$label"
        }

    private fun buildHealthMetrics(): JSONObject {
        val root = AppDirs.root(context)
        val runtime = Runtime.getRuntime()
        return JSONObject().apply {
            put("player", "Player-AD")
            put("platform", "android")
            put("uin", apiClient.uin)
            put("deviceId", apiClient.deviceId)
            put("cacheRoot", root.absolutePath)
            put("propagandasCount", listFallbackFiles(propagandasDir).size)
            put("propagandasCacheValidCount", cacheManager.listValidCachedMediaFiles().size)
            put("fallbackPropagandasEligibleCount", collectFallbackPropagandas().size)
            put("vinhetasCount", listFallbackFiles(vinhetasDir).size)
            put("storageFreeBytes", root.freeSpace)
            put("storageTotalBytes", root.totalSpace)
            put("heapUsedBytes", runtime.totalMemory() - runtime.freeMemory())
            put("heapMaxBytes", runtime.maxMemory())
        }
    }

    private suspend fun processPendingCommands(
        commands: List<DispatcherApiClient.PendingCommand>,
        initialToken: String
    ): RemoteCommandOutcome {
        var token = initialToken
        var refreshDispatch = false
        for (cmd in commands) {
            val type = cmd.type.trim().lowercase(Locale.US)
            try {
                val result = executeRemoteCommand(type, cmd.data)
                token = apiClient.reportCommandResult(
                    token = token,
                    requestId = cmd.id,
                    status = "completed",
                    result = result
                )
                if (type == "invalidate_media" || type == "invalidate_playlist" || type == "invalidate_campaign") {
                    refreshDispatch = true
                }
                PlayerAdLogger.i("REMOTE_CMD", "Comando executado com sucesso: type=$type id=${cmd.id}")
            } catch (e: Exception) {
                token = apiClient.reportCommandResult(
                    token = token,
                    requestId = cmd.id,
                    status = "failed",
                    error = e.message ?: "Falha ao executar comando"
                )
                PlayerAdLogger.e("REMOTE_CMD", "Comando falhou: type=$type id=${cmd.id}", e)
            }
        }
        if (restartRequested) {
            PlayerAdLogger.w("REMOTE_CMD", "Restart de app solicitado por comando remoto")
            restartRequested = false
            scheduleAppRestart()
        }
        return RemoteCommandOutcome(
            token = apiClient.cachedToken() ?: token.ifBlank { initialToken },
            refreshDispatch = refreshDispatch
        )
    }

    private suspend fun executeRemoteCommand(type: String, data: JSONObject?): JSONObject {
        return when (type) {
            "invalidate_media" -> executeInvalidateMedia(data)
            "invalidate_playlist" -> executeInvalidatePlaylist(data)
            "invalidate_campaign" -> executeInvalidateCampaign(data)
            "purge_cache" -> executePurgeCache()
            "restart_app", "restart" -> executeRestartApp()
            "reset_board", "reboot" -> executeResetBoard()
            "capture_screen", "screenshot" -> executeCaptureScreen()
            else -> throw IllegalArgumentException("Comando não suportado no Player-AD: $type")
        }
    }

    private fun executeInvalidateMedia(data: JSONObject?): JSONObject {
        val ids = extractMediaIds(data)
        if (ids.isEmpty()) throw IllegalArgumentException("invalidate_media sem mediaId/mediaIds")
        ids.forEach { cacheManager.markAsRemoved(it) }
        return JSONObject().apply {
            put("removedMediaIds", JSONArray(ids))
            put("removedCount", ids.size)
        }
    }

    private suspend fun executeInvalidatePlaylist(data: JSONObject?): JSONObject {
        val explicitIds = extractMediaIds(data)
        val playlistId = data?.optLong("playlistId", 0L) ?: 0L
        val ids = if (explicitIds.isNotEmpty()) {
            explicitIds
        } else {
            val persisted = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
            if (persisted != null && playlistId > 0L && persisted.playlistId == playlistId) {
                persisted.mediaItems.map { it.mediaId }.filter { it > 0L }.distinct()
            } else emptyList()
        }
        if (ids.isEmpty()) throw IllegalArgumentException("invalidate_playlist sem mediaIds aplicáveis")
        ids.forEach { cacheManager.markAsRemoved(it) }
        return JSONObject().apply {
            put("playlistId", playlistId)
            put("removedMediaIds", JSONArray(ids))
            put("removedCount", ids.size)
        }
    }

    private suspend fun executeInvalidateCampaign(data: JSONObject?): JSONObject {
        val explicitIds = extractMediaIds(data)
        val campaignId = data?.optLong("campaignId", 0L) ?: 0L
        val ids = if (explicitIds.isNotEmpty()) {
            explicitIds
        } else {
            val persisted = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
            if (persisted != null && campaignId > 0L && persisted.campaignId == campaignId) {
                persisted.mediaItems.map { it.mediaId }.filter { it > 0L }.distinct()
            } else emptyList()
        }
        if (ids.isEmpty()) throw IllegalArgumentException("invalidate_campaign sem mediaIds aplicáveis")
        ids.forEach { cacheManager.markAsRemoved(it) }
        return JSONObject().apply {
            put("campaignId", campaignId)
            put("removedMediaIds", JSONArray(ids))
            put("removedCount", ids.size)
        }
    }

    private fun executePurgeCache(): JSONObject {
        val dir = propagandasDir
        var removed = 0
        if (dir.exists() && dir.isDirectory) {
            dir.listFiles()?.forEach { f ->
                if (f.isFile && !f.name.equals("metadata.json", ignoreCase = true)) {
                    if (f.delete()) removed++
                }
            }
        }
        // Reinicializa metadados para refletir estado atual do storage.
        cacheManager.init()
        return JSONObject().apply {
            put("removedFiles", removed)
            put("cachePath", dir.absolutePath)
        }
    }

    private fun executeRestartApp(): JSONObject {
        restartRequested = true
        return JSONObject().apply {
            put("scheduled", true)
            put("action", "restart_app")
        }
    }

    private fun executeResetBoard(): JSONObject {
        val commands = listOf("reboot", "svc power reboot", "setprop sys.powerctl reboot")
        val errors = mutableListOf<String>()
        for (cmd in commands) {
            try {
                val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", cmd))
                val code = process.waitFor()
                if (code == 0) {
                    return JSONObject().apply {
                        put("scheduled", true)
                        put("action", "reset_board")
                        put("command", cmd)
                    }
                }
                errors += "$cmd exit=$code"
            } catch (e: Exception) {
                errors += "$cmd error=${e.message}"
            }
        }
        throw IllegalStateException("Não foi possível reiniciar o sistema: ${errors.joinToString(" | ")}")
    }

    private fun executeCaptureScreen(): JSONObject {
        val screenshotsDir = File(AppDirs.root(context), "screenshots").apply { mkdirs() }
        val ts = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        val out = File(screenshotsDir, "screen-$ts.png")
        val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", "screencap -p \"${out.absolutePath}\""))
        val code = process.waitFor()
        if (code != 0 || !out.exists()) {
            throw IllegalStateException("Falha no screencap (exit=$code)")
        }
        return JSONObject().apply {
            put("filePath", out.absolutePath)
            put("fileSize", out.length())
            put("format", "png")
        }
    }

    private fun extractMediaIds(data: JSONObject?): List<Long> {
        if (data == null) return emptyList()
        val out = linkedSetOf<Long>()
        val single = data.optLong("mediaId", 0L)
        if (single > 0L) out += single
        val arr = data.optJSONArray("mediaIds") ?: data.optJSONArray("ids")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val v = arr.optLong(i, 0L)
                if (v > 0L) out += v
            }
        }
        return out.toList()
    }

    private fun scheduleAppRestart() {
        try {
            val intent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
            if (intent != null) {
                context.startActivity(intent)
            }
        } catch (_: Exception) {
            // ignora; ainda assim encerra para o watchdog/launcher recuperar o app
        }
        exoPlayer.stop()
        exitProcess(0)
    }

    /** @return token a usar no próximo item (pode ter sido renovado ao enviar eventos). */
    private suspend fun playItem(plan: DispatchPlan, item: DispatchMediaItem, token: String): String {
        var t = token
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        // Fallback local (file://) não usa cache/metadata
        val isFileUrl = item.url.startsWith("file://")
        val isVideo = isVideoOrAudioPlaybackType(item.mediaType, item.url)
        val isHtml = HtmlWebViewPlayback.isHtmlMediaType(item.mediaType, item.url)

        if (!isHtml) {
            hideHtmlLayer()
        }

        val meta = if (!isFileUrl) cacheManager.getMetadata(item.mediaId) else null
        val file = meta?.fileName?.let { File(propagandasDir, it) }
        val hasValidCache =
            !isFileUrl &&
                meta?.valid == true &&
                file != null &&
                file.exists()

        if (isHtml) {
            return playHtmlItem(plan, item, t, isFileUrl, hasValidCache, file, today)
        }

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
            hideHtmlLayer()
            resetMediaViewOrientation()
            imageView.visibility = View.VISIBLE
            playerView.visibility = View.GONE
            exoPlayer.stop()
            // Exposição só conta se > 0; vídeo não passa por este ramo (duração real no ExoPlayer).
            val exposureSec = item.duration?.takeIf { it > 0L }
            val durationSeconds = exposureSec ?: DEFAULT_IMAGE_DURATION_SECONDS
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
                val imagePath = if (imageUri.scheme == "file") imageUri.path else null
                applyImageOrientationCorrection(bitmap, imagePath)
            } else {
                imageView.setImageDrawable(null)
                resetMediaViewOrientation()
            }

            delay(durationMs)
            imageView.visibility = android.view.View.GONE
            PlayerAdLogger.logPlaybackEnd("imagem", item.mediaId, durationSeconds)
            return t
        }

        hideHtmlLayer()
        resetMediaViewOrientation()
        imageView.visibility = View.GONE
        imageView.setImageDrawable(null)
        playerView.visibility = View.VISIBLE
        playerView.alpha = 1f
        pendingVideoOrientationReveal = false
        playerView.post { FullscreenViewport.applyToPlayerView(playerView) }
        applyPlaybackVolumePolicy()

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

        exoPlayer.stop()
        exoPlayer.clearMediaItems()
        exoPlayer.setMediaItem(mediaItem)
        attachVideoOrientationListener(item.deliveryRotation)
        exoPlayer.prepare()
        exoPlayer.play()
        playerView.postDelayed({
            if (pendingVideoOrientationReveal) {
                PlayerAdLogger.w("DISPLAY", "Reveal vídeo sem onVideoSizeChanged (timeout)")
                revealVideoAfterOrientation()
            }
        }, 800L)

        val playbackTimeoutMs = videoWatchdogTimeoutMs(item)
        val playedMs = withTimeoutOrNull(playbackTimeoutMs) {
            waitForPlaybackEnd()
        } ?: run {
            val currentPosition = exoPlayer.currentPosition
            PlayerAdLogger.w(
                "WATCHDOG",
                "Timeout de reprodução mediaId=${item.mediaId}; avançando item após ${playbackTimeoutMs / 1000L}s"
            )
            exoPlayer.stop()
            currentPosition
        }
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

    private suspend fun playHtmlItem(
        plan: DispatchPlan,
        item: DispatchMediaItem,
        token: String,
        isFileUrl: Boolean,
        hasValidCache: Boolean,
        file: File?,
        today: String
    ): String {
        var t = token
        resetMediaViewOrientation()
        hideImageLayer()
        exoPlayer.stop()
        playerView.visibility = View.GONE

        val exposureSec = item.duration?.takeIf { it > 0L }
        val durationSeconds = when {
            exposureSec != null && exposureSec >= MIN_HTML_DURATION_SECONDS -> exposureSec
            exposureSec != null -> DEFAULT_HTML_DURATION_SECONDS
            else -> DEFAULT_HTML_DURATION_SECONDS
        }
        val durationMs = durationSeconds * 1000L

        PlayerAdLogger.logPlaybackStart(
            "html",
            item.mediaId,
            plan.playlistName,
            plan.playlistId
        )

        try {
            t = eventsClient.sendEvent(
                token = t,
                eventType = "html_display",
                mediaId = item.mediaId,
                playlistId = plan.playlistId,
                campaignId = plan.campaignId,
                durationSeconds = null,
                completed = null,
                metadata = emptyMap()
            )
        } catch (_: Exception) { }

        val resolvedHttpUrl = apiClient.resolveUrl(item.url)
        val cachedFile = when {
            isFileUrl -> {
                val path = Uri.parse(item.url).path
                if (path != null) File(path) else null
            }
            hasValidCache && file != null -> {
                cacheManager.onPlayFromCache(item.mediaId, today)
                file
            }
            else -> null
        }

        HtmlWebViewPlayback.load(
            webView = htmlWebView,
            serverBaseUrl = apiClient.baseUrl,
            httpUrl = resolvedHttpUrl,
            cachedHtmlFile = cachedFile
        )

        // Timer fora da Main: animações JS na WebView não devem atrasar o avanço da playlist.
        val watchdogMs = durationMs + HTML_PLAYBACK_GRACE_MS
        try {
            withTimeout(watchdogMs) {
                withContext(Dispatchers.Default) {
                    delay(durationMs)
                }
            }
        } catch (e: Exception) {
            PlayerAdLogger.w(
                "WATCHDOG",
                "HTML mediaId=${item.mediaId} watchdog ${watchdogMs / 1000L}s — forçando próximo item",
            )
        }
        HtmlWebViewPlayback.stop(htmlWebView)
        hideImageLayer()
        playerView.visibility = View.GONE
        PlayerAdLogger.logPlaybackEnd("html", item.mediaId, durationSeconds)
        PlayerAdLogger.i(
            "PLAYBACK",
            "HTML encerrado mediaId=${item.mediaId} — avançando playlist (${plan.mediaItems.size} itens no plano)"
        )
        return t
    }

    private fun hideHtmlLayer() {
        HtmlWebViewPlayback.stop(htmlWebView)
    }

    private fun hideImageLayer() {
        imageView.visibility = View.GONE
        imageView.setImageDrawable(null)
    }

    private fun resetMediaViewOrientation() {
        detachVideoOrientationListener()
        pendingVideoOrientationReveal = false
        playerView.alpha = 1f
        playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        exoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
        MediaViewportRotation.resetPlayerView(playerView)
        MediaViewportRotation.resetView(imageView)
    }

    private fun attachVideoOrientationListener(deliveryRotation: Int? = null) {
        if (!AUTO_MEDIA_ORIENTATION && !MediaViewportRotation.needsLandscapeStripFlip(deliveryRotation)) {
            return
        }
        detachVideoOrientationListener()
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(videoSize: VideoSize) {
                if (AUTO_MEDIA_ORIENTATION) {
                    applyVideoOrientationCorrection(videoSize)
                } else {
                    applyLandscapeStripFlipIfNeeded(videoSize, deliveryRotation)
                }
            }
        }
        videoOrientationListener = listener
        exoPlayer.addListener(listener)
    }

    private fun applyLandscapeStripFlipIfNeeded(videoSize: VideoSize, deliveryRotation: Int?) {
        if (!MediaViewportRotation.needsLandscapeStripFlip(deliveryRotation)) return
        try {
            val (rawW, rawH) = MediaViewportRotation.rawVideoSize(videoSize)
            val rot = MediaViewportRotation.landscapeStripPlaybackRotation(deliveryRotation, videoSize)
            if (rot == 0f) return
            playerView.post {
                try {
                    playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    exoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
                    PlayerAdLogger.i(
                        "DISPLAY",
                        "Flip faixa landscape ${rot.toInt()}° deliveryRotation=$deliveryRotation " +
                            "vídeo ${rawW}x${rawH} metaRot=${videoSize.unappliedRotationDegrees}",
                    )
                    MediaViewportRotation.applyToPlayerView(playerView, rot, rawW, rawH)
                } catch (e: Exception) {
                    PlayerAdLogger.e("DISPLAY", "Falha flip faixa landscape; mantém FIT", e)
                    MediaViewportRotation.resetPlayerView(playerView)
                    playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            }
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPLAY", "Falha ao agendar flip faixa landscape", e)
        }
    }

    private fun detachVideoOrientationListener() {
        videoOrientationListener?.let { exoPlayer.removeListener(it) }
        videoOrientationListener = null
    }

    private fun applyVideoOrientationCorrection(videoSize: VideoSize) {
        if (!AUTO_MEDIA_ORIENTATION) return
        try {
            val (rawW, rawH) = MediaViewportRotation.rawVideoSize(videoSize)
            val rot = MediaViewportRotation.correctionRotationForVideo(context, displayRotation, videoSize)
            playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            exoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
            if (rot != 0f) {
                PlayerAdLogger.i(
                    "DISPLAY",
                    "Correção orientação vídeo eff=${MediaViewportRotation.effectiveVideoSize(videoSize).let { "${it.first}x${it.second}" }} " +
                        "raw=${rawW}x${rawH} → ${rot.toInt()}° viewportPortrait=${MediaViewportRotation.isViewportPortrait(context)} " +
                        "mount=$displayRotation metaRot=${videoSize.unappliedRotationDegrees}",
                )
            }
            MediaViewportRotation.applyToPlayerView(playerView, rot, rawW, rawH)
            revealVideoAfterOrientation()
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPLAY", "Falha ao corrigir orientação do vídeo; mantém FIT", e)
            MediaViewportRotation.resetPlayerView(playerView)
            playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            revealVideoAfterOrientation()
        }
    }

    private fun revealVideoAfterOrientation() {
        if (!pendingVideoOrientationReveal) return
        pendingVideoOrientationReveal = false
        playerView.alpha = 1f
    }

    private fun applyImageOrientationCorrection(bitmap: Bitmap, filePath: String?) {
        if (!AUTO_MEDIA_ORIENTATION) {
            imageView.scaleType = ImageView.ScaleType.FIT_CENTER
            imageView.setImageBitmap(bitmap)
            return
        }
        val (w, h) = if (!filePath.isNullOrBlank()) {
            val fromExif = MediaViewportRotation.readImageEffectiveSize(filePath)
            if (fromExif.first > 0 && fromExif.second > 0) fromExif else bitmap.width to bitmap.height
        } else {
            bitmap.width to bitmap.height
        }
        val rot = MediaViewportRotation.correctionRotation(context, displayRotation, w, h)
        val displayBitmap = if (rot != 0f) {
            PlayerAdLogger.i(
                "DISPLAY",
                "Correção orientação imagem ${w}x${h} → ${rot.toInt()}° viewportPortrait=${MediaViewportRotation.isViewportPortrait(context)}",
            )
            try {
                MediaViewportRotation.rotateBitmap(bitmap, rot)
            } catch (e: Exception) {
                PlayerAdLogger.e("DISPLAY", "Falha ao rodar bitmap; mantém original", e)
                bitmap
            }
        } else {
            bitmap
        }
        imageView.scaleType = ImageView.ScaleType.CENTER_CROP
        imageView.setImageBitmap(displayBitmap)
        MediaViewportRotation.applyToImageView(imageView, 0f)
    }

    private fun fallbackDurationForMediaType(mediaType: String): Long? = when (mediaType) {
        "image" -> DEFAULT_IMAGE_DURATION_SECONDS
        "html" -> DEFAULT_HTML_DURATION_SECONDS
        else -> null
    }

    /**
     * Constrói um DispatchPlan sintético de fallback usando arquivos locais:
     * - Propagandas: pasta `propagandas/` + cache válido (`metadata.json`, valid=true)
     * - Vinhetas: pasta `vinhetas/`
     * - Com ambos: intercala N propagandas + 1 vinheta (N = fallbackPropagandasPerVinheta)
     * - Sem propagandas: só vinhetas (rotação)
     * - Sem vinhetas: só propagandas (rotação)
     */
    private fun buildFallbackPlan(): DispatchPlan? {
        val propagandas = collectFallbackPropagandas()
        val vinhetas = collectFallbackVinhetas()

        if (propagandas.isEmpty() && vinhetas.isEmpty()) return null

        val items = mutableListOf<DispatchMediaItem>()
        val propagandasPerVinheta = fallbackPropagandasPerVinheta.coerceAtLeast(1)

        val playlistName = when {
            propagandas.isEmpty() ->
                "Fallback (somente vinhetas, ${vinhetas.size})"
            vinhetas.isEmpty() ->
                "Fallback (somente propagandas, ${propagandas.size})"
            else ->
                "Fallback (mix ${propagandasPerVinheta}:1, prop=${propagandas.size}, vin=${vinhetas.size})"
        }

        when {
            propagandas.isEmpty() -> {
                for (src in vinhetas) {
                    items += fallbackItemFromSource(src, items.size + 1)
                }
            }
            vinhetas.isEmpty() -> {
                for (src in propagandas) {
                    items += fallbackItemFromSource(src, items.size + 1)
                }
            }
            else -> {
                for (k in 0 until propagandasPerVinheta) {
                    items += fallbackItemFromSource(propagandas[k % propagandas.size], items.size + 1)
                }
                items += fallbackItemFromSource(vinhetas[0], items.size + 1)
            }
        }

        return DispatchPlan(
            playlistId = 0L,
            playlistName = playlistName,
            mediaItems = items,
            campaignId = null
        )
    }

    private data class FallbackMediaSource(
        val file: File,
        val mediaId: Long,
        val mediaType: String,
        val label: String
    )

    /** Propagandas da pasta + cache válido (sem duplicar o mesmo arquivo). */
    private fun collectFallbackPropagandas(): List<FallbackMediaSource> {
        val seen = mutableSetOf<String>()
        val out = mutableListOf<FallbackMediaSource>()

        fun add(file: File, mediaId: Long, mimeType: String?) {
            if (!isSupportedFallbackMediaName(file.name)) return
            if (!file.isFile || file.length() <= 0L) return
            val path = canonicalPathSafe(file) ?: file.absolutePath
            if (!seen.add(path)) return
            out += FallbackMediaSource(
                file = file,
                mediaId = mediaId,
                mediaType = guessMediaTypeFromMime(mimeType, file.name),
                label = file.name
            )
        }

        for (f in listFallbackFiles(propagandasDir)) {
            add(f, 0L, null)
        }
        for (cached in cacheManager.listValidCachedMediaFiles()) {
            add(cached.file, cached.mediaId, cached.mimeType)
        }

        return out.sortedBy { it.label.lowercase() }
    }

    private fun collectFallbackVinhetas(): List<FallbackMediaSource> =
        listFallbackFiles(vinhetasDir).map { file ->
            FallbackMediaSource(
                file = file,
                mediaId = 0L,
                mediaType = guessFallbackMediaType(file.name),
                label = file.name
            )
        }

    private fun fallbackItemFromSource(src: FallbackMediaSource, order: Int): DispatchMediaItem {
        val durationSeconds = fallbackDurationForMediaType(src.mediaType)
        return DispatchMediaItem(
            mediaId = src.mediaId,
            url = src.file.toURI().toString(),
            duration = durationSeconds,
            mediaType = src.mediaType,
            order = order,
            label = src.label
        )
    }

    private fun canonicalPathSafe(file: File): String? =
        try {
            file.canonicalPath
        } catch (_: Exception) {
            file.absolutePath
        }

    private fun isSupportedFallbackMediaName(fileName: String): Boolean {
        val lower = fileName.lowercase()
        return lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png")
    }

    private fun guessMediaTypeFromMime(mimeType: String?, fileName: String): String {
        val m = mimeType?.lowercase()?.trim().orEmpty()
        return when {
            m.startsWith("video/") -> "video"
            m.startsWith("image/") -> "image"
            m.contains("html") -> "html"
            m.isNotEmpty() -> guessFallbackMediaType(fileName)
            else -> guessFallbackMediaType(fileName)
        }
    }

    private fun listFallbackFiles(dir: File): List<File> {
        if (!dir.exists() || !dir.isDirectory) return emptyList()
        return dir.listFiles { f -> f.isFile && isSupportedFallbackMediaName(f.name) }
            ?.sortedBy { it.name.lowercase() } ?: emptyList()
    }

    private fun guessFallbackMediaType(fileName: String): String {
        val lower = fileName.lowercase()
        return when {
            lower.endsWith(".html") || lower.endsWith(".htm") -> "html"
            lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") -> "video"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") -> "image"
            else -> "video"
        }
    }

    /** Vídeo/áudio por tipo lógico, MIME ou extensão na URL — alinhado ao dispatch do backend. */
    private fun isVideoOrAudioPlaybackType(mediaType: String?, url: String?): Boolean {
        val t = mediaType?.lowercase()?.trim().orEmpty()
        if (t == "video" || t == "audio") return true
        if (t.startsWith("video/") || t.startsWith("audio/")) return true
        val ref = (url ?: "").lowercase()
        if (Regex("\\.(mp4|webm|mov|mkv|m4v)(\\?|#|$)").containsMatchIn(ref)) return true
        if (Regex("\\.(mp3|aac|wav|ogg|m4a)(\\?|#|$)").containsMatchIn(ref)) return true
        return false
    }

    private fun guessExtension(mediaType: String?, url: String): String {
        if (HtmlWebViewPlayback.isHtmlMediaType(mediaType, url)) return "html"
        mediaType?.let {
            if (it.startsWith("video/")) return "mp4"
            if (it.startsWith("image/")) return "jpg"
        }
        return when {
            url.contains(".html", ignoreCase = true) -> "html"
            url.contains(".mp4", ignoreCase = true) -> "mp4"
            url.contains(".webm", ignoreCase = true) -> "webm"
            url.contains(".jpg", ignoreCase = true) || url.contains(".jpeg", ignoreCase = true) -> "jpg"
            url.contains(".png", ignoreCase = true) -> "png"
            else -> "bin"
        }
    }

    private fun videoWatchdogTimeoutMs(item: DispatchMediaItem): Long {
        val declaredMs = item.duration?.takeIf { it > 0L }?.times(1000L)
        val playerMs = exoPlayer.duration.takeIf { it > 0L }
        val baseMs = declaredMs ?: playerMs ?: VIDEO_WATCHDOG_FALLBACK_MS
        return (baseMs + VIDEO_WATCHDOG_GRACE_MS).coerceIn(VIDEO_WATCHDOG_MIN_MS, VIDEO_WATCHDOG_MAX_MS)
    }

    private fun playbackWatchdogTimeoutMs(item: DispatchMediaItem): Long {
        if (isVideoOrAudioPlaybackType(item.mediaType, item.url)) {
            return videoWatchdogTimeoutMs(item)
        }
        val declaredDurationMs = item.duration?.takeIf { it > 0L }?.times(1000L)
        return when {
            declaredDurationMs != null -> (declaredDurationMs + VIDEO_WATCHDOG_GRACE_MS)
                .coerceAtLeast(VIDEO_WATCHDOG_MIN_MS)
            else -> VIDEO_WATCHDOG_FALLBACK_MS
        }
    }

    private suspend fun saveDispatchPlanToDisk(json: JSONObject): String? = withContext(Dispatchers.IO) {
        try {
            val parent = persistedDispatchFile.parentFile
            if (parent != null && !parent.exists()) parent.mkdirs()
            persistedDispatchFile.writeText(json.toString(), Charsets.UTF_8)
            persistedDispatchFile.absolutePath
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha ao persistir ultimo DispatchPlan em disco", e)
            null
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
        val viewport = (context as? android.app.Activity)?.findViewById<View>(R.id.portraitViewport)
        if (viewport != null && viewport.width > 0 && viewport.height > 0) {
            return maxOf(viewport.width, viewport.height).coerceIn(720, 3840)
        }
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
        fun finish() {
            if (cont.isActive) {
                cont.resume(exoPlayer.currentPosition.coerceAtLeast(0L))
            }
        }

        if (exoPlayer.playbackState == Player.STATE_ENDED) {
            finish()
            return@suspendCancellableCoroutine
        }

        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    exoPlayer.removeListener(this)
                    finish()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                exoPlayer.removeListener(this)
                PlayerAdLogger.w("PLAYBACK", "Erro ExoPlayer: ${error.message}")
                finish()
            }
        }
        exoPlayer.addListener(listener)

        cont.invokeOnCancellation {
            exoPlayer.removeListener(listener)
        }
    }

    companion object {
        /** SUSPENSO v1.55 — orientação/resolução vêm do servidor. */
        private const val AUTO_MEDIA_ORIENTATION = MediaViewportRotation.ENABLED
        private const val VIDEO_WATCHDOG_MIN_MS = 30_000L
        private const val VIDEO_WATCHDOG_GRACE_MS = 15_000L
        /** Quando duração desconhecida — fallback curto (não 15 min). */
        private const val VIDEO_WATCHDOG_FALLBACK_MS = 5 * 60 * 1000L
        private const val VIDEO_WATCHDOG_MAX_MS = 15 * 60 * 1000L
        private const val HTML_PLAYBACK_GRACE_MS = 5_000L
    }
}


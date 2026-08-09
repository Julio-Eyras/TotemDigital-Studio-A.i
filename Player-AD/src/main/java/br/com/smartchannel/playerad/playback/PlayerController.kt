package br.com.smartchannel.playerad.playback

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.api.ApiHttpException
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.ota.OtaUpdateCoordinator
import br.com.smartchannel.playerad.ota.OtaApkBackupStore
import br.com.smartchannel.playerad.api.PlayerEventsClient
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.cache.PortraitVideoCacheProcessor
import br.com.smartchannel.playerad.util.AdaptivePollScheduler
import br.com.smartchannel.playerad.util.AppDirs
import br.com.smartchannel.playerad.util.FullscreenViewport
import br.com.smartchannel.playerad.util.MediaLayerTransition
import br.com.smartchannel.playerad.util.MediaViewportRotation
import br.com.smartchannel.playerad.util.PlayerAdLogger
import android.content.Intent
import br.com.smartchannel.playerad.config.DisplaySchedule
import br.com.smartchannel.playerad.config.DisplayScheduleStore
import br.com.smartchannel.playerad.config.PollAdaptiveConfig
import android.view.TextureView
import android.view.View
import android.graphics.Color
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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
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
import java.util.UUID
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
    initialAcceptImagesInPlaylist: Boolean = true,
    /** Se false, [exoPlayer] permanece em volume 0 durante vídeo/áudio. */
    initialAllowPlaybackAudio: Boolean = false,
    /**
     * Véu preto na troca de mídia: 0 = desligado, ≠0 = ligado.
     * Ver [br.com.smartchannel.playerad.config.PlayerConfig.mediaTransitionEnabled].
     */
    initialMediaTransitionEnabled: Int = 1,
    private val fallbackPropagandasPerVinheta: Int = 3,
    /** Intervalo do batimento cardiaco (segundos) — heartbeat sem dispatch. */
    initialBatimentoCardiaco: Int = 30,
    /** Intervalo (segundos) para atualizar dispatch/plano — independente do ciclo de reprodução. */
    initialMaxSecondsWithoutServerCheck: Int = 180,
    /** Sonolência / backoff parametrizável. */
    private val pollAdaptive: PollAdaptiveConfig = PollAdaptiveConfig.DEFAULT,
    /** Montagem do painel (0=portrait … 3=landscape invertido) — alinha orientação da mídia. */
    private val displayRotation: Int = 0,
    private val otaUpdateCoordinator: OtaUpdateCoordinator? = null,
    /** Overlay preto full-screen (fora do horário de tela). */
    private val displayIdleOverlay: View? = null,
    /** Véu de transição entre mídias (cobre frame residual). */
    private val mediaTransitionOverlay: View? = null,
) {
    @Volatile
    private var acceptImagesInPlaylist: Boolean = initialAcceptImagesInPlaylist
    @Volatile
    private var allowPlaybackAudio: Boolean = initialAllowPlaybackAudio
    @Volatile
    private var mediaTransitionEnabledRuntime: Int = initialMediaTransitionEnabled
    @Volatile
    private var batimentoCardiacoRuntime: Int = initialBatimentoCardiaco
    @Volatile
    private var maxSecondsWithoutServerCheckRuntime: Int = initialMaxSecondsWithoutServerCheck

    private fun mediaTransitionOn(): Boolean =
        br.com.smartchannel.playerad.config.PlayerConfigLoader.isMediaTransitionEnabled(
            mediaTransitionEnabledRuntime,
        )

    @Volatile
    private var released = false

    /**
     * Liberta listeners do ExoPlayer partilhado. Obrigatório antes de criar outro
     * [PlayerController] — senão matrices de mounts antigos continuam a aplicar-se.
     */
    fun release() {
        if (released) return
        released = true
        restartRequested = false
        try {
            detachVideoOrientationListener()
        } catch (_: Exception) { }
        videoOrientationReady?.cancel()
        videoOrientationReady = null
        activeVideoMediaId = -1L
        activeVideoContentVersion = null
        activeImageMediaId = -1L
        heartbeatPollRef = null
        dispatchPollRef = null
        backgroundScope.cancel()
        if (::eventsClient.isInitialized) eventsClient.close()
        try {
            MediaViewportRotation.resetPlayerView(playerView)
            MediaViewportRotation.resetView(imageView)
        } catch (_: Exception) { }
        PlayerAdLogger.i("LIFECYCLE", "PlayerController liberado (mount=$displayRotation)")
    }

    private suspend fun mediaTransitionCover() {
        if (released) return
        MediaLayerTransition.cover(mediaTransitionOverlay, enabled = mediaTransitionOn())
    }

    private suspend fun mediaTransitionReveal() {
        MediaLayerTransition.reveal(mediaTransitionOverlay, enabled = mediaTransitionOn())
    }

    private suspend fun mediaTransitionAwaitFrames(count: Int) {
        if (!mediaTransitionOn()) return
        MediaLayerTransition.awaitFrames(mediaTransitionOverlay, count)
    }

    private var restartRequested = false
    /** true = exitProcess; false = sair do playLoop para o watchdog criar novo controller. */
    private var forceProcessKillOnRestart = false
    @Volatile
    private var remountLoopRequested = false
    private var videoOrientationListener: Player.Listener? = null
    /** Completa quando a matrix FIT do TextureView foi aplicada (antes do reveal). */
    private var videoOrientationReady: CompletableDeferred<Unit>? = null
    /** Última mídia de vídeo realmente carregada no ExoPlayer (para replay contínuo). */
    private var activeVideoMediaId: Long = -1L
    private var activeVideoContentVersion: String? = null
    /** Última imagem visível no ImageView (evita véu ao repetir o mesmo item). */
    private var activeImageMediaId: Long = -1L
    @Volatile
    private var nowPlayingSnapshot: JSONObject? = null
    @Volatile
    private var displaySchedule: DisplaySchedule = DisplaySchedule()
    @Volatile
    private var pollAdaptiveRuntime: PollAdaptiveConfig = pollAdaptive
    @Volatile
    private var displayIdle: Boolean = false
    private var lastKeepAliveAtMs: Long = 0L
    /** Versão do plano conhecida (ecoada no heartbeat como knownPlanVersion). */
    @Volatile
    private var knownPlanVersion: String? = null
    private var lastDispatchFetchAtMs: Long = 0L
    /** Pollers do loop actual — para soft-apply de intervalos sem restart. */
    @Volatile
    private var heartbeatPollRef: AdaptivePollScheduler? = null
    @Volatile
    private var dispatchPollRef: AdaptivePollScheduler? = null
    /** Backoff de download por mediaId (ms epoch até quando não re-tentar). */
    private val downloadFailUntilMs = mutableMapOf<Long, Long>()

    private enum class PlanSource { ONLINE, PERSISTED, FALLBACK_LOCAL, EMPTY_PLAN }

    private val DEFAULT_IMAGE_DURATION_SECONDS = 10L
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
        /** Versão do bake de entrega (_delivery_bake:N). <2 = vídeo v1 sem stream EXIF. */
        val deliveryBakeVersion: Int? = null,
        /** Versão de conteúdo do servidor (updatedAt|size|path|crc). */
        val contentVersion: String? = null,
    )

    data class DispatchPlan(
        val playlistId: Long,
        val playlistName: String,
        val mediaItems: List<DispatchMediaItem>,
        val campaignId: Long?
    )

    private val propagandasDir: File
        get() = AppDirs.propagandas(context)

    private lateinit var eventsClient: PlayerEventsClient
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private data class TelemetrySession(
        val id: String,
        val startedAt: String,
        val startedAtMs: Long,
        val expectedEndAt: String?,
        val durationMs: Long?,
        val source: String,
    )

    private fun beginTelemetry(
        plan: DispatchPlan,
        item: DispatchMediaItem,
        type: String,
        durationMs: Long?,
        source: String,
    ): TelemetrySession {
        val startedMs = System.currentTimeMillis()
        val session = TelemetrySession(
            id = UUID.randomUUID().toString(),
            startedAt = PlayerEventsClient.isoNow(startedMs),
            startedAtMs = startedMs,
            expectedEndAt = durationMs?.let { PlayerEventsClient.isoNow(startedMs + it) },
            durationMs = durationMs,
            source = source,
        )
        eventsClient.enqueue(
            telemetryEvent("media.play.started", plan, item, type, session),
        )
        return session
    }

    private fun finishTelemetry(
        plan: DispatchPlan,
        item: DispatchMediaItem,
        type: String,
        session: TelemetrySession,
        playedMs: Long,
        completed: Boolean,
        reason: String,
        positionMs: Long = playedMs,
    ) {
        eventsClient.enqueue(
            telemetryEvent(
                "media.play.ended", plan, item, type, session,
                playedMs = playedMs, completed = completed, reason = reason, positionMs = positionMs,
            ),
        )
    }

    private fun errorTelemetry(
        plan: DispatchPlan,
        item: DispatchMediaItem,
        type: String,
        session: TelemetrySession,
        reason: String,
        positionMs: Long = 0L,
    ) {
        eventsClient.enqueue(
            telemetryEvent(
                "media.play.error", plan, item, type, session,
                playedMs = (System.currentTimeMillis() - session.startedAtMs).coerceAtLeast(0L),
                completed = false, reason = reason, positionMs = positionMs,
            ),
        )
    }

    private fun telemetryEvent(
        eventType: String,
        plan: DispatchPlan,
        item: DispatchMediaItem,
        type: String,
        session: TelemetrySession,
        playedMs: Long? = null,
        completed: Boolean? = null,
        reason: String? = null,
        positionMs: Long? = null,
    ) = PlayerEventsClient.Event(
        eventType = eventType,
        playbackSessionId = session.id,
        mediaId = item.mediaId,
        mediaName = item.label,
        mediaType = item.mediaType ?: type,
        durationMs = session.durationMs
            ?: item.duration?.times(1000L)
            ?: if (eventType == "media.play.started") 0L else null,
        startedAt = session.startedAt,
        expectedEndAt = session.expectedEndAt,
        endedAt = if (eventType == "media.play.started") null else PlayerEventsClient.isoNow(),
        playedDurationMs = playedMs,
        completed = completed,
        reason = reason,
        positionMs = positionMs,
        source = session.source,
        playlistId = plan.playlistId.takeIf { it > 0 },
        campaignId = plan.campaignId,
        planVersion = knownPlanVersion,
        order = item.order,
        nextMedia = if (eventType == "media.play.started") {
            resolveNextMedia(plan.mediaItems, item)
        } else {
            null
        },
    )

    /**
     * Obtém token, faz dispatch e começa o loop de playback.
     */
    suspend fun start() {
        HtmlWebViewPlayback.configure(htmlWebView)
        displaySchedule = DisplayScheduleStore.load(context)
        eventsClient = PlayerEventsClient(
            context = context,
            baseUrl = apiClient.baseUrl.trimEnd('/'),
            uin = apiClient.uin,
            deviceId = apiClient.deviceId,
            dispatcher = apiClient,
            playerVersion = apiClient.appVersion,
        )

        PlayerAdLogger.i("LIFECYCLE", "(1) Heartbeat inicial — token/sessão (GET /token se necessário + POST /heartbeat)")
        var sessionToken = apiClient.cachedToken() ?: ""
        val initialPlanWithSource = try {
            val online = fetchOnlinePlan(sessionToken, "arranque")
            sessionToken = online.token
            online.plan to if (online.planState == PLAN_STATE_EMPTY) {
                PlanSource.EMPTY_PLAN
            } else {
                PlanSource.ONLINE
            }
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPATCH", "Falha no arranque online (heartbeat/dispatch); tentando fallback local", e)
            val persisted = loadDispatchPlanFromDisk()?.let { json ->
                runCatching {
                    val parsed = applyVinhetaMixToDispatchPlan(parseDispatchPlan(json))
                    parsed to resolvePlanState(json, parsed.mediaItems.size)
                }.getOrNull()
            }
            val persistedPlan = persisted?.first
            val persistedState = persisted?.second
            if (persistedPlan != null && persistedState == PLAN_STATE_ACTIVE) {
                PlayerAdLogger.logFallbackActivated(
                    "arranque offline — usando ultimo DispatchPlan persistido (${persistedPlan.mediaItems.size} itens)"
                )
                persistedPlan to PlanSource.PERSISTED
            } else if (persistedPlan != null && persistedState == PLAN_STATE_EMPTY) {
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Arranque offline preserva último estado autoritativo EMPTY_PLAN",
                )
                persistedPlan to PlanSource.EMPTY_PLAN
            } else {
                val fallback = buildFallbackPlan()
                if (fallback == null || fallback.mediaItems.isEmpty()) {
                    PlayerAdLogger.e("PLAYBACK", "Sem rede, sem DispatchPlan persistido util e sem fallback local", e)
                    throw e
                }
                PlayerAdLogger.logFallbackActivated(
                    "arranque offline — ${fallback.mediaItems.size} itens locais (propagandas)"
                )
                fallback to PlanSource.FALLBACK_LOCAL
            }
        }
        val (initialPlan, initialSource) = initialPlanWithSource
        updatePlanSource(initialSource, "Fonte inicial do plano")
        PlayerAdLogger.i(
            "LIFECYCLE",
            "(3) Loop de playback; batimento cardiaco=${batimentoCardiacoRuntime}s " +
                "(sonolência até ${pollAdaptive.maxHeartbeatSeconds}s; idle base ${pollAdaptive.idleHeartbeatSeconds}s); " +
                "GET /dispatch sob needsDispatch (safety ≤${maxSecondsWithoutServerCheckRuntime}s)"
        )
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
                ?: obj.optJSONObject("metadata")?.let { metadata ->
                    parsePositiveLong(metadata, "durationSeconds", "duration_seconds")
                        .takeIf { it > 0L }
                }
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
            val deliveryBakeVersion = parseDispatchDeliveryBakeVersion(obj)
            val contentVersion = parseDispatchContentVersion(obj)
            items += DispatchMediaItem(
                mediaId = mediaId,
                url = apiClient.resolveUrl(url),
                duration = duration,
                mediaType = mediaType,
                order = order,
                label = label,
                isVinheta = isVinheta,
                deliveryRotation = deliveryRotation,
                deliveryBakeVersion = deliveryBakeVersion,
                contentVersion = contentVersion,
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

        return DispatchPlan(playlistId, playlistName, items.sortedBy { it.order }, campaignId)
    }

    /** Alinhado ao backend (`cacheBucket`, tag `vinheta`, pasta `/vinhetas/`). */
    private fun parseDispatchContentVersion(obj: JSONObject): String? {
        val metadata = obj.optJSONObject("metadata") ?: return null
        return metadata.optString("contentVersion", "")
            .ifBlank { metadata.optString("content_version", "") }
            .ifBlank { null }
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

    private fun parseDispatchDeliveryBakeVersion(obj: JSONObject): Int? {
        val metadata = obj.optJSONObject("metadata")
        val fromMeta = metadata?.optInt("deliveryBakeVersion", -1)?.takeIf { it > 0 }
            ?: metadata?.optInt("delivery_bake_version", -1)?.takeIf { it > 0 }
        if (fromMeta != null) return fromMeta
        val tagsArray = obj.optJSONArray("tags") ?: return null
        for (i in 0 until tagsArray.length()) {
            val tag = tagsArray.optString(i, "")
            if (!tag.startsWith("_delivery_bake:")) continue
            val parsed = tag.removePrefix("_delivery_bake:").trim().toIntOrNull() ?: continue
            if (parsed > 0) return parsed
        }
        return null
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
     * Remove vinhetas do plano (tags/pasta vinhetas). Não intercala vinhetas locais/embutidas.
     */
    private fun applyVinhetaMixToDispatchPlan(plan: DispatchPlan): DispatchPlan {
        val withoutVinhetas = plan.mediaItems.filter { !it.isVinheta }
        if (withoutVinhetas.size == plan.mediaItems.size) return plan
        PlayerAdLogger.i(
            "DISPATCH",
            "Vinhetas ignoradas — ${plan.mediaItems.size - withoutVinhetas.size} item(ns) removido(s) do plano"
        )
        return plan.copy(
            mediaItems = withoutVinhetas.mapIndexed { index, item -> item.copy(order = index + 1) },
        )
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
            val versionOk =
                item.contentVersion.isNullOrBlank() ||
                meta?.contentVersion == item.contentVersion
            val hasValidCache =
                meta?.valid == true &&
                file != null && file.exists() &&
                versionOk

            if (!hasValidCache) {
                if (meta?.valid == true && file != null && file.exists() && !versionOk) {
                    cacheManager.markAsRemoved(item.mediaId)
                }
                downloadToCache(item)
            } else if (
                PortraitVideoCacheProcessor.isVideoFile(item.mediaType, item.url) &&
                file != null &&
                (
                    meta?.cacheOrientationReady != true ||
                        meta.cacheDisplayRotation == null ||
                        meta.cacheDisplayRotation != displayRotation
                    )
            ) {
                normalizeCachedVideo(item, file)
            }
        }
    }

    private suspend fun normalizeCachedVideo(
        item: DispatchMediaItem,
        file: File,
    ) = withContext(Dispatchers.IO) {
        // Se o SO já reflecte a montagem, não assar rotação no ficheiro (evita dupla rotação).
        // Se o SO NÃO reflecte, o ViewDisplayRotation gira o contentHost — também não assar
        // (bake + fallback = mídia de lado / invertida, como nas fotos da TV_BOX_3).
        val systemMountOk = br.com.smartchannel.playerad.util.SystemDisplayRotation
            .isViewportMatchingMount(context, displayRotation)
        cacheManager.updateCacheOrientationState(
            mediaId = item.mediaId,
            fileName = file.name,
            sizeBytes = file.length(),
            cacheOrientationReady = true,
            cacheRotated = false,
            cacheDisplayRotation = displayRotation,
        )
        PlayerAdLogger.i(
            "CACHE",
            "Skip bake ${file.name}: montagem em runtime " +
                "(systemMount=$systemMountOk visualFallback=${!systemMountOk}) mount=$displayRotation",
        )
        return@withContext
    }

    /**
     * Baixa uma mídia e registra no MediaCacheManager.
     * Aborta se não houver espaço livre suficiente no volume (após limpeza LRU).
     */
    private suspend fun downloadToCache(item: DispatchMediaItem) = withContext(Dispatchers.IO) {
        try {
            val now = System.currentTimeMillis()
            val failUntil = downloadFailUntilMs[item.mediaId] ?: 0L
            if (now < failUntil) {
                PlayerAdLogger.w(
                    "CACHE",
                    "Download em backoff mediaId=${item.mediaId} ainda ${((failUntil - now) / 1000L)}s",
                )
                return@withContext
            }
            val url = java.net.URL(item.url)
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.instanceFollowRedirects = true
            conn.connectTimeout = 20_000
            conn.readTimeout = 120_000
            conn.connect()
            val code = conn.responseCode
            if (code !in 200..299) {
                markDownloadFailure(item.mediaId, code)
                throw IllegalStateException("HTTP $code ao baixar mediaId=${item.mediaId}")
            }
            // content-type é hint: só rejeita tipos claramente não-binários
            val contentType = (conn.contentType ?: "").lowercase().substringBefore(';').trim()
            val suspiciousType =
                contentType == "image/svg+xml" ||
                    contentType == "text/html" ||
                    contentType == "application/json" ||
                    contentType == "text/json"
            if (suspiciousType) {
                markDownloadFailure(item.mediaId, code)
                throw IllegalStateException(
                    "Resposta inválida ($contentType) — ficheiro ausente no servidor? mediaId=${item.mediaId}"
                )
            }
            val declared = try {
                conn.contentLengthLong
            } catch (_: Exception) {
                -1L
            }
            val neededBytes = when {
                declared > 0L -> declared
                else -> MediaCacheManager.UNKNOWN_DOWNLOAD_ESTIMATE_BYTES
            }
            if (!cacheManager.ensureDiskSpaceFor(neededBytes)) {
                PlayerAdLogger.w(
                    "CACHE",
                    "Download cancelado por falta de espaço mediaId=${item.mediaId} need≈$neededBytes"
                )
                return@withContext
            }

            val ext = if (PortraitVideoCacheProcessor.isVideoFile(item.mediaType, item.url)) {
                "mp4"
            } else {
                guessExtension(item.mediaType, item.url)
            }
            val fileName = "${item.mediaId}.$ext"
            val outFile = File(propagandasDir, fileName)

            conn.inputStream.use { input ->
                FileOutputStream(outFile).use { out ->
                    input.copyTo(out)
                }
            }

            // Placeholder SVG antigo ou HTML gravado como .mp4
            if (outFile.length() < 512L) {
                val head = outFile.inputStream().use { it.readBytes().decodeToString() }
                if (head.contains("<svg") || head.contains("<!DOCTYPE") || head.contains("<html")) {
                    outFile.delete()
                    markDownloadFailure(item.mediaId, code)
                    throw IllegalStateException(
                        "Download parece placeholder/HTML (ficheiro em falta no servidor) mediaId=${item.mediaId}"
                    )
                }
            }
            downloadFailUntilMs.remove(item.mediaId)

            var finalFile = outFile
            var finalSize = outFile.length()
            var orientationReady = true
            var rotated = false
            // Montagem fica a cargo do SO ou do ViewDisplayRotation — nunca bake no ficheiro.
            val systemMountOk = br.com.smartchannel.playerad.util.SystemDisplayRotation
                .isViewportMatchingMount(context, displayRotation)
            PlayerAdLogger.i(
                "CACHE",
                "Download sem bake: montagem em runtime " +
                    "(systemMount=$systemMountOk visualFallback=${!systemMountOk}) " +
                    "mount=$displayRotation mediaId=${item.mediaId}",
            )

            cacheManager.onDownloadCompleted(
                mediaId = item.mediaId,
                fileName = finalFile.name,
                sizeBytes = finalSize,
                checksum = null,
                mimeType = item.mediaType,
                cacheOrientationReady = orientationReady,
                cacheRotated = rotated,
                cacheDisplayRotation = displayRotation,
                contentVersion = item.contentVersion,
            )
        } catch (e: Exception) {
            if (!downloadFailUntilMs.containsKey(item.mediaId)) {
                markDownloadFailure(item.mediaId, 0)
            }
            PlayerAdLogger.logDownloadFailed(item.mediaId, item.url, e)
        }
    }

    private fun markDownloadFailure(mediaId: Long, httpCode: Int) {
        val backoffMs = when {
            httpCode == 404 || httpCode == 410 -> 5 * 60_000L
            httpCode in 500..599 -> 60_000L
            else -> 30_000L
        }
        downloadFailUntilMs[mediaId] = System.currentTimeMillis() + backoffMs
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
        val adaptive = pollAdaptiveRuntime
        val heartbeatPoll = AdaptivePollScheduler(
            name = "heartbeat",
            activeBaseIntervalMs = batimentoCardiacoRuntime.coerceAtLeast(15) * 1000L,
            maxIntervalMs = adaptive.maxHeartbeatSeconds.coerceAtLeast(60) * 1000L,
            idleBaseIntervalMs = adaptive.idleHeartbeatSeconds.coerceAtLeast(30) * 1000L,
            unchangedBeforeSleep = adaptive.unchangedStreakBeforeSleep,
            sleepGrowthFactor = adaptive.sleepGrowthFactor,
            sleepEnabled = adaptive.enabled,
        )
        val dispatchPoll = AdaptivePollScheduler(
            name = "dispatch",
            activeBaseIntervalMs = maxSecondsWithoutServerCheckRuntime.coerceAtLeast(30) * 1000L,
            maxIntervalMs = adaptive.maxDispatchSeconds.coerceAtLeast(120) * 1000L,
            idleBaseIntervalMs = adaptive.idleDispatchSeconds.coerceAtLeast(60) * 1000L,
            unchangedBeforeSleep = adaptive.unchangedStreakBeforeSleep,
            sleepGrowthFactor = adaptive.sleepGrowthFactor,
            sleepEnabled = adaptive.enabled,
        )
        heartbeatPollRef = heartbeatPoll
        dispatchPollRef = dispatchPoll
        val nowBoot = System.currentTimeMillis()
        heartbeatPoll.markAttempted(nowBoot)
        dispatchPoll.markAttempted(nowBoot)
        var emptyPlanBackoffMs = 5_000L
        var index = 0
        var planSignature = planContentSignature(plan)
        var emptyPlanState = initialSource == PlanSource.EMPTY_PLAN
        var serverPollJob: Deferred<ServerPollCycleResult>? = null
        applyPlaybackVolumePolicy()
        while (true) {
            heartbeatPoll.setIdleMode(displayIdle)
            dispatchPoll.setIdleMode(displayIdle)

            // Aplicar resultado pronto sem esperar rede entre duas mídias.
            val completedPoll = serverPollJob
            if (completedPoll?.isCompleted == true) {
                try {
                    val result = completedPoll.await()
                    currentToken = result.token
                    when {
                        result.busyPlan != null -> {
                            currentPlan = result.busyPlan
                            index = result.busyIndex.coerceIn(
                                0,
                                (currentPlan.mediaItems.size - 1).coerceAtLeast(0),
                            )
                            planSignature = result.signature ?: planContentSignature(currentPlan)
                            emptyPlanState = currentPlan.mediaItems.isEmpty()
                            currentPlanSource = if (emptyPlanState) {
                                PlanSource.EMPTY_PLAN
                            } else {
                                PlanSource.ONLINE
                            }
                            updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                        }
                        result.quietPlan != null -> {
                            currentPlan = result.quietPlan
                            planSignature = result.signature ?: planContentSignature(currentPlan)
                            emptyPlanState = currentPlan.mediaItems.isEmpty()
                            currentPlanSource = if (emptyPlanState) {
                                PlanSource.EMPTY_PLAN
                            } else {
                                PlanSource.ONLINE
                            }
                            updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                            if (index >= currentPlan.mediaItems.size) index = 0
                        }
                    }
                } catch (e: Exception) {
                    PlayerAdLogger.w("POLL", "Poll assíncrono terminou com erro: ${e.message}")
                }
                serverPollJob = null
            }

            // Heartbeat/dispatch corre durante a mídia atual. O resultado só é aplicado
            // no início de uma iteração futura; nunca bloqueia a troca visual.
            if (serverPollJob == null && !released) {
                val pollToken = currentToken
                val pollIndex = index
                val pollSignature = planSignature
                val allowSafetyDispatch = !emptyPlanState
                serverPollJob = backgroundScope.async {
                    var busyPlan: DispatchPlan? = null
                    var busyIndex = pollIndex
                    var quietPlan: DispatchPlan? = null
                    var resultSignature: String? = null
                    val updatedToken = runDueServerPolls(
                        pollToken,
                        heartbeatPoll,
                        dispatchPoll,
                        currentIndex = pollIndex,
                        currentSignature = pollSignature,
                        allowSafetyDispatch = allowSafetyDispatch,
                        onBusyPlan = { newPlan, newIndex, newSig ->
                            busyPlan = newPlan
                            busyIndex = newIndex
                            resultSignature = newSig
                        },
                        onQuietPlan = { newPlan, newSig ->
                            quietPlan = newPlan
                            resultSignature = newSig
                        },
                    )
                    ServerPollCycleResult(
                        token = updatedToken,
                        busyPlan = busyPlan,
                        busyIndex = busyIndex,
                        quietPlan = quietPlan,
                        signature = resultSignature,
                    )
                }
            }

            if (emptyPlanState) {
                val waitMs = heartbeatPoll.millisUntilDue()
                    .coerceIn(1_000L, EMPTY_PLAN_MAX_WAKE_INTERVAL_MS)
                delay(waitMs)
                continue
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
                    emptyPlanBackoffMs = 5_000L
                    continue
                }
                // Plano vazio: tentar usar fallback sintético (propagandas + vinhetas locais)
                val fallback = buildFallbackPlan()
                if (fallback == null || fallback.mediaItems.isEmpty()) {
                    PlayerAdLogger.w(
                        "PLAYBACK",
                        "DispatchPlan sem itens e fallback local indisponível; aguardando ${emptyPlanBackoffMs}ms"
                    )
                    delay(emptyPlanBackoffMs)
                    emptyPlanBackoffMs = (emptyPlanBackoffMs * 2L).coerceAtMost(60_000L)
                    continue
                } else {
                    PlayerAdLogger.logFallbackActivated(
                        "plano remoto vazio — ${fallback.mediaItems.size} itens locais (propagandas/vinhetas)"
                    )
                    currentPlan = fallback
                    currentPlanSource = PlanSource.FALLBACK_LOCAL
                    updatePlanSource(currentPlanSource, "Fonte do plano alterada")
                    index = 0
                    emptyPlanBackoffMs = 5_000L
                }
            }

            if (currentPlan.mediaItems.isEmpty()) {
                // Guarda final: não martelar o servidor (antes: delay 250ms).
                PlayerAdLogger.w(
                    "PLAYBACK",
                    "Proteção acionada: plano ainda vazio; aguardando ${emptyPlanBackoffMs}ms antes de retry"
                )
                delay(emptyPlanBackoffMs)
                emptyPlanBackoffMs = (emptyPlanBackoffMs * 2L).coerceAtMost(60_000L)
                continue
            }

            emptyPlanBackoffMs = 5_000L

            // Horário de tela: fora do horário → preto total, processo vivo.
            if (!displaySchedule.isDisplayActiveNow()) {
                val enteringIdle = !displayIdle
                enterDisplayIdle()
                if (enteringIdle) {
                    index = 0
                    PlayerAdLogger.i(
                        "DISPLAY",
                        "Agenda entrou em modo off; fila preparada para retomar na primeira mídia",
                    )
                }
                maybeDisplayKeepAlive()
                delay(1_000L)
                if (remountLoopRequested) {
                    PlayerAdLogger.w("WATCHDOG", "Saindo do playLoop (idle) para remount")
                    break
                }
                continue
            }
            exitDisplayIdle()

            // 1) Reproduz primeiro (última frame/imagem permanece até o próximo item estar pronto).
            val item = currentPlan.mediaItems[index]
            currentToken = playItem(currentPlan, item, currentToken)

            index = (index + 1) % currentPlan.mediaItems.size
            if (index == 0 && currentPlan.mediaItems.size > 1) {
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Ciclo completo — repetindo fila na mesma ordem (${currentPlan.mediaItems.size} itens)"
                )
            }

            if (remountLoopRequested) {
                PlayerAdLogger.w("WATCHDOG", "Saindo do playLoop para remount do controller")
                break
            }
        }
    }

    /**
     * Heartbeat é o mensageiro: GET /dispatch só quando needsDispatch/comando.
     * Poll periódico de dispatch fica só como fallback de segurança.
     */
    private suspend fun runDueServerPolls(
        token: String,
        heartbeatPoll: AdaptivePollScheduler,
        dispatchPoll: AdaptivePollScheduler,
        currentIndex: Int,
        currentSignature: String,
        allowSafetyDispatch: Boolean,
        onBusyPlan: (DispatchPlan, Int, String) -> Unit,
        onQuietPlan: (DispatchPlan, String) -> Unit,
    ): String {
        var currentToken = token
        val nowMs = System.currentTimeMillis()
        heartbeatPoll.setIdleMode(displayIdle)
        dispatchPoll.setIdleMode(displayIdle)

        var fetchedViaHeartbeat = false
        var supportsPlanVersion = knownPlanVersion != null
        if (heartbeatPoll.due(nowMs)) {
            try {
                val heartbeat = performHeartbeat(currentToken)
                currentToken = heartbeat.token
                supportsPlanVersion = heartbeat.supportsPlanVersion
                val shouldFetchPlan = heartbeat.refreshDispatch ||
                    (heartbeat.supportsPlanVersion && heartbeat.needsDispatch)
                if (shouldFetchPlan) {
                    val logSource = when {
                        heartbeat.refreshDispatch -> "heartbeat_media_refresh"
                        else -> "heartbeat_plan_version"
                    }
                    val refreshed = refreshPlanAfterRemoteCommand(
                        currentToken,
                        currentIndex,
                        currentSignature,
                        logSource,
                    )
                    currentToken = refreshed.first
                    val newPlan = refreshed.second
                    val newIndex = refreshed.third
                    val newSig = planContentSignature(newPlan)
                    val planChanged = newSig != currentSignature || heartbeat.refreshDispatch
                    if (planChanged) {
                        onBusyPlan(newPlan, newIndex, newSig)
                        dispatchPoll.onBusySuccess()
                    } else {
                        onQuietPlan(newPlan, newSig)
                        dispatchPoll.onQuietSuccess()
                    }
                    dispatchPoll.markAttempted(System.currentTimeMillis())
                    fetchedViaHeartbeat = true
                    if (heartbeat.busy || planChanged) {
                        heartbeatPoll.onBusySuccess()
                    } else {
                        heartbeatPoll.onQuietSuccess()
                    }
                } else if (heartbeat.busy) {
                    heartbeatPoll.onBusySuccess()
                } else {
                    heartbeatPoll.onQuietSuccess()
                }
                PlayerAdLogger.i(
                    "HEARTBEAT",
                    "OK — próximo em ${heartbeatPoll.currentIntervalMs() / 1000}s " +
                        "needsDispatch=${heartbeat.needsDispatch} planVersion=${heartbeat.planVersion ?: "—"} " +
                        "known=${knownPlanVersion ?: "—"} legacy=${!heartbeat.supportsPlanVersion} idle=$displayIdle"
                )
            } catch (e: Exception) {
                val api = e as? ApiHttpException ?: e.cause as? ApiHttpException
                heartbeatPoll.onFailure(api?.code, api?.retryAfterSeconds)
                PlayerAdLogger.e(
                    "HEARTBEAT",
                    "Batimento cardiaco falhou; próximo em ${heartbeatPoll.currentIntervalMs() / 1000}s",
                    e
                )
            } finally {
                heartbeatPoll.markAttempted(System.currentTimeMillis())
            }
        }

        // Backend novo: safety raro. Backend legado: poll periódico como antes.
        val nowAfterHb = System.currentTimeMillis()
        val safetyDue = allowSafetyDispatch &&
            !fetchedViaHeartbeat && dispatchPoll.due(nowAfterHb) && (
            !supportsPlanVersion ||
                knownPlanVersion.isNullOrBlank() ||
                nowAfterHb - lastDispatchFetchAtMs >=
                maxSecondsWithoutServerCheckRuntime.coerceAtLeast(180) * 1000L
            )

        if (safetyDue) {
            try {
                val source = if (supportsPlanVersion) "safety_fallback" else "checagem_temporal"
                val refreshed = fetchDispatchPlan(currentToken, source)
                currentToken = refreshed.token
                val newPlan = refreshed.plan
                val newSignature = planContentSignature(newPlan)
                val changed = newSignature != currentSignature
                if (changed) {
                    PlayerAdLogger.i("DISPATCH", "Plano alterado ($source) — reiniciando fila")
                    onBusyPlan(newPlan, 0, newSignature)
                    dispatchPoll.onBusySuccess()
                } else {
                    onQuietPlan(newPlan, newSignature)
                    dispatchPoll.onQuietSuccess()
                }
                updatePlanSource(PlanSource.ONLINE, "Fonte do plano alterada")
                PlayerAdLogger.i(
                    "DISPATCH",
                    "$source OK — ${newPlan.mediaItems.size} itens; " +
                        "próximo em ${dispatchPoll.currentIntervalMs() / 1000}s (changed=$changed)"
                )
            } catch (e: Exception) {
                val api = e as? ApiHttpException ?: e.cause as? ApiHttpException
                dispatchPoll.onFailure(api?.code, api?.retryAfterSeconds)
                PlayerAdLogger.e(
                    "DISPATCH",
                    "Atualização de plano falhou; mantém plano; " +
                        "próximo em ${dispatchPoll.currentIntervalMs() / 1000}s",
                    e
                )
            } finally {
                dispatchPoll.markAttempted(System.currentTimeMillis())
            }
        }
        return currentToken
    }

    private fun enterDisplayIdle() {
        if (!displayIdle) {
            displayIdle = true
            PlayerAdLogger.i("DISPLAY", "Fora do horário — saída em preto (player ativo)")
        }
        // Overlay primeiro (acima de tudo): evita flash branco do TextureView ao pausar/parar.
        displayIdleOverlay?.let { overlay ->
            overlay.setBackgroundColor(Color.BLACK)
            overlay.visibility = View.VISIBLE
            overlay.bringToFront()
            overlay.elevation = 64f
        }
        MediaLayerTransition.reset(mediaTransitionOverlay)
        imageView.visibility = View.GONE
        htmlWebView.visibility = View.GONE
        try {
            exoPlayer.pause()
            // Não chamar stop(): no TextureView limpa o frame e muitas TVs mostram branco.
        } catch (_: Exception) { }
        // Mantém playerView por baixo do overlay preto (sem GONE → menos flicker).
        playerView.setBackgroundColor(Color.BLACK)
        playerView.setShutterBackgroundColor(Color.BLACK)
    }

    private fun exitDisplayIdle() {
        if (!displayIdle) {
            displayIdleOverlay?.visibility = View.GONE
            playerView.visibility = View.VISIBLE
            return
        }
        displayIdle = false
        playerView.visibility = View.VISIBLE
        playerView.setBackgroundColor(Color.BLACK)
        playerView.setShutterBackgroundColor(Color.BLACK)
        displayIdleOverlay?.visibility = View.GONE
        PlayerAdLogger.i("DISPLAY", "Dentro do horário — retomando saída de vídeo")
    }

    private fun maybeDisplayKeepAlive() {
        if (!displaySchedule.keepAliveWhileOff) return
        val intervalMs = displaySchedule.keepAliveIntervalMinutes.coerceIn(5, 30) * 60_000L
        val now = System.currentTimeMillis()
        if (now - lastKeepAliveAtMs < intervalMs) return
        lastKeepAliveAtMs = now
        // Nudge quase invisível: flash cinza muito escuro ~200ms para a TV não entrar em standby.
        displayIdleOverlay?.post {
            displayIdleOverlay?.setBackgroundColor(Color.rgb(2, 2, 2))
            displayIdleOverlay?.postDelayed({
                displayIdleOverlay?.setBackgroundColor(Color.BLACK)
            }, 200L)
        }
        PlayerAdLogger.i("DISPLAY", "Keep-alive anti-standby (nudge)")
    }

    private fun applyDisplayScheduleFromServer(raw: JSONObject?) {
        if (raw == null) return
        displaySchedule = DisplayScheduleStore.applyJson(context, raw)
        PlayerAdLogger.i(
            "DISPLAY",
            "Schedule atualizado enabled=${displaySchedule.enabled} " +
                "${displaySchedule.onTime}-${displaySchedule.offTime} tz=${displaySchedule.timezone}"
        )
    }

    /** Assinatura do plano para detectar reorder/conteúdo novo. */
    private fun planContentSignature(plan: DispatchPlan): String =
        plan.mediaItems.joinToString("|") { "${it.mediaId}:${it.order}:${it.contentVersion.orEmpty()}" }

    private data class HeartbeatOutcome(
        val token: String,
        val refreshDispatch: Boolean,
        /** Comando, OTA ou refresh — acorda o poll. */
        val busy: Boolean,
        val planVersion: String? = null,
        val needsDispatch: Boolean = false,
        val supportsPlanVersion: Boolean = false,
    )

    private data class RemoteCommandOutcome(
        val token: String,
        val refreshDispatch: Boolean
    )

    private data class OnlinePlanResult(
        val token: String,
        val plan: DispatchPlan,
        val planVersion: String? = null,
        val planState: String,
    )

    private data class ServerPollCycleResult(
        val token: String,
        val busyPlan: DispatchPlan? = null,
        val busyIndex: Int = 0,
        val quietPlan: DispatchPlan? = null,
        val signature: String? = null,
    )

    private suspend fun refreshPlanAfterRemoteCommand(
        currentToken: String,
        currentIndex: Int,
        currentSignature: String,
        logSource: String
    ): Triple<String, DispatchPlan, Int> {
        val refreshed = fetchDispatchPlan(currentToken, logSource)
        val newSignature = planContentSignature(refreshed.plan)
        val unchanged = newSignature == currentSignature
        val index = if (unchanged) {
            currentIndex.coerceIn(0, (refreshed.plan.mediaItems.size - 1).coerceAtLeast(0))
        } else {
            0
        }
        updatePlanSource(PlanSource.ONLINE, "Fonte do plano alterada")
        PlayerAdLogger.i(
            "DISPATCH",
            "Plano após $logSource — ${refreshed.plan.mediaItems.size} itens; " +
                "changed=${!unchanged} index=$index"
        )
        return Triple(refreshed.token, refreshed.plan, index)
    }

    private suspend fun fetchOnlinePlan(previousToken: String, logSource: String = "online"): OnlinePlanResult {
        val heartbeat = performHeartbeat(previousToken)
        return fetchDispatchPlan(heartbeat.token, logSource)
    }

    /** Heartbeat: comandos remotos, OTA, token e presença — sem GET dispatch. */
    private suspend fun performHeartbeat(previousToken: String): HeartbeatOutcome {
        PlayerAdLogger.i("LIFECYCLE", "Heartbeat — token/sessão/comandos (sync com fallback)")
        val hb = apiClient.heartbeatWithCommands(buildHealthMetrics(), knownPlanVersion)
        var token = hb.token
        PlayerAdLogger.i("HEARTBEAT", "OK — sessão/token renovados; comandos=${hb.pendingCommands.size}")
        eventsClient.updateObservation(hb.telemetryObservation) {
            buildHealthMetrics().apply {
                nowPlayingSnapshot?.let { put("nowPlaying", JSONObject(it.toString())) }
                put("displayIdle", displayIdle)
                put("planVersion", knownPlanVersion ?: JSONObject.NULL)
                put("exoPositionMs", runCatching { exoPlayer.currentPosition }.getOrDefault(0L))
                put("exoBufferedPositionMs", runCatching { exoPlayer.bufferedPosition }.getOrDefault(0L))
                put("exoPlaybackState", runCatching { exoPlayer.playbackState }.getOrDefault(Player.STATE_IDLE))
            }
        }
        hb.displaySchedule?.let { applyDisplayScheduleFromServer(it) }
        hb.pollAdaptive?.let { applyPollAdaptiveFromServer(it) }
        otaUpdateCoordinator?.handleFromHeartbeat(hb.otaUpdate)
        var refreshDispatch = false
        if (hb.pendingCommands.isNotEmpty()) {
            val outcome = processPendingCommands(hb.pendingCommands, token)
            token = outcome.token
            refreshDispatch = outcome.refreshDispatch
        }
        val effectiveToken = apiClient.cachedToken() ?: token.ifBlank { previousToken }
        val busy = hb.pendingCommands.isNotEmpty() ||
            refreshDispatch ||
            hb.otaUpdate != null ||
            hb.needsDispatch
        return HeartbeatOutcome(
            token = effectiveToken,
            refreshDispatch = refreshDispatch,
            busy = busy,
            planVersion = hb.planVersion,
            needsDispatch = hb.needsDispatch,
            supportsPlanVersion = hb.supportsPlanVersion,
        )
    }

    private fun applyPollAdaptiveFromServer(raw: org.json.JSONObject) {
        val next = PollAdaptiveConfig.fromJson(raw)
        if (next == pollAdaptiveRuntime) return
        pollAdaptiveRuntime = next
        PlayerAdLogger.i(
            "POLL",
            "pollAdaptive do servidor: enabled=${next.enabled} " +
                "idleHb=${next.idleHeartbeatSeconds}s maxHb=${next.maxHeartbeatSeconds}s"
        )
        try {
            val cfg = br.com.smartchannel.playerad.config.PlayerConfigLoader(context).load()
            br.com.smartchannel.playerad.config.PlayerConfigStore.save(
                context,
                cfg.copy(pollAdaptive = next),
            )
        } catch (e: Exception) {
            PlayerAdLogger.w("POLL", "Falha ao persistir pollAdaptive: ${e.message}")
        }
    }

    /** Atualiza plano de mídia (GET dispatch) sem novo heartbeat. */
    private suspend fun fetchDispatchPlan(previousToken: String, logSource: String = "dispatch"): OnlinePlanResult {
        PlayerAdLogger.i("LIFECYCLE", "DispatchPlan + pré-cache (GET /api/player/dispatch)")
        val token = apiClient.cachedToken()?.takeIf { it.isNotBlank() } ?: previousToken
        val dispatchJson = apiClient.getDispatchPlan(token)
        val effectiveToken = apiClient.cachedToken() ?: token.ifBlank { previousToken }
        val payload = dispatchJson.optJSONObject("data") ?: dispatchJson
        val planVersion = payload.optString("planVersion", "")
            .ifBlank { payload.optString("plan_version", "") }
            .trim()
            .ifBlank { null }
        val parsed = parseDispatchPlan(dispatchJson)
        val planState = resolvePlanState(dispatchJson, parsed.mediaItems.size)
        val savedJsonPath = saveDispatchPlanToDisk(dispatchJson)
        if (planState == PLAN_STATE_ACTIVE) preloadPlan(parsed)
        val plan = applyVinhetaMixToDispatchPlan(parsed)
        if (!planVersion.isNullOrBlank()) {
            knownPlanVersion = planVersion
        }
        lastDispatchFetchAtMs = System.currentTimeMillis()
        PlayerAdLogger.logDispatchPlanDetail(
            source = logSource,
            playlistId = plan.playlistId,
            playlistName = plan.playlistName,
            campaignId = plan.campaignId,
            sequenceEntries = formatDispatchSequence(plan.mediaItems),
            savedJsonPath = savedJsonPath
        )
        PlayerAdLogger.i(
            "DISPATCH",
            "Plano obtido ($logSource) planVersion=${planVersion ?: "—"} itens=${plan.mediaItems.size}"
        )
        return OnlinePlanResult(
            token = effectiveToken,
            plan = plan,
            planVersion = planVersion,
            planState = planState,
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
        val cfg = br.com.smartchannel.playerad.config.PlayerConfigLoader(context).load()
        return JSONObject().apply {
            put("player", "Player-AD")
            put("platform", "android")
            put("uin", apiClient.uin)
            put("deviceId", apiClient.deviceId)
            put("cacheRoot", root.absolutePath)
            put("propagandasCount", listFallbackFiles(propagandasDir).size)
            put("propagandasCacheValidCount", cacheManager.listValidCachedMediaFiles().size)
            put("fallbackPropagandasEligibleCount", collectFallbackPropagandas().size)
            put("storageFreeBytes", root.freeSpace)
            put("storageTotalBytes", root.totalSpace)
            put("storageUsableBytes", root.usableSpace)
            put(
                "storageFreePercent",
                if (root.totalSpace > 0L) {
                    ((root.usableSpace.toDouble() / root.totalSpace.toDouble()) * 100.0)
                } else {
                    0.0
                },
            )
            put("cacheSizeBytes", cacheManager.getCurrentCacheSizeBytes())
            put("maxCacheSizeBytes", cacheManager.maxCacheSizeBytes())
            put("maxCacheSizeMb", cfg.maxCacheSizeMb)
            cfg.maxCachePercentOfVolume?.let { put("maxCachePercentOfVolume", it) }
                ?: put("maxCachePercentOfVolume", JSONObject.NULL)
            put(
                "storage",
                br.com.smartchannel.playerad.config.PlayerConfigLoader
                    .storageModeToJsonValue(cfg.storageMode),
            )
            cfg.storagePathOverride?.takeIf { it.isNotBlank() }?.let {
                put("storagePathOverride", it)
            }
            put("heapUsedBytes", runtime.totalMemory() - runtime.freeMemory())
            put("heapMaxBytes", runtime.maxMemory())
            put("displayRotation", cfg.displayRotation)
            put(
                "screenOrientation",
                br.com.smartchannel.playerad.config.PlayerConfigLoader
                    .screenOrientationToJsonValue(cfg.screenOrientation),
            )
            put(
                "kioskMode",
                br.com.smartchannel.playerad.config.PlayerConfigLoader.kioskModeToJsonValue(cfg.kioskMode),
            )
            nowPlayingSnapshot?.let { put("nowPlaying", it) }
            val deviceClock = buildDeviceClockJson()
            put("deviceClock", deviceClock)
            put(
                "playerSettings",
                JSONObject().apply {
                    put("displayRotation", cfg.displayRotation)
                    put(
                        "screenOrientation",
                        br.com.smartchannel.playerad.config.PlayerConfigLoader
                            .screenOrientationToJsonValue(cfg.screenOrientation),
                    )
                    put(
                        "kioskMode",
                        br.com.smartchannel.playerad.config.PlayerConfigLoader.kioskModeToJsonValue(cfg.kioskMode),
                    )
                    put("batimentoCardiaco", cfg.batimentoCardiaco)
                    put("maxSecondsWithoutServerCheck", cfg.maxSecondsWithoutServerCheck)
                    put(
                        "mediaTransitionEnabled",
                        br.com.smartchannel.playerad.config.PlayerConfigLoader
                            .coerceMediaTransitionEnabled(cfg.mediaTransitionEnabled),
                    )
                    put("appVersion", apiClient.appVersion)
                    put("displayIdle", displayIdle)
                    put("displaySchedule", displaySchedule.toJson())
                    put("reportedDeviceClock", deviceClock)
                },
            )
            put("displayIdle", displayIdle)
            knownPlanVersion?.takeIf { it.isNotBlank() }?.let { put("knownPlanVersion", it) }
        }
    }

    private fun buildDeviceClockJson(): JSONObject {
        val nowMs = System.currentTimeMillis()
        val tz = java.util.TimeZone.getDefault()
        val cal = java.util.Calendar.getInstance(tz)
        cal.timeInMillis = nowMs
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
        fmt.timeZone = tz
        return JSONObject().apply {
            put("epochMs", nowMs)
            put("isoUtc", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date(nowMs)))
            put("localFormatted", fmt.format(java.util.Date(nowMs)))
            put("timezoneId", tz.id)
            put("timezoneOffsetMinutes", tz.getOffset(nowMs) / 60_000)
            put("reportedAtMs", nowMs)
        }
    }

    private fun setNowPlaying(mediaType: String, item: DispatchMediaItem, playlistName: String?) {
        nowPlayingSnapshot = JSONObject().apply {
            put("mediaId", item.mediaId)
            put("mediaType", mediaType)
            put("name", item.label ?: "")
            put("playlistName", playlistName ?: "")
            put("at", System.currentTimeMillis())
            if (item.deliveryRotation != null) put("deliveryRotation", item.deliveryRotation)
            if (item.deliveryBakeVersion != null) put("deliveryBakeVersion", item.deliveryBakeVersion)
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
                if (type == "invalidate_media" || type == "invalidate_playlist" || type == "invalidate_campaign" ||
                    type == "refresh_dispatch" || type == "sync_now" || type == "content_version_check"
                ) {
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
            val killProcess = forceProcessKillOnRestart
            forceProcessKillOnRestart = false
            restartRequested = false
            if (killProcess) {
                PlayerAdLogger.w("REMOTE_CMD", "Restart de app solicitado por comando remoto")
                scheduleAppRestart()
            } else {
                PlayerAdLogger.w(
                    "REMOTE_CMD",
                    "Remount do PlayerController (sem matar processo) — sai do loop",
                )
                remountLoopRequested = true
            }
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
            "refresh_dispatch", "sync_now" -> executeRefreshDispatch()
            "content_version_check" -> executeContentVersionCheck(data)
            "purge_cache" -> executePurgeCache()
            "restart_app", "restart" -> executeRestartApp()
            "reset_board", "reboot" -> executeResetBoard()
            "capture_screen", "screenshot" -> executeCaptureScreen()
            "config", "apply_player_config" -> executeApplyPlayerConfig(data)
            "display_force_on" -> executeDisplayForce("on")
            "display_force_off" -> executeDisplayForce("off")
            "display_force_clear" -> executeDisplayForce(null)
            "update" -> executeOtaUpdateCommand(data)
            "ota_rollback" -> OtaApkBackupStore.mockPrepareRollback(context)
            else -> throw IllegalArgumentException("Comando não suportado no Player-AD: $type")
        }
    }

    private fun executeDisplayForce(mode: String?): JSONObject {
        displaySchedule = displaySchedule.withForceMode(mode)
        DisplayScheduleStore.save(context, displaySchedule)
        PlayerAdLogger.i("DISPLAY", "forceMode=$mode (schedule local atualizado)")
        return JSONObject().apply {
            put("forceMode", mode ?: JSONObject.NULL)
            put("displayActive", displaySchedule.isDisplayActiveNow())
        }
    }

    private fun executeApplyPlayerConfig(data: JSONObject?): JSONObject {
        if (data == null) throw IllegalArgumentException("config sem payload")
        if (data.has("displaySchedule")) {
            applyDisplayScheduleFromServer(data.optJSONObject("displaySchedule"))
        }
        if (data.has("pollAdaptive")) {
            applyPollAdaptiveFromServer(data.optJSONObject("pollAdaptive") ?: JSONObject())
        }
        val loader = br.com.smartchannel.playerad.config.PlayerConfigLoader(context)
        val current = loader.load()
        val next = current.copy(
            displayRotation = if (data.has("displayRotation")) {
                data.optInt("displayRotation", current.displayRotation).coerceIn(0, 3)
            } else if (data.has("screenOrientation")) {
                br.com.smartchannel.playerad.config.PlayerConfigLoader.displayRotationFromMode(
                    br.com.smartchannel.playerad.config.PlayerConfigLoader.parseScreenOrientation(
                        data.optString("screenOrientation", ""),
                    ),
                )
            } else {
                current.displayRotation
            },
            kioskMode = if (data.has("kioskMode")) {
                br.com.smartchannel.playerad.config.PlayerConfigLoader.parseKioskMode(
                    data.optString("kioskMode", ""),
                )
            } else {
                current.kioskMode
            },
            batimentoCardiaco = if (data.has("batimentoCardiaco")) {
                data.optInt("batimentoCardiaco", current.batimentoCardiaco).coerceIn(15, 3600)
            } else {
                current.batimentoCardiaco
            },
            maxSecondsWithoutServerCheck = if (data.has("maxSecondsWithoutServerCheck")) {
                data.optInt("maxSecondsWithoutServerCheck", current.maxSecondsWithoutServerCheck)
                    .coerceIn(30, 3600)
            } else {
                current.maxSecondsWithoutServerCheck
            },
            pollAdaptive = if (data.has("pollAdaptive")) {
                PollAdaptiveConfig.fromJson(data.optJSONObject("pollAdaptive"))
            } else {
                current.pollAdaptive
            },
            acceptImagesInPlaylist = if (data.has("acceptImagesInPlaylist")) {
                data.optBoolean("acceptImagesInPlaylist", current.acceptImagesInPlaylist)
            } else {
                current.acceptImagesInPlaylist
            },
            allowPlaybackAudio = if (data.has("allowPlaybackAudio")) {
                data.optBoolean("allowPlaybackAudio", current.allowPlaybackAudio)
            } else {
                current.allowPlaybackAudio
            },
            mediaTransitionEnabled = if (data.has("mediaTransitionEnabled")) {
                br.com.smartchannel.playerad.config.PlayerConfigLoader
                    .parseMediaTransitionEnabled(data, current.mediaTransitionEnabled)
            } else {
                current.mediaTransitionEnabled
            },
            storageMode = if (data.has("storage")) {
                br.com.smartchannel.playerad.config.PlayerConfigLoader.parseStorageMode(
                    data.optString("storage", ""),
                )
            } else {
                current.storageMode
            },
            storagePathOverride = when {
                data.has("storagePathOverride") ->
                    data.optString("storagePathOverride", "").trim().takeIf { it.isNotBlank() }
                data.has("storage") &&
                    br.com.smartchannel.playerad.config.PlayerConfigLoader.parseStorageMode(
                        data.optString("storage", ""),
                    ) != br.com.smartchannel.playerad.config.PlayerStorageMode.PATH_OVERRIDE ->
                    null
                else -> current.storagePathOverride
            },
            maxCacheSizeMb = if (data.has("maxCacheSizeMb")) {
                br.com.smartchannel.playerad.config.PlayerConfigLoader.coerceMaxCacheSizeMb(
                    data.optInt("maxCacheSizeMb", current.maxCacheSizeMb),
                )
            } else {
                current.maxCacheSizeMb
            },
            maxCachePercentOfVolume = when {
                !data.has("maxCachePercentOfVolume") -> current.maxCachePercentOfVolume
                data.isNull("maxCachePercentOfVolume") -> null
                else -> {
                    val v = data.optInt("maxCachePercentOfVolume", 0)
                    if (v <= 0) null else v.coerceIn(1, 90)
                }
            },
        ).let { cfg ->
            val mode = cfg.storageMode
            if (mode == br.com.smartchannel.playerad.config.PlayerStorageMode.PATH_OVERRIDE &&
                cfg.storagePathOverride.isNullOrBlank()
            ) {
                throw IllegalArgumentException(
                    "storage=path_override exige storagePathOverride não vazio"
                )
            }
            cfg.copy(
                screenOrientation = br.com.smartchannel.playerad.config.PlayerConfigLoader
                    .displayRotationToMode(cfg.displayRotation),
            )
        }
        // serverUrl / uin / deviceId: só com flag explícita (evitar órfão)
        val allowIdentity = data.optBoolean("allowIdentityChange", false)
        val withIdentity = if (allowIdentity) {
            next.copy(
                serverUrl = data.optString("serverUrl", next.serverUrl).ifBlank { next.serverUrl },
                uin = data.optString("uin", next.uin).ifBlank { next.uin },
                deviceId = br.com.smartchannel.playerad.config.PlayerConfigLoader.normalizeDeviceId(
                    data.optString("deviceId", next.deviceId).ifBlank { next.deviceId },
                ),
            )
        } else {
            next
        }
        val saved = br.com.smartchannel.playerad.config.PlayerConfigStore.save(context, withIdentity)
        cacheManager.applyLimitsFromConfig(withIdentity)

        val hardRestart =
            withIdentity.displayRotation != current.displayRotation ||
                withIdentity.kioskMode != current.kioskMode ||
                withIdentity.storageMode != current.storageMode ||
                withIdentity.storagePathOverride != current.storagePathOverride ||
                (allowIdentity && (
                    withIdentity.serverUrl != current.serverUrl ||
                        withIdentity.uin != current.uin ||
                        withIdentity.deviceId != current.deviceId
                    ))

        // Soft-apply: campos que o loop lê em runtime (sem matar o processo)
        acceptImagesInPlaylist = withIdentity.acceptImagesInPlaylist
        allowPlaybackAudio = withIdentity.allowPlaybackAudio
        mediaTransitionEnabledRuntime = withIdentity.mediaTransitionEnabled
        batimentoCardiacoRuntime = withIdentity.batimentoCardiaco
        maxSecondsWithoutServerCheckRuntime = withIdentity.maxSecondsWithoutServerCheck
        if (data.has("pollAdaptive")) {
            pollAdaptiveRuntime = withIdentity.pollAdaptive
        }
        applyPlaybackVolumePolicy()
        heartbeatPollRef?.setActiveBaseIntervalMs(
            batimentoCardiacoRuntime.coerceAtLeast(15) * 1000L,
        )
        dispatchPollRef?.setActiveBaseIntervalMs(
            maxSecondsWithoutServerCheckRuntime.coerceAtLeast(30) * 1000L,
        )

        PlayerAdLogger.i(
            "REMOTE_CMD",
            "Config remota aplicada displayRotation=${withIdentity.displayRotation} " +
                "storage=${withIdentity.storageMode} maxCacheMb=${withIdentity.maxCacheSizeMb} " +
                "transition=${withIdentity.mediaTransitionEnabled} " +
                "internal=${saved.internalOk} sd=${saved.externalOk} hardRestart=$hardRestart",
        )
        if (hardRestart) {
            // Orientação / storage / kiosk / identidade: novo PlayerController via watchdog,
            // sem exitProcess (evita “reinstalação” a cada apply_player_config).
            restartRequested = true
            forceProcessKillOnRestart = false
        }
        return JSONObject().apply {
            put("applied", true)
            put("displayRotation", withIdentity.displayRotation)
            put("screenOrientation", br.com.smartchannel.playerad.config.PlayerConfigLoader
                .screenOrientationToJsonValue(withIdentity.screenOrientation))
            put("kioskMode", br.com.smartchannel.playerad.config.PlayerConfigLoader
                .kioskModeToJsonValue(withIdentity.kioskMode))
            put(
                "storage",
                br.com.smartchannel.playerad.config.PlayerConfigLoader
                    .storageModeToJsonValue(withIdentity.storageMode),
            )
            put("maxCacheSizeMb", withIdentity.maxCacheSizeMb)
            put("mediaTransitionEnabled", withIdentity.mediaTransitionEnabled)
            put("restartScheduled", hardRestart)
            put("softApplied", !hardRestart)
        }
    }

    private suspend fun executeOtaUpdateCommand(data: JSONObject?): JSONObject {
        // Mock alinhado: se payload tiver otaUpdate-like, reutiliza coordinator; senão só registo
        val otaJson = data?.optJSONObject("otaUpdate") ?: data
        if (otaJson != null && otaUpdateCoordinator != null) {
            val version = otaJson.optString("version", "unknown")
            OtaApkBackupStore.appendHistory(context, version, "command_update_received")
            // Antes de instalar, tentaríamos pushBackup do APK actual (Fase E completa)
            otaUpdateCoordinator.handleFromHeartbeat(otaJson)
            return JSONObject().apply {
                put("started", true)
                put("mockCompleteInstall", false)
                put("version", version)
                put("otaDir", OtaApkBackupStore.otaDir(context).absolutePath)
            }
        }
        OtaApkBackupStore.appendHistory(context, "n/a", "command_update_mock_empty")
        return JSONObject().apply {
            put("started", false)
            put("mock", true)
            put("message", "Comando update recebido sem payload OTA — histórico local actualizado")
            put("otaDir", OtaApkBackupStore.otaDir(context).absolutePath)
        }
    }

    private fun executeRefreshDispatch(): JSONObject {
        return JSONObject().put("refreshed", true)
    }

    private fun executeContentVersionCheck(data: JSONObject?): JSONObject {
        val checks = linkedMapOf<Long, String>()
        val itemsArr = data?.optJSONArray("items")
        if (itemsArr != null) {
            for (i in 0 until itemsArr.length()) {
                val obj = itemsArr.optJSONObject(i) ?: continue
                val id = obj.optLong("mediaId", obj.optLong("media_id", 0L))
                val ver = obj.optString("contentVersion", obj.optString("content_version", "")).trim()
                if (id > 0L && ver.isNotBlank()) checks[id] = ver
            }
        } else {
            val ver = data?.optString("contentVersion", data?.optString("content_version", "") ?: "")?.trim().orEmpty()
            if (ver.isNotBlank()) {
                extractMediaIds(data).forEach { id -> checks[id] = ver }
            }
        }
        if (checks.isEmpty()) {
            throw IllegalArgumentException("content_version_check sem items ou mediaIds+contentVersion")
        }

        val invalidated = JSONArray()
        val unchanged = JSONArray()
        val missing = JSONArray()
        for ((id, expected) in checks) {
            val meta = cacheManager.getMetadata(id)
            if (meta == null || !meta.valid) {
                missing.put(id)
                continue
            }
            val stored = meta.contentVersion
            if (stored.isNullOrBlank() || stored != expected) {
                cacheManager.markAsRemoved(id)
                invalidated.put(id)
            } else {
                unchanged.put(id)
            }
        }
        return JSONObject().apply {
            put("checked", checks.size)
            put("invalidated", invalidated)
            put("unchanged", unchanged)
            put("missing", missing)
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
        // Evita entradas valid=true órfãs após apagar ficheiros.
        cacheManager.invalidateAllEntriesKeepHistory()
        cacheManager.init()
        return JSONObject().apply {
            put("removedFiles", removed)
            put("cachePath", dir.absolutePath)
            put("metadataInvalidated", true)
        }
    }

    private fun executeRestartApp(): JSONObject {
        restartRequested = true
        forceProcessKillOnRestart = true
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

        // Enviar JPEG base64 ao servidor (path Android sozinho não serve para o painel)
        val jpegBytes = encodeScreenshotJpeg(out)
        val b64 = android.util.Base64.encodeToString(jpegBytes, android.util.Base64.NO_WRAP)
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size, bounds)

        return JSONObject().apply {
            put("filePath", out.absolutePath)
            put("fileSize", jpegBytes.size)
            put("format", "jpg")
            put("width", bounds.outWidth.coerceAtLeast(0))
            put("height", bounds.outHeight.coerceAtLeast(0))
            put("imageBase64", b64)
        }
    }

    private fun encodeScreenshotJpeg(pngFile: File): ByteArray {
        val opts = android.graphics.BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        android.graphics.BitmapFactory.decodeFile(pngFile.absolutePath, opts)
        var sample = 1
        val maxSide = 1280
        val w = opts.outWidth
        val h = opts.outHeight
        while (w / sample > maxSide || h / sample > maxSide) {
            sample *= 2
        }
        val decode = android.graphics.BitmapFactory.Options().apply { inSampleSize = sample.coerceAtLeast(1) }
        val bmp = android.graphics.BitmapFactory.decodeFile(pngFile.absolutePath, decode)
            ?: throw IllegalStateException("Falha ao decodificar screenshot")
        val stream = java.io.ByteArrayOutputStream()
        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 72, stream)
        bmp.recycle()
        return stream.toByteArray()
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
        val versionOk =
            item.contentVersion.isNullOrBlank() ||
                meta?.contentVersion == item.contentVersion
        var hasValidCache =
            !isFileUrl &&
                meta?.valid == true &&
                file != null &&
                file.exists() &&
                versionOk
        var playFile = file

        if (isVideo && !isFileUrl && !hasValidCache) {
            val failUntil = downloadFailUntilMs[item.mediaId] ?: 0L
            if (System.currentTimeMillis() < failUntil) {
                PlayerAdLogger.w(
                    "PLAYBACK",
                    "Skip vídeo mediaId=${item.mediaId}: sem cache e download em backoff",
                )
                delay(1_500L)
                return t
            }
            downloadToCache(item)
            val metaAfter = cacheManager.getMetadata(item.mediaId)
            val cached = metaAfter?.fileName?.let { File(propagandasDir, it) }
            val versionOkAfter =
                item.contentVersion.isNullOrBlank() ||
                    metaAfter?.contentVersion == item.contentVersion
            if (metaAfter?.valid == true && cached != null && cached.exists() && versionOkAfter) {
                hasValidCache = true
                playFile = cached
                PlayerAdLogger.i("CACHE", "Vídeo mediaId=${item.mediaId} obtido em cache antes da reprodução")
            } else {
                PlayerAdLogger.w(
                    "PLAYBACK",
                    "Skip vídeo mediaId=${item.mediaId}: download falhou / sem ficheiro local",
                )
                delay(1_500L)
                return t
            }
        }

        if (isHtml) {
            return playHtmlItem(plan, item, t, isFileUrl, hasValidCache, file, today)
        }

        // Para imagens, não usamos ExoPlayer: mostramos em ImageView.
        if (!isVideo) {
            if (!acceptImagesInPlaylist) {
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Imagem ignorada (aceitar imagens na playlist desligado) — mediaId=${item.mediaId}"
                )
                delay(1L)
                return t
            }
            hideHtmlLayer()
            // Exposição só conta se > 0; vídeo não passa por este ramo (duração real no ExoPlayer).
            val exposureSec = item.duration?.takeIf { it > 0L }
            val durationSeconds = exposureSec ?: DEFAULT_IMAGE_DURATION_SECONDS
            val durationMs = durationSeconds * 1000L

            // Mesmo item já visível (plano com 1 mídia / cópias): não refaz véu/decode.
            if (
                item.mediaId > 0L &&
                item.mediaId == activeImageMediaId &&
                imageView.visibility == View.VISIBLE &&
                imageView.drawable != null
            ) {
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Imagem contínua mediaId=${item.mediaId} — sem transição"
                )
                PlayerAdLogger.logPlaybackStart(
                    "imagem",
                    item.mediaId,
                    plan.playlistName,
                    plan.playlistId
                )
                setNowPlaying("image", item, plan.playlistName)
                val telemetry = beginTelemetry(plan, item, "image", durationMs, "memory")
                delay(durationMs)
                finishTelemetry(
                    plan, item, "image", telemetry, durationMs,
                    completed = true, reason = "duration_elapsed",
                )
                PlayerAdLogger.logPlaybackEnd("imagem", item.mediaId, durationSeconds)
                return t
            }
            activeVideoMediaId = -1L
            activeVideoContentVersion = null

            // Tentar obter bitmap ANTES de esconder vídeo — evita ecrã preto na troca.
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

            PlayerAdLogger.logPlaybackStart(
                "imagem",
                item.mediaId,
                plan.playlistName,
                plan.playlistId
            )
            setNowPlaying("image", item, plan.playlistName)
            val telemetry = beginTelemetry(
                plan,
                item,
                "image",
                durationMs,
                if (imageUri.scheme == "file") "cache" else "network",
            )

            if (bitmap != null) {
                val imagePath = if (imageUri.scheme == "file") imageUri.path else null
                // Véu opaco no root: ImageView com letterbox não pode deixar ver TextureView.
                mediaTransitionCover()
                try {
                    exoPlayer.pause()
                } catch (_: Exception) { }
                concealPlayerSurface()
                applyImageOrientationCorrection(
                    bitmap,
                    imagePath,
                    item.deliveryRotation,
                    item.deliveryBakeVersion,
                )
            } else {
                mediaTransitionCover()
                try {
                    exoPlayer.pause()
                } catch (_: Exception) { }
                concealPlayerSurface()
                resetMediaViewOrientation()
                imageView.setImageDrawable(null)
            }
            imageView.setBackgroundColor(Color.BLACK)
            imageView.alpha = 1f
            imageView.visibility = View.VISIBLE
            imageView.bringToFront()
            mediaTransitionOverlay?.bringToFront()
            mediaTransitionAwaitFrames(2)
            mediaTransitionReveal()
            if (bitmap != null) {
                activeImageMediaId = item.mediaId
            } else {
                activeImageMediaId = -1L
                errorTelemetry(plan, item, "image", telemetry, "image_decode_failed")
            }

            delay(durationMs)
            if (bitmap != null) {
                finishTelemetry(
                    plan, item, "image", telemetry, durationMs,
                    completed = true, reason = "duration_elapsed",
                )
            }
            // Não esconder aqui — o próximo playItem faz a troca com conteúdo novo já pronto.
            PlayerAdLogger.logPlaybackEnd("imagem", item.mediaId, durationSeconds)
            return t
        }

        hideHtmlLayer()
        applyPlaybackVolumePolicy()

        // Replay contínuo: mesmo vídeo já no ExoPlayer (playlist de 1 item / expand antigo).
        if (canSeamlessReplayVideo(item)) {
            return playVideoSeamlessReplay(plan, item, t)
        }
        activeImageMediaId = -1L

        PlayerAdLogger.logPlaybackStart(
            "vídeo",
            item.mediaId,
            plan.playlistName,
            plan.playlistId
        )
        setNowPlaying("video", item, plan.playlistName)

        val mediaItem: MediaItem = when {
            isFileUrl -> MediaItem.fromUri(Uri.parse(item.url))
            hasValidCache && playFile != null -> {
                cacheManager.onPlayFromCache(item.mediaId, today)
                MediaItem.fromUri(Uri.fromFile(playFile))
            }
            else -> MediaItem.fromUri(Uri.parse(item.url))
        }

        // 1) Véu no root  2) esconde imagem  3) prepara com TextureView oculto
        // 4) 1º frame + matrix FIT  5) frames GPU  6) revela — sem reapply pós-reveal.
        mediaTransitionCover()
        imageView.visibility = View.GONE
        imageView.setImageDrawable(null)
        concealPlayerSurface()
        playerView.setBackgroundColor(Color.BLACK)
        playerView.setShutterBackgroundColor(Color.BLACK)
        // Mantém VISIBLE (surface viva) mas alpha 0 no TextureView — evita residual.
        playerView.visibility = View.VISIBLE
        detachVideoOrientationListener()
        val orientationGate = CompletableDeferred<Unit>()
        videoOrientationReady = orientationGate
        exoPlayer.setMediaItem(mediaItem, /* resetPosition= */ true)
        val cacheMeta = cacheManager.getMetadata(item.mediaId)
        val systemMountOk = br.com.smartchannel.playerad.util.SystemDisplayRotation
            .isViewportMatchingMount(context, displayRotation)
        // Bake no ficheiro + ViewDisplayRotation/systemMount = dupla rotação. Invalidar.
        if (hasValidCache && cacheMeta?.cacheRotated == true) {
            PlayerAdLogger.w(
                "CACHE",
                "Cache bake incompatível com montagem em runtime " +
                    "(mediaId=${item.mediaId} systemMount=$systemMountOk) — a invalidar",
            )
            cacheManager.markAsRemoved(item.mediaId)
        }
        val cacheAlreadyRotated = false
        attachVideoOrientationListener(
            item.deliveryRotation,
            item.deliveryBakeVersion,
            cacheAlreadyRotated = cacheAlreadyRotated,
        )
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
        playerView.post { FullscreenViewport.applyToPlayerView(playerView) }

        awaitFirstVideoFrame(8_000L)
        withTimeoutOrNull(1_500L) { orientationGate.await() }
            ?: PlayerAdLogger.w("DISPLAY", "Timeout matrix orientação; revelando com FIT atual")
        // Matrix pode ter sido postada no próximo frame — espera composição.
        mediaTransitionAwaitFrames(2)
        showPlayerSurface()
        playerView.bringToFront()
        mediaTransitionOverlay?.bringToFront()
        mediaTransitionReveal()
        activeVideoMediaId = item.mediaId
        activeVideoContentVersion = item.contentVersion

        val actualDurationMs = exoPlayer.duration
            .takeIf { it != C.TIME_UNSET && it > 0L }
            ?: item.duration?.times(1000L)
        val telemetry = beginTelemetry(
            plan,
            item,
            "video",
            actualDurationMs,
            if (isFileUrl || (hasValidCache && playFile != null)) "cache" else "network",
        )

        val playbackTimeoutMs = videoWatchdogTimeoutMs(item)
        val restartOnEnd = shouldRestartVideoOnEnd(plan, item)
        val completedPosition = withTimeoutOrNull(playbackTimeoutMs) {
            waitForPlaybackEnd(restartOnEnd = restartOnEnd)
        }
        val timedOut = completedPosition == null
        val playedMs = completedPosition ?: run {
            val currentPosition = exoPlayer.currentPosition
            PlayerAdLogger.w(
                "WATCHDOG",
                "Timeout de reprodução mediaId=${item.mediaId}; avançando item após ${playbackTimeoutMs / 1000L}s"
            )
            try {
                exoPlayer.pause()
            } catch (_: Exception) { }
            currentPosition
        }
        PlayerAdLogger.logPlaybackEnd(
            "vídeo",
            item.mediaId,
            (playedMs / 1000L).coerceAtLeast(0L)
        )

        // Não stop() aqui — próximo item (ou imagem) assume com último frame ainda no TextureView.
        val playbackError = exoPlayer.playerError
        if (playbackError != null) {
            errorTelemetry(
                plan, item, "video", telemetry,
                playbackError.errorCodeName.ifBlank { playbackError.message ?: "exo_player_error" },
                playedMs,
            )
        } else {
            finishTelemetry(
                plan, item, "video", telemetry, playedMs,
                completed = !timedOut,
                reason = if (timedOut) "watchdog_timeout" else "ended",
                positionMs = playedMs,
            )
        }
        return t
    }

    private fun canSeamlessReplayVideo(item: DispatchMediaItem): Boolean {
        if (item.mediaId <= 0L || item.mediaId != activeVideoMediaId) return false
        val expectedVersion = item.contentVersion
        if (!expectedVersion.isNullOrBlank() && expectedVersion != activeVideoContentVersion) {
            return false
        }
        if (exoPlayer.mediaItemCount <= 0) return false
        // Surface tem de estar visível (já revelada na 1ª passagem).
        if (playerView.visibility != View.VISIBLE) return false
        return true
    }

    /**
     * Playlist de 1 vídeo (ou só o mesmo mediaId): no ENDED fazer seek(0) já,
     * antes do heartbeat — senão o shutter preto fica visível no intervalo.
     */
    private fun shouldRestartVideoOnEnd(plan: DispatchPlan, item: DispatchMediaItem): Boolean {
        if (item.mediaId <= 0L || plan.mediaItems.isEmpty()) return false
        if (!isVideoOrAudioPlaybackType(item.mediaType, item.url)) return false
        return plan.mediaItems.all { it.mediaId == item.mediaId }
    }

    /**
     * Mesmo mediaId já carregado: seek(0) + play sem véu/teardown (elimina flick no loop de 1 item).
     */
    private suspend fun playVideoSeamlessReplay(
        plan: DispatchPlan,
        item: DispatchMediaItem,
        token: String,
    ): String {
        var t = token
        applyPlaybackVolumePolicy()

        // Se waitForPlaybackEnd já fez seek(0) no ENDED, o vídeo já está a tocar —
        // novo seek aqui (mesmo a meio do clip) provoca flick.
        val alreadyPlaying =
            exoPlayer.playWhenReady &&
                exoPlayer.playerError == null &&
                exoPlayer.playbackState != Player.STATE_ENDED &&
                exoPlayer.playbackState != Player.STATE_IDLE

        if (alreadyPlaying) {
            PlayerAdLogger.i(
                "PLAYBACK",
                "Vídeo contínuo mediaId=${item.mediaId} — já em reprodução pós-ENDED (sem seek)",
            )
        } else {
            PlayerAdLogger.i(
                "PLAYBACK",
                "Vídeo contínuo mediaId=${item.mediaId} — seek(0) sem transição",
            )
            try {
                exoPlayer.seekTo(0L)
                exoPlayer.playWhenReady = true
                if (exoPlayer.playbackState == Player.STATE_IDLE) {
                    exoPlayer.prepare()
                    exoPlayer.playWhenReady = true
                }
                withTimeoutOrNull(3_000L) {
                    while (exoPlayer.playbackState == Player.STATE_ENDED) {
                        delay(16L)
                    }
                }
                awaitPlayerReady(3_000L)
            } catch (e: Exception) {
                PlayerAdLogger.e(
                    "PLAYBACK",
                    "Falha no replay contínuo; força troca completa no próximo ciclo",
                    e,
                )
                activeVideoMediaId = -1L
                activeVideoContentVersion = null
                try {
                    exoPlayer.seekTo(0L)
                    exoPlayer.prepare()
                    exoPlayer.playWhenReady = true
                    awaitPlayerReady(3_000L)
                } catch (_: Exception) { }
            }
        }

        PlayerAdLogger.logPlaybackStart(
            "vídeo",
            item.mediaId,
            plan.playlistName,
            plan.playlistId
        )
        setNowPlaying("video", item, plan.playlistName)

        val telemetry = beginTelemetry(
            plan,
            item,
            "video",
            exoPlayer.duration.takeIf { it != C.TIME_UNSET && it > 0L }
                ?: item.duration?.times(1000L),
            "memory",
        )

        val playbackTimeoutMs = videoWatchdogTimeoutMs(item)
        val restartOnEnd = shouldRestartVideoOnEnd(plan, item)
        val completedPosition = withTimeoutOrNull(playbackTimeoutMs) {
            waitForPlaybackEnd(restartOnEnd = restartOnEnd)
        }
        val timedOut = completedPosition == null
        val playedMs = completedPosition ?: run {
            val currentPosition = exoPlayer.currentPosition
            PlayerAdLogger.w(
                "WATCHDOG",
                "Timeout de reprodução (contínuo) mediaId=${item.mediaId}; avançando após ${playbackTimeoutMs / 1000L}s"
            )
            try {
                exoPlayer.pause()
            } catch (_: Exception) { }
            currentPosition
        }
        PlayerAdLogger.logPlaybackEnd(
            "vídeo",
            item.mediaId,
            (playedMs / 1000L).coerceAtLeast(0L)
        )

        val playbackError = exoPlayer.playerError
        if (playbackError != null) {
            errorTelemetry(
                plan, item, "video", telemetry,
                playbackError.errorCodeName.ifBlank { playbackError.message ?: "exo_player_error" },
                playedMs,
            )
        } else {
            finishTelemetry(
                plan, item, "video", telemetry, playedMs,
                completed = !timedOut,
                reason = if (timedOut) "watchdog_timeout" else "ended",
                positionMs = playedMs,
            )
        }
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
        activeVideoMediaId = -1L
        activeVideoContentVersion = null
        activeImageMediaId = -1L
        resetMediaViewOrientation()
        mediaTransitionCover()
        hideImageLayer()
        // Não stop(): limpa TextureView e provoca flicker/ghosting em landscape.
        try {
            exoPlayer.pause()
        } catch (_: Exception) { }
        concealPlayerSurface()
        mediaTransitionReveal()

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
        setNowPlaying("html", item, plan.playlistName)

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
        val telemetry = beginTelemetry(
            plan,
            item,
            "html",
            durationMs,
            if (cachedFile != null) "cache" else "network",
        )
        var htmlErrorReason: String? = null

        HtmlWebViewPlayback.load(
            webView = htmlWebView,
            serverBaseUrl = apiClient.baseUrl,
            httpUrl = resolvedHttpUrl,
            cachedHtmlFile = cachedFile,
            onMainFrameError = { htmlErrorReason = it },
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
        concealPlayerSurface()
        val htmlError = htmlErrorReason
        if (htmlError != null) {
            errorTelemetry(plan, item, "html", telemetry, htmlError)
        } else {
            finishTelemetry(
                plan, item, "html", telemetry, durationMs,
                completed = true, reason = "duration_elapsed",
            )
        }
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

    /**
     * Esconde a superfície de vídeo sem destruir o TextureView (GONE limpa o buffer
     * e em montagem landscape provoca ghosting entre mídias).
     * Em Allwinner o TextureView pode ignorar alpha do PlayerView — zerar o surface.
     */
    private fun concealPlayerSurface() {
        playerView.setBackgroundColor(Color.BLACK)
        playerView.setShutterBackgroundColor(Color.BLACK)
        playerView.alpha = 0f
        try {
            (playerView.videoSurfaceView as? TextureView)?.alpha = 0f
        } catch (_: Exception) { }
        playerView.visibility = View.INVISIBLE
    }

    /** Mostra TextureView só depois do 1º frame + matrix, ainda sob o véu. */
    private fun showPlayerSurface() {
        playerView.setBackgroundColor(Color.BLACK)
        playerView.setShutterBackgroundColor(Color.BLACK)
        playerView.visibility = View.VISIBLE
        try {
            (playerView.videoSurfaceView as? TextureView)?.alpha = 1f
        } catch (_: Exception) { }
        playerView.alpha = 1f
    }

    private fun resetMediaViewOrientation() {
        detachVideoOrientationListener()
        videoOrientationReady?.cancel()
        videoOrientationReady = null
        playerView.alpha = 1f
        try {
            (playerView.videoSurfaceView as? TextureView)?.alpha = 1f
        } catch (_: Exception) { }
        MediaLayerTransition.reset(mediaTransitionOverlay)
        applyFullscreenVideoScale()
        MediaViewportRotation.resetPlayerView(playerView)
        MediaViewportRotation.resetView(imageView)
        imageView.scaleType = ImageView.ScaleType.FIT_CENTER
    }

    private fun applyFullscreenVideoScale() {
        // FILL no AspectRatioFrameLayout: surface = viewport inteiro.
        // FIT (escala uniforme min, largura cheia em landscape) via matrix em MediaViewportRotation.
        // Sem matrix uniforme o TextureView em FILL estica (círculos → ovais).
        playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
        exoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
        playerView.post { FullscreenViewport.applyToPlayerView(playerView) }
    }

    private fun attachVideoOrientationListener(
        deliveryRotation: Int? = null,
        deliveryBakeVersion: Int? = null,
        cacheAlreadyRotated: Boolean = false,
    ) {
        if (!AUTO_MEDIA_ORIENTATION && !MediaViewportRotation.needsLandscapeStripFlip(deliveryRotation)) {
            signalVideoOrientationReady()
            return
        }
        detachVideoOrientationListener()
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(videoSize: VideoSize) {
                if (released) return
                val (rawW, rawH) = MediaViewportRotation.rawVideoSize(videoSize)
                // ExoPlayer dispara 0x0 no attach/teardown — aplicar matrix aí causa flicker.
                if (rawW <= 0 || rawH <= 0) return
                if (cacheAlreadyRotated) {
                    // Cache local já adequado a displayRotation — FIT sem esticar
                    applyFullscreenVideoScale()
                    MediaViewportRotation.applyToPlayerView(
                        playerView,
                        0f,
                        rawW,
                        rawH,
                        VIDEO_VIEWPORT_SCALE,
                    )
                    signalVideoOrientationReady()
                    return
                }
                if (AUTO_MEDIA_ORIENTATION) {
                    applyVideoOrientationCorrection(videoSize, deliveryRotation, deliveryBakeVersion)
                } else {
                    applyLandscapeStripFlipIfNeeded(videoSize, deliveryRotation)
                    signalVideoOrientationReady()
                }
            }
        }
        videoOrientationListener = listener
        exoPlayer.addListener(listener)
        val currentSize = exoPlayer.videoSize
        if (currentSize.width > 0 && currentSize.height > 0) {
            listener.onVideoSizeChanged(currentSize)
        }
    }

    private fun applyLandscapeStripFlipIfNeeded(videoSize: VideoSize, deliveryRotation: Int?) {
        if (!MediaViewportRotation.needsLandscapeStripFlip(deliveryRotation)) return
        try {
            val (rawW, rawH) = MediaViewportRotation.rawVideoSize(videoSize)
            val rot = MediaViewportRotation.landscapeStripPlaybackRotation(deliveryRotation, videoSize)
            if (rot == 0f) return
            playerView.post {
                try {
                    applyFullscreenVideoScale()
                    PlayerAdLogger.i(
                        "DISPLAY",
                        "Flip faixa landscape ${rot.toInt()}° deliveryRotation=$deliveryRotation " +
                            "vídeo ${rawW}x${rawH} metaRot=${videoSize.unappliedRotationDegrees}",
                    )
                    MediaViewportRotation.applyToPlayerView(
                        playerView,
                        rot,
                        rawW,
                        rawH,
                        VIDEO_VIEWPORT_SCALE,
                    )
                } catch (e: Exception) {
                    PlayerAdLogger.e("DISPLAY", "Falha flip faixa landscape; mantém FIT matrix", e)
                    MediaViewportRotation.resetPlayerView(playerView)
                    applyFullscreenVideoScale()
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

    private fun applyVideoOrientationCorrection(
        videoSize: VideoSize,
        deliveryRotation: Int? = null,
        deliveryBakeVersion: Int? = null,
    ) {
        if (released || !AUTO_MEDIA_ORIENTATION) return
        try {
            val (rawW, rawH) = MediaViewportRotation.rawVideoSize(videoSize)
            if (rawW <= 0 || rawH <= 0) return
            val viewMountApplied = isViewDisplayRotationActive()
            // SO já orientou o framebuffer à montagem → sem segunda rotação na TextureView.
            val systemMountOk = br.com.smartchannel.playerad.util.SystemDisplayRotation
                .isViewportMatchingMount(context, displayRotation)
            val rot = if (viewMountApplied || systemMountOk) {
                0f
            } else {
                MediaViewportRotation.correctionRotationForVideo(
                    context,
                    displayRotation,
                    videoSize,
                    deliveryRotation,
                    deliveryBakeVersion,
                )
            }
            if (released) return
            applyFullscreenVideoScale()
            PlayerAdLogger.i(
                "DISPLAY",
                "Correção orientação vídeo deliveryRotation=$deliveryRotation " +
                    "bake=$deliveryBakeVersion viewMount=$viewMountApplied systemMount=$systemMountOk " +
                    "eff=${MediaViewportRotation.effectiveVideoSize(videoSize).let { "${it.first}x${it.second}" }} " +
                    "raw=${rawW}x${rawH} → ${rot.toInt()}° mount=$displayRotation FIT",
            )
            // Sempre aplicar matrix (incl. 0°): corrige stretch do TextureView em FILL
            MediaViewportRotation.applyToPlayerView(
                playerView,
                rot,
                rawW,
                rawH,
                VIDEO_VIEWPORT_SCALE,
            )
            signalVideoOrientationReady()
        } catch (e: Exception) {
            PlayerAdLogger.e("DISPLAY", "Falha ao corrigir orientação do vídeo; mantém FIT matrix", e)
            try {
                val (w, h) = MediaViewportRotation.rawVideoSize(videoSize)
                if (w <= 0 || h <= 0) {
                    signalVideoOrientationReady()
                    return
                }
                applyFullscreenVideoScale()
                MediaViewportRotation.applyToPlayerView(
                    playerView,
                    0f,
                    w,
                    h,
                    VIDEO_VIEWPORT_SCALE,
                )
            } catch (_: Exception) {
                MediaViewportRotation.resetPlayerView(playerView)
                applyFullscreenVideoScale()
            }
            signalVideoOrientationReady()
        }
    }

    /** True se [ViewDisplayRotation] já rodou o contentHost (fallback quando SO não aplica user_rotation). */
    private fun isViewDisplayRotationActive(): Boolean {
        return try {
            val host = (context as? android.app.Activity)?.findViewById<View>(R.id.contentHost)
            host != null && kotlin.math.abs(host.rotation) > 0.5f
        } catch (_: Exception) {
            false
        }
    }

    private fun signalVideoOrientationReady() {
        val gate = videoOrientationReady ?: return
        if (!gate.isCompleted) {
            gate.complete(Unit)
        }
    }

    private fun applyImageOrientationCorrection(
        bitmap: Bitmap,
        filePath: String?,
        deliveryRotation: Int? = null,
        deliveryBakeVersion: Int? = null,
    ) {
        // 1) EXIF → pixels upright (BitmapFactory ignora orientação)
        val upright = MediaViewportRotation.applyExifToBitmap(bitmap, filePath)
        val w = upright.width
        val h = upright.height

        // 2) Montagem do totem (só se viewport ainda não foi rodado pelo fallback)
        val viewMountApplied = isViewDisplayRotationActive()
        val systemMountOk = br.com.smartchannel.playerad.util.SystemDisplayRotation
            .isViewportMatchingMount(context, displayRotation)
        val mountRot = if (!AUTO_MEDIA_ORIENTATION || viewMountApplied || systemMountOk) {
            0f
        } else {
            MediaViewportRotation.playbackCorrectionDegrees(
                context,
                displayRotation,
                w,
                h,
                deliveryRotation,
                deliveryBakeVersion,
                isVideo = false,
            )
        }
        val displayBitmap = if (mountRot != 0f) {
            PlayerAdLogger.i(
                "DISPLAY",
                "Correção orientação imagem ${w}x${h} → ${mountRot.toInt()}° " +
                    "deliveryRotation=$deliveryRotation bake=$deliveryBakeVersion mount=$displayRotation",
            )
            try {
                MediaViewportRotation.rotateBitmap(upright, mountRot)
            } catch (e: Exception) {
                PlayerAdLogger.e("DISPLAY", "Falha ao rodar bitmap; mantém upright", e)
                upright
            }
        } else {
            upright
        }

        val landscapeContent = w > h
        imageView.scaleType = if (landscapeContent) {
            ImageView.ScaleType.FIT_CENTER
        } else {
            ImageView.ScaleType.CENTER_CROP
        }
        imageView.setImageBitmap(displayBitmap)
        MediaViewportRotation.applyToImageView(imageView, 0f)
    }

    private fun fallbackDurationForMediaType(mediaType: String): Long? = when (mediaType) {
        "image" -> DEFAULT_IMAGE_DURATION_SECONDS
        "html" -> DEFAULT_HTML_DURATION_SECONDS
        else -> null
    }

    /**
     * Plano sintético offline: apenas propagandas locais + cache válido (sem vinhetas embutidas).
     */
    private fun buildFallbackPlan(): DispatchPlan? {
        val propagandas = collectFallbackPropagandas()
        if (propagandas.isEmpty()) return null

        val items = propagandas.mapIndexed { index, src ->
            fallbackItemFromSource(src, index + 1)
        }

        return DispatchPlan(
            playlistId = 0L,
            playlistName = "Fallback (propagandas locais, ${propagandas.size})",
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
     * Limite do maior lado do bitmap em px.
     * Usa o máximo entre viewport e 1920 para não “subamostrar” imagens 1080×1920 /
     * 1920×1080 (zoom/qualidade inconsistente em fotos mais pequenas ou maiores).
     */
    private fun targetMaxBitmapSidePx(): Int {
        val viewport = (context as? android.app.Activity)?.findViewById<View>(R.id.portraitViewport)
        val viewportLongest = if (viewport != null && viewport.width > 0 && viewport.height > 0) {
            maxOf(viewport.width, viewport.height)
        } else {
            val dm = context.resources.displayMetrics
            maxOf(dm.widthPixels, dm.heightPixels)
        }
        return maxOf(viewportLongest, 1920).coerceIn(1080, 3840)
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

    /**
     * Aguarda o 1º frame *renderizado* do vídeo atual.
     * [Player.STATE_READY] sozinho ainda pode mostrar residual do item anterior
     * com [PlayerView.setKeepContentOnPlayerReset].
     */
    private suspend fun awaitFirstVideoFrame(timeoutMs: Long) {
        val gotFrame = withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Unit> { cont ->
                val listener = object : Player.Listener {
                    override fun onRenderedFirstFrame() {
                        exoPlayer.removeListener(this)
                        if (cont.isActive) cont.resume(Unit)
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        exoPlayer.removeListener(this)
                        if (cont.isActive) cont.resume(Unit)
                    }
                }
                exoPlayer.addListener(listener)
                // Já READY com posição > 0 pode ter frame; ainda assim preferimos o callback.
                if (exoPlayer.playbackState == Player.STATE_ENDED) {
                    exoPlayer.removeListener(listener)
                    if (cont.isActive) cont.resume(Unit)
                    return@suspendCancellableCoroutine
                }
                cont.invokeOnCancellation { exoPlayer.removeListener(listener) }
            }
        }
        if (gotFrame == null) {
            PlayerAdLogger.w("DISPLAY", "Timeout aguardando 1º frame de vídeo; revelando mesmo assim")
            awaitPlayerReady(1_500L)
        }
    }

    /** Aguarda STATE_READY (fallback / áudio). */
    private suspend fun awaitPlayerReady(timeoutMs: Long) {
        withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Unit> { cont ->
                val state = exoPlayer.playbackState
                if (state == Player.STATE_READY || state == Player.STATE_ENDED) {
                    cont.resume(Unit)
                    return@suspendCancellableCoroutine
                }
                val listener = object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_READY || playbackState == Player.STATE_ENDED) {
                            exoPlayer.removeListener(this)
                            if (cont.isActive) cont.resume(Unit)
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        exoPlayer.removeListener(this)
                        if (cont.isActive) cont.resume(Unit)
                    }
                }
                exoPlayer.addListener(listener)
                cont.invokeOnCancellation { exoPlayer.removeListener(listener) }
            }
        }
    }

    private suspend fun waitForPlaybackEnd(restartOnEnd: Boolean = false): Long =
        suspendCancellableCoroutine { cont ->
        fun finish(playedMs: Long) {
            if (cont.isActive) {
                cont.resume(playedMs.coerceAtLeast(0L))
            }
        }

        fun playedPositionMs(): Long {
            val duration = exoPlayer.duration
            if (duration > 0L) return duration
            return exoPlayer.currentPosition.coerceAtLeast(0L)
        }

        fun restartSeamlessIfNeeded() {
            if (!restartOnEnd) return
            try {
                // Seek imediato no ENDED — o heartbeat/dispatch corre depois, sem ecrã preto.
                exoPlayer.seekTo(0L)
                exoPlayer.playWhenReady = true
                PlayerAdLogger.i(
                    "PLAYBACK",
                    "Loop seamless: seek(0) no ENDED (evita flick preto entre ciclos)",
                )
            } catch (e: Exception) {
                PlayerAdLogger.w("PLAYBACK", "seek(0) no ENDED falhou: ${e.message}")
            }
        }

        // Erro/estado já ocorreram (ex.: 404 durante sendEvent) — não bloquear o loop.
        if (exoPlayer.playerError != null) {
            PlayerAdLogger.w(
                "PLAYBACK",
                "Erro ExoPlayer já presente: ${exoPlayer.playerError?.message}",
            )
            finish(playedPositionMs())
            return@suspendCancellableCoroutine
        }
        if (exoPlayer.playbackState == Player.STATE_ENDED) {
            val played = playedPositionMs()
            restartSeamlessIfNeeded()
            finish(played)
            return@suspendCancellableCoroutine
        }

        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    exoPlayer.removeListener(this)
                    val played = playedPositionMs()
                    restartSeamlessIfNeeded()
                    finish(played)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                exoPlayer.removeListener(this)
                PlayerAdLogger.w("PLAYBACK", "Erro ExoPlayer: ${error.message}")
                finish(playedPositionMs())
            }
        }
        exoPlayer.addListener(listener)
        // Revalidar após registar (race com thread do ExoPlayer).
        if (exoPlayer.playerError != null) {
            exoPlayer.removeListener(listener)
            finish(playedPositionMs())
            return@suspendCancellableCoroutine
        }
        if (exoPlayer.playbackState == Player.STATE_ENDED) {
            exoPlayer.removeListener(listener)
            val played = playedPositionMs()
            restartSeamlessIfNeeded()
            finish(played)
            return@suspendCancellableCoroutine
        }
        cont.invokeOnCancellation { exoPlayer.removeListener(listener) }
    }

    companion object {
        internal const val PLAN_STATE_ACTIVE = "ACTIVE"
        internal const val PLAN_STATE_EMPTY = "EMPTY"

        internal fun resolvePlanState(response: JSONObject, mediaItemCount: Int): String {
            val payload = response.optJSONObject("data") ?: response
            val plan = payload.optJSONObject("plan") ?: response.optJSONObject("plan")
            val explicit = payload.optString("planState", "")
                .ifBlank { payload.optString("plan_state", "") }
                .trim()
                .uppercase(Locale.ROOT)

            return when (explicit) {
                PLAN_STATE_ACTIVE -> {
                    require(mediaItemCount > 0) {
                        "DispatchPlan ACTIVE deve conter ao menos uma mídia"
                    }
                    PLAN_STATE_ACTIVE
                }
                PLAN_STATE_EMPTY -> {
                    require(mediaItemCount == 0) {
                        "DispatchPlan EMPTY não pode conter mídias"
                    }
                    PLAN_STATE_EMPTY
                }
                "" -> {
                    require(plan != null && (plan.has("mediaItems") || plan.has("media_items"))) {
                        "Resposta de dispatch sem planState e sem lista de mídias"
                    }
                    if (mediaItemCount > 0) PLAN_STATE_ACTIVE else PLAN_STATE_EMPTY
                }
                else -> throw IllegalArgumentException("planState desconhecido: $explicit")
            }
        }

        fun resolveNextMedia(
            mediaItems: List<DispatchMediaItem>,
            current: DispatchMediaItem,
        ): PlayerEventsClient.MediaDescriptor? {
            if (mediaItems.isEmpty()) return null
            val ordered = mediaItems.sortedBy { it.order }
            val currentIndex = ordered.indexOfFirst { it === current }.takeIf { it >= 0 }
                ?: ordered.indexOfFirst {
                    it.mediaId == current.mediaId && it.order == current.order
                }.takeIf { it >= 0 }
                ?: return null
            val next = ordered[(currentIndex + 1) % ordered.size]
            return PlayerEventsClient.MediaDescriptor(
                id = next.mediaId,
                name = next.label?.takeIf { it.isNotBlank() } ?: "Mídia ${next.mediaId}",
                type = next.mediaType?.takeIf { it.isNotBlank() } ?: "unknown",
                durationMs = next.duration?.times(1000L) ?: 0L,
                order = next.order,
            )
        }

        /** SUSPENSO v1.55 — orientação/resolução vêm do servidor. */
        private const val AUTO_MEDIA_ORIENTATION = MediaViewportRotation.ENABLED
        /** Largura cheia em landscape 16:9; letterbox Y se sobrar altura — sem stretch. */
        private val VIDEO_VIEWPORT_SCALE = MediaViewportRotation.VideoScaleMode.FIT
        private const val VIDEO_WATCHDOG_MIN_MS = 30_000L
        private const val VIDEO_WATCHDOG_GRACE_MS = 15_000L
        /** Quando duração desconhecida — não segurar o ecrã preto vários minutos. */
        private const val VIDEO_WATCHDOG_FALLBACK_MS = 45_000L
        private const val VIDEO_WATCHDOG_MAX_MS = 15 * 60 * 1000L
        private const val HTML_PLAYBACK_GRACE_MS = 5_000L
        private const val EMPTY_PLAN_MAX_WAKE_INTERVAL_MS = 60_000L
    }
}


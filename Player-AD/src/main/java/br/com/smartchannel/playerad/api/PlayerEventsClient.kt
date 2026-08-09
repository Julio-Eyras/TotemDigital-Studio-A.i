package br.com.smartchannel.playerad.api

import android.content.Context
import br.com.smartchannel.playerad.util.PlayerAdLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.min
import kotlin.random.Random

/**
 * Telemetria v2: o chamador somente publica no [inbox]. Persistência e rede rodam em IO.
 * O JSONL é reescrito atomicamente após cada ACK e limitado para não consumir o disco.
 */
class PlayerEventsClient(
    context: Context,
    private val baseUrl: String,
    private val uin: String,
    private val deviceId: String,
    private val dispatcher: DispatcherApiClient,
    private val playerName: String = "Player-AD",
    private val playerVersion: String,
) {
    data class Event(
        val eventType: String,
        val playbackSessionId: String = UUID.randomUUID().toString(),
        val mediaId: Long? = null,
        val mediaName: String? = null,
        val mediaType: String? = null,
        val durationMs: Long? = null,
        val startedAt: String? = null,
        val expectedEndAt: String? = null,
        val endedAt: String? = null,
        val playedDurationMs: Long? = null,
        val completed: Boolean? = null,
        val reason: String? = null,
        val positionMs: Long? = null,
        val source: String? = null,
        val playlistId: Long? = null,
        val campaignId: Long? = null,
        val planVersion: String? = null,
        val order: Int? = null,
        val nextMedia: MediaDescriptor? = null,
        val metrics: JSONObject? = null,
    )

    data class MediaDescriptor(
        val id: Long,
        val name: String,
        val type: String,
        val durationMs: Long,
        val order: Int,
    )

    data class Ack(
        val highestSequence: Long?,
        val acknowledgedIds: Set<String>,
        val rejectedIds: Set<String>,
    ) {
        fun shouldRemove(event: JSONObject, acknowledgedBootId: String? = null): Boolean {
            val id = event.optString("eventId")
            val sequence = event.optLong("sequence", -1)
            return id in acknowledgedIds || id in rejectedIds ||
                (
                    highestSequence != null &&
                        (acknowledgedBootId == null || event.optString("bootId") == acknowledgedBootId) &&
                        sequence in 0..highestSequence
                    )
        }
    }

    private data class HttpResponse(val code: Int, val body: String)

    private val appContext = context.applicationContext
    private val queueFile = File(appContext.filesDir, "telemetry/events-v2.jsonl")
    private val prefs = appContext.getSharedPreferences("player_telemetry_v2", Context.MODE_PRIVATE)
    private val bootId = UUID.randomUUID().toString()
    private val sequence = AtomicLong(0)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val inbox = Channel<JSONObject>(Channel.UNLIMITED)
    private val pending = mutableListOf<JSONObject>()
    private var syncEventsUnsupportedUntilMs =
        prefs.getLong(KEY_SYNC_EVENTS_UNSUPPORTED_UNTIL_MS, 0L)
    private var batchEventsUnsupportedUntilMs =
        prefs.getLong(KEY_BATCH_EVENTS_UNSUPPORTED_UNTIL_MS, 0L)
    private var retryAttempt = 0
    private var observationJob: Job? = null
    @Volatile private var closed = false

    init {
        scope.launch {
            loadQueue()
            launch { persistInbox() }
            flushLoop()
        }
    }

    fun enqueue(event: Event) {
        if (closed) return
        val now = isoNow()
        val json = JSONObject().apply {
            put("eventId", UUID.randomUUID().toString())
            put("bootId", bootId)
            put("sequence", sequence.incrementAndGet())
            put("playbackSessionId", event.playbackSessionId)
            put("eventType", event.eventType)
            put("occurredAt", now)
            if (event.mediaId != null || event.mediaName != null || event.mediaType != null) {
                put("media", JSONObject().apply {
                    event.mediaId?.let { put("id", it) }
                    put("name", event.mediaName?.takeIf { it.isNotBlank() } ?: "Mídia ${event.mediaId ?: "desconhecida"}")
                    put("type", event.mediaType?.takeIf { it.isNotBlank() } ?: "unknown")
                    if (event.eventType == "media.play.started") {
                        put("durationMs", event.durationMs ?: 0L)
                    } else {
                        event.durationMs?.let { put("durationMs", it) }
                    }
                })
            }
            put("playback", JSONObject().apply {
                event.startedAt?.let { put("startedAt", it) }
                event.expectedEndAt?.let { put("expectedEndAt", it) }
                event.endedAt?.let { put("endedAt", it) }
                event.playedDurationMs?.let { put("playedDurationMs", it) }
                event.completed?.let { put("completed", it) }
                event.reason?.let { put("reason", it) }
                event.positionMs?.let { put("positionMs", it) }
                event.source?.let { put("source", it) }
            })
            put("context", JSONObject().apply {
                event.playlistId?.let { put("playlistId", it) }
                event.campaignId?.let { put("campaignId", it) }
                event.planVersion?.let { put("planVersion", it) }
                event.order?.let { put("order", it) }
                event.nextMedia?.let { next ->
                    put("nextMedia", JSONObject().apply {
                        put("id", next.id)
                        put("name", next.name)
                        put("type", next.type)
                        put("durationMs", next.durationMs)
                        put("order", next.order)
                    })
                }
            })
            put("player", JSONObject().apply {
                put("name", playerName)
                put("version", playerVersion)
                put("platform", "android")
            })
            event.metrics?.let { put("metrics", it) }
        }
        inbox.trySend(json)
    }

    fun updateObservation(
        observation: DispatcherApiClient.TelemetryObservation?,
        metricsProvider: () -> JSONObject,
    ) {
        observationJob?.cancel()
        observationJob = null
        if (observation?.active != true || observation.isExpired()) return
        observationJob = scope.launch {
            val intervalMs = observation.intervalSeconds.coerceIn(2, 3600) * 1000L
            while (isActive && !observation.isExpired()) {
                delay(intervalMs)
                if (!isActive || observation.isExpired()) break
                enqueue(
                    Event(
                        eventType = "player.observation.sample",
                        playbackSessionId = bootId,
                        source = "heartbeat_observation",
                        metrics = runCatching(metricsProvider).getOrElse { JSONObject() },
                    ),
                )
            }
        }
    }

    fun close() {
        closed = true
        observationJob?.cancel()
        inbox.close()
        scope.launch {
            delay(250L)
            scope.cancel()
        }
    }

    private suspend fun persistInbox() {
        for (event in inbox) {
            synchronized(QUEUE_FILE_LOCK) {
                pending += event
                trimQueueLocked()
                rewriteQueueLocked()
            }
        }
    }

    private suspend fun flushLoop() {
        while (scope.isActive) {
            delay(FLUSH_INTERVAL_MS)
            val batchSnapshot = synchronized(QUEUE_FILE_LOCK) {
                if (pending.isEmpty()) {
                    null
                } else {
                    val firstBoot = pending.first().optString("bootId")
                    firstBoot to pending.asSequence()
                        .takeWhile { it.optString("bootId") == firstBoot }
                        .take(MAX_BATCH)
                        .toList()
                }
            } ?: continue
            val (firstBoot, batch) = batchSnapshot
            clearExpiredCapabilityCooldowns()
            val response = sendWithCapabilityFallback(firstBoot, batch) ?: continue
            val ack = parseAck(response.body)
            synchronized(QUEUE_FILE_LOCK) {
                val before = pending.size
                pending.removeAll { ack.shouldRemove(it, firstBoot) }
                if (pending.size == before && batch.isNotEmpty()) {
                    // Backend v2 que responde somente contadores: sucesso implica ACK deste batch.
                    pending.removeAll(batch.toSet())
                }
                rewriteQueueLocked()
            }
            retryAttempt = 0
        }
    }

    private suspend fun retryDelay() {
        retryAttempt = min(retryAttempt + 1, 8)
        val base = min(2_000L * (1L shl (retryAttempt - 1)), MAX_RETRY_MS)
        delay(base + Random.nextLong(0, (base / 3).coerceAtLeast(1)))
    }

    private suspend fun sendWithCapabilityFallback(
        batchBootId: String,
        batch: List<JSONObject>,
    ): HttpResponse? {
        val now = System.currentTimeMillis()
        if (syncEventsUnsupportedUntilMs <= now) {
            val response = runCatching { sendSync(batch) }.getOrElse {
                PlayerAdLogger.w("EVENT", "Sync de eventos indisponível: ${it.message}")
                retryDelay()
                return null
            }
            when {
                response.code == 401 -> {
                    runCatching { dispatcher.getToken() }
                    retryDelay()
                    return null
                }
                response.code == 404 || response.code == 405 -> {
                    PlayerAdLogger.w(
                        "EVENT",
                        "Sync de eventos não suportado (HTTP ${response.code}); usando fallback temporário",
                    )
                    markCapabilityUnsupported(
                        KEY_SYNC_EVENTS_UNSUPPORTED_UNTIL_MS,
                        System.currentTimeMillis() + CAPABILITY_REPROBE_INTERVAL_MS,
                    )
                }
                response.code !in 200..299 -> {
                    PlayerAdLogger.w(
                        "EVENT",
                        "Sync de eventos falhou HTTP ${response.code}: ${response.body.take(300)}",
                    )
                    retryDelay()
                    return null
                }
                else -> return response
            }
        }

        if (batchEventsUnsupportedUntilMs <= now) {
            val response = runCatching { sendBatch(batchBootId, batch) }.getOrElse {
                PlayerAdLogger.w("EVENT", "Batch v2 indisponível: ${it.message}")
                retryDelay()
                return null
            }
            when {
                response.code == 401 -> {
                    runCatching { dispatcher.getToken() }
                    retryDelay()
                    return null
                }
                response.code == 404 || response.code == 405 ||
                    response.code == 415 || response.code == 422 -> {
                    PlayerAdLogger.w(
                        "EVENT",
                        "Batch v2 não suportado (HTTP ${response.code}); usando fallback temporário",
                    )
                    markCapabilityUnsupported(
                        KEY_BATCH_EVENTS_UNSUPPORTED_UNTIL_MS,
                        System.currentTimeMillis() + CAPABILITY_REPROBE_INTERVAL_MS,
                    )
                }
                response.code !in 200..299 -> {
                    PlayerAdLogger.w(
                        "EVENT",
                        "Batch v2 falhou HTTP ${response.code}: ${response.body.take(300)}",
                    )
                    retryDelay()
                    return null
                }
                else -> return response
            }
        }

        flushLegacy(batch)
        return null
    }

    private fun sendSync(batch: List<JSONObject>): HttpResponse {
        val body = JSONObject().apply {
            put("schemaVersion", 1)
            put("syncId", stableSyncId(batch))
            put("events", JSONArray(batch))
        }.toString()
        return post(
            "$baseUrl/api/player/sync?uin=${encode(uin)}&token=${encode(token())}" +
                "&deviceId=${encode(deviceId)}",
            body,
        )
    }

    private fun sendBatch(batchBootId: String, batch: List<JSONObject>): HttpResponse {
        val body = JSONObject().apply {
            put("schemaVersion", 2)
            put("bootId", batchBootId)
            put("events", JSONArray(batch))
        }.toString()
        return post(
            "$baseUrl/api/player/events/batch?uin=${encode(uin)}&token=${encode(token())}" +
                "&deviceId=${encode(deviceId)}",
            body,
        )
    }

    private fun flushLegacy(batch: List<JSONObject>) {
        val processed = mutableSetOf<JSONObject>()
        for (event in batch) {
            val media = event.optJSONObject("media") ?: JSONObject()
            val playback = event.optJSONObject("playback") ?: JSONObject()
            val context = event.optJSONObject("context") ?: JSONObject()
            val mediaType = media.optString("type").lowercase()
            val legacyType = when (event.optString("eventType")) {
                "media.play.started" -> when {
                    mediaType.contains("video") || mediaType.contains("audio") -> "video_playback_start"
                    mediaType.contains("html") || mediaType in setOf("web", "widget", "iframe") -> "html_display"
                    else -> "image_display"
                }
                "media.play.ended" -> if (
                    mediaType.contains("video") || mediaType.contains("audio")
                ) "video_playback_end" else null
                else -> null
            }
            if (legacyType == null) {
                processed += event
                continue
            }
            val body = JSONObject().apply {
                put("eventType", legacyType)
                if (media.has("id")) put("mediaId", media.optLong("id"))
                if (context.has("playlistId")) put("playlistId", context.optLong("playlistId"))
                if (context.has("campaignId")) put("campaignId", context.optLong("campaignId"))
                if (playback.has("playedDurationMs")) {
                    put("duration", playback.optLong("playedDurationMs") / 1000L)
                }
                if (playback.has("completed")) put("completed", playback.optBoolean("completed"))
                put("metadata", JSONObject().apply {
                    put("eventId", event.optString("eventId"))
                    put("playbackSessionId", event.optString("playbackSessionId"))
                    put("sequence", event.optLong("sequence"))
                    put("deviceId", deviceId)
                })
            }.toString()
            val response = runCatching {
                post(
                    "$baseUrl/api/player/event?uin=${encode(uin)}&token=${encode(token())}" +
                        "&deviceId=${encode(deviceId)}",
                    body,
                )
            }.getOrNull()
            if (response?.code in 200..299) processed += event else break
        }
        synchronized(QUEUE_FILE_LOCK) {
            pending.removeAll(processed)
            rewriteQueueLocked()
        }
    }

    private fun token(): String = dispatcher.cachedToken().orEmpty()

    private fun stableSyncId(batch: List<JSONObject>): String {
        val identity = batch.joinToString("|") {
            "${it.optString("bootId")}:${it.optString("eventId")}:${it.optLong("sequence")}"
        }
        return UUID.nameUUIDFromBytes(identity.toByteArray(Charsets.UTF_8)).toString()
    }

    private fun markCapabilityUnsupported(key: String, untilMs: Long) {
        when (key) {
            KEY_SYNC_EVENTS_UNSUPPORTED_UNTIL_MS -> syncEventsUnsupportedUntilMs = untilMs
            KEY_BATCH_EVENTS_UNSUPPORTED_UNTIL_MS -> batchEventsUnsupportedUntilMs = untilMs
        }
        prefs.edit().putLong(key, untilMs).apply()
    }

    private fun clearExpiredCapabilityCooldowns() {
        val now = System.currentTimeMillis()
        val edit = prefs.edit()
        if (syncEventsUnsupportedUntilMs in 1..now) {
            syncEventsUnsupportedUntilMs = 0L
            edit.remove(KEY_SYNC_EVENTS_UNSUPPORTED_UNTIL_MS)
        }
        if (batchEventsUnsupportedUntilMs in 1..now) {
            batchEventsUnsupportedUntilMs = 0L
            edit.remove(KEY_BATCH_EVENTS_UNSUPPORTED_UNTIL_MS)
        }
        edit.apply()
    }

    private fun post(url: String, body: String): HttpResponse {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 8_000
            readTimeout = 8_000
            setRequestProperty("Content-Type", "application/json")
        }
        return try {
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val text = runCatching {
                (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.use { it.readBytes().toString(Charsets.UTF_8) }
            }.getOrNull().orEmpty()
            HttpResponse(code, text)
        } finally {
            conn.disconnect()
        }
    }

    private fun loadQueue() {
        if (!queueFile.exists()) return
        synchronized(QUEUE_FILE_LOCK) {
            queueFile.forEachLine { line ->
                if (pending.size >= MAX_QUEUE_EVENTS) return@forEachLine
                runCatching { JSONObject(line) }.getOrNull()?.let { pending += it }
            }
        }
    }

    /** Chamado somente dentro de [QUEUE_FILE_LOCK]. */
    private fun trimQueueLocked() {
        while (pending.size > MAX_QUEUE_EVENTS ||
            pending.sumOf { it.toString().length + 1 } > MAX_QUEUE_BYTES
        ) {
            pending.removeAt(0)
        }
    }

    /** Chamado somente dentro de [QUEUE_FILE_LOCK] para serializar snapshot e escrita atômica. */
    private fun rewriteQueueLocked() {
        queueFile.parentFile?.mkdirs()
        val temp = File(queueFile.parentFile, "${queueFile.name}.${UUID.randomUUID()}.tmp")
        try {
            temp.bufferedWriter().use { out ->
                pending.forEach {
                    out.write(it.toString())
                    out.newLine()
                }
            }
            if (!temp.renameTo(queueFile)) {
                temp.copyTo(queueFile, overwrite = true)
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    companion object {
        /** Compartilhado por todas as instâncias do cliente no processo. */
        private val QUEUE_FILE_LOCK = Any()
        const val MAX_BATCH = 50
        const val MAX_QUEUE_EVENTS = 5_000
        const val MAX_QUEUE_BYTES = 5 * 1024 * 1024
        private const val FLUSH_INTERVAL_MS = 3_000L
        private const val MAX_RETRY_MS = 5 * 60_000L
        private const val KEY_SYNC_EVENTS_UNSUPPORTED_UNTIL_MS =
            "sync_events_unsupported_until_ms_v2"
        private const val KEY_BATCH_EVENTS_UNSUPPORTED_UNTIL_MS =
            "batch_events_unsupported_until_ms_v2"
        private const val CAPABILITY_REPROBE_INTERVAL_MS = 15L * 60L * 1000L

        fun parseAck(body: String): Ack {
            val root = runCatching { JSONObject(body) }.getOrElse { JSONObject() }
            val container = root.optJSONObject("data") ?: root
            val payload = container.optJSONObject("eventAck")
                ?: container.optJSONObject("event_ack")
                ?: container
            fun ids(key: String): Set<String> {
                val value = payload.opt(key)
                val array = value as? JSONArray ?: return emptySet()
                return buildSet {
                    for (i in 0 until array.length()) {
                        val item = array.opt(i)
                        when (item) {
                            is JSONObject -> item.optString("eventId").takeIf(String::isNotBlank)?.let(::add)
                            null -> Unit
                            else -> item.toString().takeIf(String::isNotBlank)?.let(::add)
                        }
                    }
                }
            }
            val highest = payload.optLong("highestSequence", -1L).takeIf { it >= 0L }
            return Ack(
                highestSequence = highest,
                acknowledgedIds = ids("accepted") + ids("duplicates"),
                rejectedIds = ids("rejected"),
            )
        }

        fun isoNow(epochMs: Long = System.currentTimeMillis()): String {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            format.timeZone = TimeZone.getTimeZone("UTC")
            return format.format(Date(epochMs))
        }

        private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")
    }
}

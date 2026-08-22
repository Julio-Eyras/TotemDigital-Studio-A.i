package br.com.smartchannel.playeradmon.model

import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max
import kotlin.math.min

data class TotemPlaybackState(
    val totemId: Int? = null,
    val mediaId: String? = null,
    val mediaName: String,
    val mediaType: String? = null,
    val durationMs: Double = 0.0,
    val startedAt: String? = null,
    val expectedEndAt: String? = null,
    val endedAt: String? = null,
    val playedDurationMs: Double? = null,
    val status: String = "empty",
    val stale: Boolean = false,
    val receivedAtMs: Long = System.currentTimeMillis(),
    val nextMediaName: String? = null,
    val nextMediaType: String? = null,
    val nextMediaDurationMs: Double? = null,
) {
    val isEmpty: Boolean get() = mediaName.isEmpty() && status == "empty"

    fun elapsedMs(nowMs: Long = System.currentTimeMillis()): Double {
        val start = Iso8601.parseMillis(startedAt) ?: return 0.0
        val elapsed = (nowMs - start).toDouble()
        return min(max(0.0, elapsed), max(0.0, durationMs))
    }

    fun progressFraction(nowMs: Long = System.currentTimeMillis()): Float {
        if (durationMs <= 0) return 0f
        return min(1.0, max(0.0, elapsedMs(nowMs) / durationMs)).toFloat()
    }
}

object PlaybackNormalize {
    private const val STALE_GRACE_MS = 15_000.0

    fun normalize(payload: Any?, fallbackTotemId: Int? = null, nowMs: Long = System.currentTimeMillis()): TotemPlaybackState? {
        val outer = asMap(payload)
        val wrapped = asMap(outer["playbackState"] ?: outer["playback_state"])
        val data = when {
            wrapped.isNotEmpty() -> wrapped
            else -> asMap(outer["data"])
        }
        val runtime = asMap(data["runtime"] ?: outer["runtime"])
        val media = asMap(data["media"] ?: outer["media"])
        val playback = asMap(data["playback"] ?: outer["playback"])
        val context = asMap(data["context"] ?: outer["context"])
        val nowPlaying = asMap(
            data["nowPlaying"] ?: data["now_playing"] ?: outer["nowPlaying"] ?: outer["now_playing"]
        )
        val source = when {
            nowPlaying.isNotEmpty() -> nowPlaying
            data.isNotEmpty() -> data
            else -> outer
        }

        val displayIdle = bool(outer["displayIdle"]) || bool(outer["display_idle"]) ||
            bool(data["displayIdle"]) || bool(data["display_idle"])

        if (displayIdle) {
            return TotemPlaybackState(
                totemId = positiveInt(outer["totemId"], outer["totem_id"], data["totemId"], data["totem_id"], fallbackTotemId),
                mediaName = "Tela desligada por agenda",
                status = "display_off",
                receivedAtMs = nowMs,
            )
        }

        val explicitDisplayIdleFalse =
            (outer["displayIdle"] as? Boolean) == false ||
                (outer["display_idle"] as? Boolean) == false ||
                (data["displayIdle"] as? Boolean) == false ||
                (data["display_idle"] as? Boolean) == false

        val mediaName = string(
            source["mediaName"], source["media_name"], source["name"], media["name"]
        ).trim()

        if (mediaName.isEmpty() && explicitDisplayIdleFalse) {
            return TotemPlaybackState(
                totemId = positiveInt(outer["totemId"], outer["totem_id"], data["totemId"], data["totem_id"], fallbackTotemId),
                mediaName = "Tela ligada · aguardando mídia",
                status = "idle",
                receivedAtMs = nowMs,
            )
        }
        if (mediaName.isEmpty()) return null

        val startedAt = iso(
            source["startedAt"], source["started_at"],
            playback["startedAt"], playback["started_at"],
            runtime["startedAt"], runtime["started_at"]
        )
        val durationMsRaw = positiveDouble(
            source["durationMs"], source["duration_ms"],
            media["durationMs"], media["duration_ms"],
            runtime["durationMs"], runtime["duration_ms"]
        )
        val duration = when {
            durationMsRaw != null -> durationMsRaw
            else -> {
                val seconds = positiveDouble(
                    source["durationSeconds"], source["duration_seconds"], source["duration"]
                )
                if (seconds != null) seconds * 1000 else 0.0
            }
        }
        var expectedEndAt = iso(
            source["expectedEndAt"], source["expected_end_at"],
            playback["expectedEndAt"], playback["expected_end_at"],
            runtime["expectedEndAt"], runtime["expected_end_at"]
        )
        if (expectedEndAt == null && startedAt != null && duration > 0) {
            val start = Iso8601.parseMillis(startedAt)
            if (start != null) {
                expectedEndAt = Iso8601.format(start + duration.toLong())
            }
        }

        val nextSource = asMap(
            context["nextMedia"] ?: context["next_media"]
                ?: source["nextMedia"] ?: source["next_media"]
                ?: data["nextMedia"] ?: data["next_media"]
                ?: outer["nextMedia"] ?: outer["next_media"]
        )
        val nextName = string(nextSource["name"], nextSource["mediaName"], nextSource["media_name"]).trim()
        var nextDuration = positiveDouble(nextSource["durationMs"], nextSource["duration_ms"])
        if (nextDuration == null) {
            val seconds = positiveDouble(nextSource["durationSeconds"], nextSource["duration_seconds"], nextSource["duration"])
            if (seconds != null) nextDuration = seconds * 1000
        }

        val flaggedStale = bool(source["stale"]) || bool(playback["stale"]) || bool(runtime["stale"]) ||
            bool(data["stale"]) || bool(outer["stale"])
        val pastEnd = isPastExpectedEnd(startedAt, expectedEndAt, duration, nowMs)

        return TotemPlaybackState(
            totemId = positiveInt(
                data["totemId"], data["totem_id"],
                outer["totemId"], outer["totem_id"],
                source["totemId"], source["totem_id"],
                fallbackTotemId
            ),
            mediaId = mediaIdString(source["mediaId"], source["media_id"], source["id"], media["id"]),
            mediaName = mediaName,
            mediaType = nonEmpty(string(source["mediaType"], source["media_type"], source["type"], media["type"])),
            durationMs = duration,
            startedAt = startedAt,
            expectedEndAt = expectedEndAt,
            endedAt = iso(source["endedAt"], source["ended_at"], playback["endedAt"], playback["ended_at"]),
            playedDurationMs = positiveDouble(
                source["playedDurationMs"], source["played_duration_ms"],
                playback["playedDurationMs"], playback["played_duration_ms"]
            ),
            status = nonEmpty(string(source["status"], playback["status"], runtime["status"], data["status"], outer["status"]))
                ?: "playing",
            stale = flaggedStale || pastEnd,
            receivedAtMs = nowMs,
            nextMediaName = nextName.ifEmpty { null },
            nextMediaType = nonEmpty(string(nextSource["type"], nextSource["mediaType"], nextSource["media_type"])),
            nextMediaDurationMs = nextDuration,
        )
    }

    private fun isPastExpectedEnd(startedAt: String?, expectedEndAt: String?, durationMs: Double, nowMs: Long): Boolean {
        expectedEndAt?.let { end ->
            Iso8601.parseMillis(end)?.let { endMs ->
                if (nowMs > endMs + STALE_GRACE_MS) return true
            }
        }
        if (startedAt != null && durationMs > 0) {
            Iso8601.parseMillis(startedAt)?.let { startMs ->
                if (nowMs > startMs + durationMs + STALE_GRACE_MS) return true
            }
        }
        return false
    }

    fun asMap(value: Any?): Map<String, Any?> {
        return when (value) {
            is JSONObject -> {
                val out = mutableMapOf<String, Any?>()
                val keys = value.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    out[k] = unwrap(value.opt(k))
                }
                out
            }
            is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to unwrap(v) }
            else -> emptyMap()
        }
    }

    private fun unwrap(value: Any?): Any? = when (value) {
        JSONObject.NULL, null -> null
        is JSONObject -> asMap(value)
        is JSONArray -> (0 until value.length()).map { unwrap(value.opt(it)) }
        else -> value
    }

    private fun bool(value: Any?): Boolean = when (value) {
        is Boolean -> value
        is Number -> value.toInt() != 0
        is String -> value.lowercase() in setOf("1", "true", "yes")
        else -> false
    }

    private fun string(vararg values: Any?): String {
        for (value in values) {
            when (value) {
                is String -> return value
                is Number -> return value.toString()
            }
        }
        return ""
    }

    private fun nonEmpty(value: String?): String? {
        val t = value?.trim().orEmpty()
        return t.ifEmpty { null }
    }

    private fun positiveInt(vararg values: Any?): Int? {
        for (value in values) {
            when (value) {
                is Int -> if (value >= 0) return value
                is Long -> if (value >= 0) return value.toInt()
                is Double -> if (value >= 0) return value.toInt()
                is Number -> if (value.toDouble() >= 0) return value.toInt()
                is String -> value.toIntOrNull()?.takeIf { it >= 0 }?.let { return it }
            }
        }
        return null
    }

    private fun positiveDouble(vararg values: Any?): Double? {
        for (value in values) {
            when (value) {
                is Double -> if (value >= 0 && value.isFinite()) return value
                is Float -> if (value >= 0 && value.isFinite()) return value.toDouble()
                is Int -> if (value >= 0) return value.toDouble()
                is Long -> if (value >= 0) return value.toDouble()
                is Number -> {
                    val d = value.toDouble()
                    if (d >= 0 && d.isFinite()) return d
                }
                is String -> value.toDoubleOrNull()?.takeIf { it >= 0 && it.isFinite() }?.let { return it }
            }
        }
        return null
    }

    private fun mediaIdString(vararg values: Any?): String? {
        for (value in values) {
            when (value) {
                is Int, is Long -> return value.toString()
                is Double -> if (value.isFinite()) return value.toInt().toString()
                is Number -> return value.toString()
                is String -> {
                    val t = value.trim()
                    if (t.isNotEmpty()) return t
                }
            }
        }
        return null
    }

    private fun iso(vararg values: Any?): String? {
        for (value in values) {
            if (value is String && Iso8601.parseMillis(value) != null) {
                return Iso8601.format(Iso8601.parseMillis(value)!!)
            }
        }
        return null
    }
}

object Iso8601 {
    private val formats = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.SSSX",
        "yyyy-MM-dd'T'HH:mm:ssX",
    ).map { pattern ->
        SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    }

    fun parseMillis(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        for (fmt in formats) {
            try {
                synchronized(fmt) {
                    fmt.parse(value)?.time?.let { return it }
                }
            } catch (_: Exception) {
            }
        }
        return null
    }

    fun format(epochMs: Long): String {
        val fmt = formats[0]
        synchronized(fmt) {
            return fmt.format(Date(epochMs))
        }
    }
}

object PlaybackFormatting {
    fun clock(milliseconds: Double): String {
        val total = max(0, (milliseconds / 1000).toInt())
        val m = total / 60
        val s = total % 60
        return "%02d:%02d".format(m, s)
    }

    fun timingLine(state: TotemPlaybackState, nowMs: Long = System.currentTimeMillis()): String =
        when (state.status) {
            "display_off" -> "Aguardando o próximo horário de funcionamento"
            "idle" -> "Aguardando o início da reprodução"
            "empty" -> "Sem estado de reprodução"
            "ended", "stopped" -> "reproduzido ${clock(state.playedDurationMs ?: state.durationMs)}"
            "error" -> "erro de reprodução"
            else -> "${clock(state.elapsedMs(nowMs))} / ${clock(state.durationMs)}"
        }

    fun statusLabel(state: TotemPlaybackState): String {
        if (state.stale) return "Stale (desatualizado)"
        return when (state.status.lowercase()) {
            "playing" -> "A reproduzir"
            "paused" -> "Em pausa"
            "buffering" -> "A carregar"
            "stopped", "ended" -> "Parado"
            "error" -> "Erro"
            "idle" -> "Idle"
            "display_off" -> "Ecrã desligado"
            "empty" -> "Vazio"
            else -> state.status
        }
    }
}

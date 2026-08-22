package br.com.smartchannel.playeradmon.data.totem

import br.com.smartchannel.playeradmon.data.network.ApiClient
import br.com.smartchannel.playeradmon.model.PlaybackNormalize
import br.com.smartchannel.playeradmon.model.Totem
import br.com.smartchannel.playeradmon.model.TotemPlaybackState
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

class TotemRepository(private val api: ApiClient) {

    suspend fun fetchTotems(page: Int = 1, limit: Int = 200, search: String? = null): List<Totem> {
        var path = "/api/totems?page=$page&limit=$limit&onlyActive=1"
        val q = search?.trim().orEmpty()
        if (q.isNotEmpty()) {
            path += "&search=${URLEncoder.encode(q, Charsets.UTF_8.name())}"
        }
        val raw = api.requestJson("GET", path, authorized = true)
        return parseTotemList(raw).filter { it.id > 0 }
    }

    suspend fun fetchTotem(id: Int): Totem {
        val raw = api.requestJson("GET", "/api/totems/$id", authorized = true)
        val payload: Any = when (raw) {
            is JSONObject -> raw.opt("totem") ?: raw.opt("data") ?: raw
            else -> raw
        }
        return parseTotem(payload)
            ?: throw IllegalStateException("Totem $id inválido na resposta")
    }

    suspend fun fetchPlaybackState(totemId: Int): TotemPlaybackState? {
        val raw = api.requestJson("GET", "/api/totems/$totemId/playback-state", authorized = true)
        return PlaybackNormalize.normalize(raw, fallbackTotemId = totemId)
    }

    /** Lease de observação quente (MVP+). Falhas são ignoradas pelo caller. */
    suspend fun startTelemetryObservation(totemId: Int, ttlSeconds: Int = 90) {
        val body = JSONObject().put("ttlSeconds", ttlSeconds)
        api.requestJson(
            "POST",
            "/api/totems/$totemId/telemetry-observation/start",
            body,
            authorized = true,
        )
    }

    suspend fun renewTelemetryObservation(totemId: Int, ttlSeconds: Int = 90) {
        val body = JSONObject().put("ttlSeconds", ttlSeconds)
        api.requestJson(
            "PUT",
            "/api/totems/$totemId/telemetry-observation/renew",
            body,
            authorized = true,
        )
    }

    suspend fun stopTelemetryObservation(totemId: Int) {
        try {
            api.requestJson(
                method = "DELETE",
                path = "/api/totems/$totemId/telemetry-observation/stop",
                authorized = true,
                retryOnUnauthorized = false,
            )
        } catch (_: Exception) {
        }
    }

    private fun parseTotemList(raw: Any): List<Totem> {
        when (raw) {
            is JSONArray -> return (0 until raw.length()).mapNotNull { parseTotem(raw.opt(it)) }
            is JSONObject -> {
                val nested = raw.opt("data") ?: raw.opt("totems")
                when (nested) {
                    is JSONArray -> return (0 until nested.length()).mapNotNull { parseTotem(nested.opt(it)) }
                    is List<*> -> return nested.mapNotNull { parseTotem(it) }
                }
                parseTotem(raw)?.let { return listOf(it) }
            }
        }
        return emptyList()
    }

    private fun parseTotem(value: Any?): Totem? {
        val obj = when (value) {
            is JSONObject -> value
            is Map<*, *> -> JSONObject(value)
            else -> return null
        }
        val id = when {
            obj.has("totem_id") && !obj.isNull("totem_id") -> obj.optInt("totem_id")
            obj.has("id") && !obj.isNull("id") -> obj.optInt("id")
            else -> 0
        }
        if (id <= 0) return null
        val name = obj.optString("name").takeIf { it.isNotBlank() }
            ?: obj.optString("identifier").takeIf { it.isNotBlank() }
            ?: "Totem #$id"
        val activeFlag = when {
            obj.has("is_active") -> obj.optBoolean("is_active", true)
            obj.has("isActive") -> obj.optBoolean("isActive", true)
            obj.has("active") -> obj.optBoolean("active", true)
            else -> true
        }
        return Totem(
            id = id,
            name = name,
            status = obj.optString("status", "offline"),
            lastHeartbeat = obj.optStringOrNull("last_heartbeat")
                ?: obj.optStringOrNull("lastHeartbeat"),
            localName = obj.optStringOrNull("local_name")
                ?: obj.optStringOrNull("localName")
                ?: obj.optStringOrNull("location"),
            identifier = obj.optStringOrNull("identifier"),
            uin = obj.optStringOrNull("uin"),
            currentPlaylistId = obj.optIntOrNull("current_playlist_id")
                ?: obj.optIntOrNull("currentPlaylistId"),
            mediaCount = obj.optIntOrNull("media_count")
                ?: obj.optIntOrNull("mediaCount"),
            isActive = activeFlag,
        )
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() }
    }

    private fun JSONObject.optIntOrNull(key: String): Int? {
        if (!has(key) || isNull(key)) return null
        return optInt(key)
    }
}

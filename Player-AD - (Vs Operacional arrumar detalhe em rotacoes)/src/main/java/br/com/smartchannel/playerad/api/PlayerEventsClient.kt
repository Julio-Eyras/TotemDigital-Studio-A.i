package br.com.smartchannel.playerad.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Cliente para enviar eventos de playback do Player-AD,
 * reutilizando o contrato do player-web:
 *
 * POST /api/player/event?uin=...&token=...
 *
 * Em 401, tenta [DispatcherApiClient.heartbeat] e, se ainda falhar, [DispatcherApiClient.getToken],
 * repetindo o POST uma vez após cada renovação.
 * Devolve o token a usar nos envios seguintes.
 */
class PlayerEventsClient(
    private val baseUrl: String,
    private val uin: String,
    private val deviceId: String,
    private val dispatcher: DispatcherApiClient
) {

    private fun encode(v: String): String = URLEncoder.encode(v, "UTF-8")

    private fun metadataJson(metadata: Map<String, Any?>): JSONObject {
        val o = JSONObject()
        for ((k, v) in metadata) {
            if (v == null) continue
            when (v) {
                is String -> o.put(k, v)
                is Int -> o.put(k, v)
                is Long -> o.put(k, v)
                is Boolean -> o.put(k, v)
                is Double -> o.put(k, v)
                is Float -> o.put(k, v.toDouble())
                else -> o.put(k, v.toString())
            }
        }
        if (deviceId.isNotBlank() && !o.has("deviceId")) {
            o.put("deviceId", deviceId)
        }
        if (!o.has("player")) {
            o.put("player", "Player-AD")
        }
        return o
    }

    suspend fun sendEvent(
        token: String,
        eventType: String,
        mediaId: Long?,
        playlistId: Long?,
        campaignId: Long?,
        durationSeconds: Long?,
        completed: Boolean?,
        metadata: Map<String, Any?>
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("eventType", eventType)
            if (mediaId != null && mediaId > 0) put("mediaId", mediaId)
            if (playlistId != null && playlistId > 0) put("playlistId", playlistId)
            if (campaignId != null && campaignId > 0) put("campaignId", campaignId)
            if (durationSeconds != null) put("duration", durationSeconds.toInt())
            if (completed != null) put("completed", completed)
            put("metadata", metadataJson(metadata))
        }.toString()

        fun postOnce(tkn: String): Int {
            val deviceQs = if (deviceId.isNotBlank()) "&deviceId=${encode(deviceId)}" else ""
            val url = URL(
                "$baseUrl/api/player/event?uin=${encode(uin)}&token=${encode(tkn)}$deviceQs"
            )
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Content-Type", "application/json")
            }
            return try {
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(body)
                }
                val code = conn.responseCode
                (if (code in 200..299) conn.inputStream else conn.errorStream)?.use {
                    it.readBytes()
                }
                code
            } catch (_: Exception) {
                -1
            } finally {
                conn.disconnect()
            }
        }

        var tkn = token
        var code = postOnce(tkn)
        if (code == 401) {
            try {
                tkn = dispatcher.heartbeat()
                code = postOnce(tkn)
            } catch (_: Exception) {
                // mantém tkn
            }
        }
        if (code == 401) {
            try {
                tkn = dispatcher.getToken()
                postOnce(tkn)
            } catch (_: Exception) {
                // Telemetria não derruba o player
            }
        }
        tkn
    }
}

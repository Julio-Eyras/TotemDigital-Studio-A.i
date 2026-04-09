package br.com.smartchannel.smartsignagead.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class PlayerEventsClient(
    private val baseUrl: String,
    private val uin: String,
    private val deviceId: String,
    private val dispatcher: DispatcherApiClient
) {
    private fun encode(v: String): String = URLEncoder.encode(v, "UTF-8")

    private fun metadataJson(metadata: Map<String, Any?>): JSONObject {
        val out = JSONObject()
        for ((k, v) in metadata) {
            if (v == null) continue
            out.put(k, v)
        }
        if (!out.has("player")) out.put("player", "SmartSignage-AD")
        if (!out.has("deviceId")) out.put("deviceId", deviceId)
        return out
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
            val url = URL("${baseUrl.trimEnd('/')}/api/player/event?uin=${encode(uin)}&token=${encode(tkn)}&deviceId=${encode(deviceId)}")
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
                (if (code in 200..299) conn.inputStream else conn.errorStream)?.use { it.readBytes() }
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
            } catch (_: Exception) { }
        }
        if (code == 401) {
            try {
                tkn = dispatcher.getToken()
                postOnce(tkn)
            } catch (_: Exception) { }
        }
        tkn
    }
}

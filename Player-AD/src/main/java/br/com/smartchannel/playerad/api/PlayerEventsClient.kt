package br.com.smartchannel.playerad.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cliente para enviar eventos de playback do Player-AD,
 * reutilizando o contrato do player-web:
 *
 * POST /api/player/event?uin=...&token=...
 */
class PlayerEventsClient(
    private val baseUrl: String,
    private val uin: String,
    private val deviceId: String
) {

    suspend fun sendEvent(
        token: String,
        eventType: String,
        mediaId: Long?,
        playlistId: Long?,
        campaignId: Long?,
        durationSeconds: Long?,
        completed: Boolean?,
        metadata: Map<String, Any?>
    ) = withContext(Dispatchers.IO) {
        val url = URL("$baseUrl/api/player/event?uin=$uin&token=$token")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }

        val body = JSONObject().apply {
            put("eventType", eventType)
            if (mediaId != null && mediaId > 0) put("mediaId", mediaId)
            if (playlistId != null && playlistId > 0) put("playlistId", playlistId)
            if (campaignId != null && campaignId > 0) put("campaignId", campaignId)
            if (durationSeconds != null) put("duration", durationSeconds.toInt())
            if (completed != null) put("completed", completed)
            put("metadata", JSONObject(metadata.filterValues { it != null }))
        }.toString()

        try {
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(body)
            }

            // Ler resposta apenas para consumir o stream; ignoramos o conteúdo
            conn.inputStream.use { it.readBytes() }
        } catch (_: Exception) {
            // Erros de telemetria não devem derrubar o player
        } finally {
            conn.disconnect()
        }
    }
}


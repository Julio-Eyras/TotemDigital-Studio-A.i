package com.smartsignage.player.hls

import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * HeartbeatService - Envia status periódico para o backend (Dispatcher)
 */
class HeartbeatService(
    private val apiUrl: String,
    private val tvId: String,
    private val interval: Long = 30000,
    private var deviceId: String? = null
) {
    private var heartbeatJob: Job? = null
    private var token: String? = null
    private val startTime = System.currentTimeMillis()

    var getPlayerStatus: (() -> String)? = null
    var getCurrentStream: (() -> String?)? = null

    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val TAG = "Heartbeat"
    }

    fun setToken(token: String?) {
        this.token = token
    }

    fun setDeviceId(id: String?) {
        this.deviceId = id
    }

    fun setCallbacks(
        getPlayerStatus: () -> String,
        getCurrentStream: () -> String?
    ) {
        this.getPlayerStatus = getPlayerStatus
        this.getCurrentStream = getCurrentStream
    }

    private fun apiBaseNormalized(): String {
        val b = apiUrl.trimEnd('/')
        return if (b.endsWith("/api")) b else "$b/api"
    }

    private fun isoTimestampUtc(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    fun start() {
        if (heartbeatJob?.isActive == true) {
            Log.w(TAG, "Service já está ativo")
            return
        }

        Log.d(TAG, "Iniciando service (intervalo: ${interval}ms)")

        heartbeatJob = scope.launch {
            while (isActive) {
                sendHeartbeat()
                delay(interval)
            }
        }
    }

    fun stop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        Log.d(TAG, "Service parado")
    }

    private suspend fun sendHeartbeat() = withContext(Dispatchers.IO) {
        try {
            val uptime = (System.currentTimeMillis() - startTime) / 1000
            val rawStatus = getPlayerStatus?.invoke()
            val statusStr = rawStatus?.takeIf { it.isNotBlank() } ?: "online"
            val currentStream = getCurrentStream?.invoke()

            val metrics = JSONObject().apply {
                put("uptime", uptime)
                put("current_stream", currentStream ?: JSONObject.NULL)
                put("timestamp", isoTimestampUtc())
            }

            val body = JSONObject().apply {
                put("status", statusStr)
                put("metrics", metrics)
                put("executedCommands", JSONArray())
            }

            val base = apiBaseNormalized()
            val uinEnc = URLEncoder.encode(tvId, "UTF-8")
            val sb = StringBuilder("$base/player/heartbeat?uin=$uinEnc")
            val t = token
            if (t != null) {
                sb.append("&token=").append(URLEncoder.encode(t, "UTF-8"))
            } else {
                Log.w(TAG, "Sem token; o servidor pode rejeitar o heartbeat")
            }
            deviceId?.let { sb.append("&deviceId=").append(URLEncoder.encode(it, "UTF-8")) }

            val requestBody = RequestBody.create(
                "application/json; charset=utf-8".toMediaType(),
                body.toString()
            )

            val request = Request.Builder()
                .url(sb.toString())
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}: ${response.message}")
            }

            val result = response.body?.string()
            if (result != null) {
                val json = JSONObject(result)
                if (json.has("token")) {
                    token = json.getString("token")
                }
            }

            Log.d(TAG, "Enviado com sucesso: status=$statusStr, uptime=$uptime")
        } catch (error: Exception) {
            Log.w(TAG, "Erro ao enviar heartbeat", error)
        }
    }
}

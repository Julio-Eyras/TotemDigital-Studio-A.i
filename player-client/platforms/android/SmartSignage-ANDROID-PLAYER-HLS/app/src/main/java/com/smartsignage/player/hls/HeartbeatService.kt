package com.smartsignage.player.hls

import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder

/**
 * HeartbeatService - Envia status periódico para o backend
 */
class HeartbeatService(
    private val apiUrl: String,
    private val tvId: String,
    private val interval: Long = 30000
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

    /**
     * Define token de autenticação
     */
    fun setToken(token: String?) {
        this.token = token
    }

    /**
     * Define callbacks para obter informações do player
     */
    fun setCallbacks(
        getPlayerStatus: () -> String,
        getCurrentStream: () -> String?
    ) {
        this.getPlayerStatus = getPlayerStatus
        this.getCurrentStream = getCurrentStream
    }

    /**
     * Inicia envio de heartbeats
     */
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

    /**
     * Para o serviço de heartbeat
     */
    fun stop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        Log.d(TAG, "Service parado")
    }

    /**
     * Envia heartbeat para o backend
     */
    private suspend fun sendHeartbeat() = withContext(Dispatchers.IO) {
        try {
            val uptime = (System.currentTimeMillis() - startTime) / 1000
            val status = getPlayerStatus?.invoke() ?: "UNKNOWN"
            val currentStream = getCurrentStream?.invoke()

            val data = JSONObject().apply {
                put("status", status)
                put("uptime", uptime)
                put("current_stream", currentStream)
                put("timestamp", java.util.Date().toString())
            }

            var url = "$apiUrl/player/heartbeat?uin=$tvId"
            if (token != null) {
                url += "&token=${URLEncoder.encode(token, "UTF-8")}"
            }

            val requestBody = RequestBody.create(
                "application/json; charset=utf-8".toMediaType(),
                data.toString()
            )

            val request = Request.Builder()
                .url(url)
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

            Log.d(TAG, "Enviado com sucesso: status=$status, uptime=$uptime")
        } catch (error: Exception) {
            Log.w(TAG, "Erro ao enviar heartbeat", error)
        }
    }
}


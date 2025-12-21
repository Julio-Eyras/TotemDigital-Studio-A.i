package com.smartsignage.player.hls

import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

/**
 * CommandFetcher - Busca comandos do backend via HTTP polling
 */
class CommandFetcher(
    private val apiUrl: String,
    private val tvId: String,
    private val interval: Long = 15000
) {
    private var pollingJob: Job? = null
    private var token: String? = null
    var onCommand: ((Command) -> Unit)? = null
    
    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    companion object {
        private const val TAG = "CommandFetcher"
    }

    /**
     * Define token de autenticação
     */
    fun setToken(token: String?) {
        this.token = token
    }

    /**
     * Inicia polling de comandos
     */
    fun start() {
        if (pollingJob?.isActive == true) {
            Log.w(TAG, "Polling já está ativo")
            return
        }

        Log.d(TAG, "Iniciando polling (intervalo: ${interval}ms)")

        pollingJob = scope.launch {
            while (isActive) {
                fetchCommand()
                delay(interval)
            }
        }
    }

    /**
     * Para o polling
     */
    fun stop() {
        pollingJob?.cancel()
        pollingJob = null
        Log.d(TAG, "Polling parado")
    }

    /**
     * Busca comandos do backend
     */
    private suspend fun fetchCommand() = withContext(Dispatchers.IO) {
        try {
            val url = "$apiUrl/tv/$tvId/command"
            val requestBuilder = Request.Builder().url(url)
            
            if (token != null) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }

            val response = client.newCall(requestBuilder.build()).execute()

            if (!response.isSuccessful) {
                if (response.code == 404) {
                    // Nenhum comando disponível - normal
                    return@withContext
                }
                throw IOException("HTTP ${response.code}: ${response.message}")
            }

            val body = response.body?.string()
            if (body != null) {
                val json = JSONObject(body)
                if (json.has("action")) {
                    val command = Command(
                        action = json.getString("action"),
                        stream = json.optString("stream", null),
                        volume = json.optDouble("volume", Double.NaN).takeIf { !it.isNaN() }?.toFloat()
                    )
                    Log.d(TAG, "Comando recebido: ${command.action}")
                    onCommand?.invoke(command)
                }
            }
        } catch (error: Exception) {
            Log.w(TAG, "Erro ao buscar comando", error)
        }
    }
}


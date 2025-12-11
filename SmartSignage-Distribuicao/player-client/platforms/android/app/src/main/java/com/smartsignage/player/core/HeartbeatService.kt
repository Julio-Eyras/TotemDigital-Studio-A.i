package com.smartsignage.player.core

import android.util.Log
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.models.HeartbeatData
import kotlinx.coroutines.*
import java.util.*

/**
 * Heartbeat Service - Android
 * Sistema de heartbeat para comunicação com o backend
 */
class HeartbeatService(
    private val apiClient: APIClient,
    private val interval: Long = 30000 // 30 segundos padrão
) {
    private var job: Job? = null
    private var lastHeartbeat: Date? = null
    private var consecutiveFailures = 0
    private val maxFailures = 5

    companion object {
        private const val TAG = "HeartbeatService"
    }

    /**
     * Inicia serviço de heartbeat
     */
    fun start(scope: CoroutineScope) {
        if (job?.isActive == true) {
            return
        }

        job = scope.launch {
            sendHeartbeat() // Enviar imediatamente
            while (isActive) {
                delay(interval)
                sendHeartbeat()
            }
        }
    }

    /**
     * Para serviço de heartbeat
     */
    fun stop() {
        job?.cancel()
        job = null
    }

    /**
     * Envia heartbeat
     */
    private suspend fun sendHeartbeat() {
        try {
            val data = HeartbeatData(
                status = "online",
                timestamp = Date().toISOString(),
                metrics = getSystemMetrics()
            )

            val success = apiClient.sendHeartbeat(data)
            if (success) {
                lastHeartbeat = Date()
                consecutiveFailures = 0
            } else {
                consecutiveFailures++
                if (consecutiveFailures >= maxFailures) {
                    Log.e(TAG, "Max heartbeat failures reached")
                    stop()
                    onCriticalFailure()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Heartbeat error", e)
            consecutiveFailures++
            if (consecutiveFailures >= maxFailures) {
                stop()
                onCriticalFailure()
            }
        }
    }

    /**
     * Obtém métricas do sistema
     */
    private fun getSystemMetrics(): Map<String, Any> {
        val runtime = Runtime.getRuntime()
        return mapOf(
            "uptime" to (System.currentTimeMillis() / 1000),
            "memory" to mapOf(
                "total" to runtime.totalMemory(),
                "free" to runtime.freeMemory(),
                "used" to (runtime.totalMemory() - runtime.freeMemory())
            )
        )
    }

    /**
     * Callback para falha crítica
     */
    private fun onCriticalFailure() {
        Log.e(TAG, "Critical heartbeat failure")
        // Implementar lógica de recuperação ou notificação
    }

    /**
     * Verifica se está conectado
     */
    fun isConnected(): Boolean {
        val last = lastHeartbeat ?: return false
        val now = Date()
        val diff = now.time - last.time
        return diff < interval * 2 // Considera desconectado se passou 2x o intervalo
    }
}

// Extensão para Date
private fun Date.toISOString(): String {
    val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(this)
}


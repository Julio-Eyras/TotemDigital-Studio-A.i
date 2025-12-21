package com.smartsignage.player.hls

import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import java.io.IOException

/**
 * FallbackManager - Gerencia fallback offline quando stream principal falha
 */
class FallbackManager(
    private val primaryStream: String,
    private val fallbackUrls: List<String>
) {
    private var fallbackActive = false
    private var retryCount = 0
    private val maxRetries = 3
    private var currentFallbackIndex = 0
    private var player: HLSPlayer? = null
    private var retryJob: Job? = null
    
    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    companion object {
        private const val TAG = "Fallback"
    }

    /**
     * Define referência ao player
     */
    fun setPlayer(player: HLSPlayer) {
        this.player = player
    }

    /**
     * Handler de erro - chamado quando stream principal falha
     */
    suspend fun handleError() = withContext(Dispatchers.Main) {
        retryCount++

        Log.d(TAG, "Erro no stream principal (tentativa $retryCount/$maxRetries)")

        if (retryCount <= maxRetries) {
            delay(3000)
            try {
                Log.d(TAG, "Tentando reconectar ao stream principal...")
                player?.play(primaryStream)
                retryCount = 0
            } catch (error: Exception) {
                Log.w(TAG, "Falha ao reconectar", error)
                if (retryCount >= maxRetries) {
                    activateFallback()
                }
            }
        } else {
            activateFallback()
        }
    }

    /**
     * Ativa fallback
     */
    private suspend fun activateFallback() = withContext(Dispatchers.Main) {
        if (fallbackActive) {
            Log.d(TAG, "Fallback já está ativo")
            return@withContext
        }

        if (fallbackUrls.isEmpty()) {
            Log.w(TAG, "Nenhuma URL de fallback configurada")
            return@withContext
        }

        Log.d(TAG, "Ativando fallback offline")
        fallbackActive = true
        tryNextFallback()
    }

    /**
     * Tenta próximo fallback disponível
     */
    private suspend fun tryNextFallback() = withContext(Dispatchers.Main) {
        if (currentFallbackIndex >= fallbackUrls.size) {
            Log.e(TAG, "Todos os fallbacks falharam")
            currentFallbackIndex = 0
            return@withContext
        }

        val fallbackUrl = fallbackUrls[currentFallbackIndex]
        Log.d(TAG, "Tentando fallback ${currentFallbackIndex + 1}/${fallbackUrls.size}: $fallbackUrl")

        try {
            player?.play(fallbackUrl)
            Log.d(TAG, "Fallback ativado com sucesso")
            startPrimaryStreamRetry()
        } catch (error: Exception) {
            Log.w(TAG, "Falha ao ativar fallback $fallbackUrl", error)
            currentFallbackIndex++
            delay(5000)
            tryNextFallback()
        }
    }

    /**
     * Inicia tentativas periódicas de retornar ao stream principal
     */
    private fun startPrimaryStreamRetry() {
        retryJob?.cancel()
        retryJob = scope.launch {
            while (isActive) {
                delay(60000) // 60 segundos
                tryPrimaryStream()
            }
        }
    }

    /**
     * Tenta retornar ao stream principal
     */
    private suspend fun tryPrimaryStream() = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Testando se stream principal voltou...")

            val request = Request.Builder()
                .url(primaryStream)
                .head()
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                Log.d(TAG, "Stream principal recuperado! Retornando...")
                fallbackActive = false
                retryCount = 0
                currentFallbackIndex = 0
                retryJob?.cancel()

                withContext(Dispatchers.Main) {
                    player?.play(primaryStream)
                }
            }
        } catch (error: Exception) {
            Log.d(TAG, "Stream principal ainda indisponível")
        }
    }

    /**
     * Verifica se fallback está ativo
     */
    fun isActive(): Boolean {
        return fallbackActive
    }
}


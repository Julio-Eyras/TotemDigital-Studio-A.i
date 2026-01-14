package com.smartsignage.player.api

import android.util.Log
import com.google.gson.Gson
import com.smartsignage.player.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * API Client - Android
 * Cliente HTTP para comunicação com o backend
 */
class APIClient(
    private val baseURL: String,
    private val totemUIN: String,
    private val totemSecret: String
) {
    private val client = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    private val gson = Gson()
    private var token: String? = null
    private var refreshToken: String? = null

    companion object {
        private const val TAG = "APIClient"
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    /**
     * Gera token de autenticação do totem
     */
    private fun generateTotemToken(): String {
        val timestamp = System.currentTimeMillis()
        val data = "$totemUIN:$timestamp"
        
        val mac = Mac.getInstance("HmacSHA256")
        val secretKey = SecretKeySpec(totemSecret.toByteArray(), "HmacSHA256")
        mac.init(secretKey)
        val hash = mac.doFinal(data.toByteArray())
        val token = hash.joinToString("") { "%02x".format(it) }
        
        return "$timestamp:$token"
    }

    /**
     * Faz requisição HTTP com tratamento de erros melhorado
     */
    private suspend fun request(
        endpoint: String,
        method: String = "GET",
        body: Any? = null
    ): Response = withContext(Dispatchers.IO) {
        val url = "$baseURL$endpoint"
        val requestBuilder = Request.Builder().url(url)

        // Adicionar headers
        requestBuilder.addHeader("Content-Type", "application/json")

        // Adicionar token de autenticação do totem
        if (totemUIN.isNotEmpty() && totemSecret.isNotEmpty()) {
            requestBuilder.addHeader("X-Totem-Token", generateTotemToken())
            requestBuilder.addHeader("X-Totem-UIN", totemUIN)
        }

        // Adicionar JWT se disponível
        token?.let {
            requestBuilder.addHeader("Authorization", "Bearer $it")
        }

        // Adicionar body se necessário
        if (body != null && (method == "POST" || method == "PUT" || method == "PATCH")) {
            val jsonBody = gson.toJson(body).toRequestBody(JSON)
            when (method) {
                "POST" -> requestBuilder.post(jsonBody)
                "PUT" -> requestBuilder.put(jsonBody)
                "PATCH" -> requestBuilder.patch(jsonBody)
            }
        } else {
            when (method) {
                "GET" -> requestBuilder.get()
                "DELETE" -> requestBuilder.delete()
            }
        }

        val request = requestBuilder.build()
        val response = client.newCall(request).execute()
        
        // Tratamento específico para erros de validação
        if (!response.isSuccessful) {
            when (response.code) {
                403 -> {
                    Log.w(TAG, "Forbidden (403): Acesso negado - totem não acessível via contratos/planos")
                    // Logar erro de validação para debugging
                    logValidationError(endpoint, response.code, "FORBIDDEN")
                }
                400 -> {
                    Log.w(TAG, "Bad Request (400): Dados inválidos na requisição")
                    logValidationError(endpoint, response.code, "BAD_REQUEST")
                }
            }
        }
        
        response
    }
    
    /**
     * Loga erros de validação para debugging
     */
    private suspend fun logValidationError(endpoint: String, statusCode: Int, code: String) {
        try {
            val metadata = mapOf(
                "endpoint" to endpoint,
                "status" to statusCode,
                "code" to code,
                "timestamp" to System.currentTimeMillis(),
                "uin" to totemUIN
            )
            sendErrorLog("Validation error: $code", null, metadata)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send validation error log", e)
        }
    }

    /**
     * Autentica totem no backend
     */
    suspend fun authenticateTotem(): Boolean {
        return try {
            val response = request(
                "/api/player/register",
                "POST",
                mapOf("uin" to totemUIN)
            )

            if (response.isSuccessful) {
                val authResponse = gson.fromJson(
                    response.body?.string(),
                    AuthResponse::class.java
                )
                token = authResponse.token
                refreshToken = authResponse.refreshToken
                true
            } else {
                Log.e(TAG, "Authentication failed: ${response.code}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Authentication error", e)
            false
        }
    }

    /**
     * Obtém playlist do totem com validações de contrato
     */
    suspend fun getPlaylist(): PlaylistResponse? {
        return try {
            val response = request("/api/player/playlist")
            if (response.isSuccessful) {
                val playlist = gson.fromJson(response.body?.string(), PlaylistResponse::class.java)
                
                // Validar se playlist tem contrato válido (se aplicável)
                if (playlist != null) {
                    // Verificar se campanha tem contrato válido
                    // Nota: Isso depende de como o backend retorna a informação
                    // Se o backend incluir contract_valid na resposta, podemos validar aqui
                    // Por enquanto, o backend já filtra, então apenas logamos se necessário
                }
                
                playlist
            } else {
                // Tratamento específico para erros de validação
                when (response.code) {
                    403 -> {
                        Log.e(TAG, "Acesso negado: totem não acessível através de contratos/planos ativos")
                    }
                    400 -> {
                        Log.e(TAG, "Dados inválidos na requisição de playlist")
                    }
                }
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Get playlist error", e)
            null
        }
    }

    /**
     * Obtém configurações do player
     */
    suspend fun getConfig(): PlayerConfigResponse? {
        return try {
            val response = request("/api/player/config")
            if (response.isSuccessful) {
                gson.fromJson(response.body?.string(), PlayerConfigResponse::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Get config error", e)
            null
        }
    }

    /**
     * Envia heartbeat
     */
    suspend fun sendHeartbeat(data: HeartbeatData): Boolean {
        return try {
            val response = request("/api/player/heartbeat", "POST", data)
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Send heartbeat error", e)
            false
        }
    }

    /**
     * Baixa arquivo de mídia
     */
    suspend fun downloadMedia(mediaId: Int): Response {
        return try {
            val url = "$baseURL/api/media/$mediaId/download"
            val requestBuilder = Request.Builder().url(url)

            // Adicionar headers de autenticação
            requestBuilder.addHeader("Content-Type", "application/json")
            
            if (totemUIN.isNotEmpty() && totemSecret.isNotEmpty()) {
                requestBuilder.addHeader("X-Totem-Token", generateTotemToken())
                requestBuilder.addHeader("X-Totem-UIN", totemUIN)
            }

            token?.let {
                requestBuilder.addHeader("Authorization", "Bearer $it")
            }

            val request = requestBuilder.build()
            client.newCall(request).execute()
        } catch (e: Exception) {
            Log.e(TAG, "Download media error", e)
            throw e
        }
    }

    /**
     * Envia log de erro
     */
    suspend fun sendErrorLog(error: String, stack: String?, metadata: Map<String, Any>): Boolean {
        return try {
            val data = mapOf(
                "error" to error,
                "stack" to (stack ?: ""),
                "metadata" to (metadata + mapOf(
                    "platform" to "android",
                    "timestamp" to System.currentTimeMillis()
                ))
            )
            val response = request("/api/logs/frontend-error", "POST", data)
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Send error log error", e)
            false
        }
    }

    /**
     * NOVO FLUXO: Obtém token de dispositivo (/api/player/token)
     *
     * Este token será usado em todas as chamadas subsequentes (dispatch, heartbeat, etc.)
     */
    suspend fun getDeviceToken(
        uin: String,
        deviceId: String,
        platform: String,
        appVersion: String
    ): DeviceTokenResponse? {
        return try {
            val query = "?uin=${uin}&deviceId=${deviceId}&platform=${platform}&appVersion=${appVersion}"
            val response = request("/api/player/token$query")

            if (response.isSuccessful) {
                val bodyString = response.body?.string()
                val tokenResponse = gson.fromJson(bodyString, DeviceTokenResponse::class.java)
                tokenResponse?.let {
                    // Atualizar token interno para reutilização em outras chamadas
                    token = it.token
                }
                tokenResponse
            } else {
                Log.e(TAG, "getDeviceToken failed: ${response.code}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "getDeviceToken error", e)
            null
        }
    }

    /**
     * NOVO FLUXO: Obtém DispatchPlan diretamente do dispatcher (/api/player/dispatch)
     *
     * Substitui o uso de playlists diretas em cenários novos.
     */
    suspend fun getDispatchPlan(
        uin: String,
        deviceToken: String,
        deviceId: String? = null,
        timestampIso: String? = null,
        timezone: String? = null
    ): DispatchResponse? {
        return try {
            val params = mutableListOf(
                "uin=$uin",
                "token=$deviceToken"
            )

            deviceId?.let { params.add("deviceId=$it") }
            timestampIso?.let { params.add("timestamp=$it") }
            timezone?.let { params.add("timezone=$it") }

            val query = "?" + params.joinToString("&")
            val response = request("/api/player/dispatch$query")

            if (response.isSuccessful) {
                val bodyString = response.body?.string()
                gson.fromJson(bodyString, DispatchResponse::class.java)
            } else {
                Log.e(TAG, "getDispatchPlan failed: ${response.code}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "getDispatchPlan error", e)
            null
        }
    }
}


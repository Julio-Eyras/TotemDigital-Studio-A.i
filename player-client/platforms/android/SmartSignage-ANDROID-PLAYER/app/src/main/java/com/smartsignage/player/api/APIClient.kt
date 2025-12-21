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
     * Faz requisição HTTP
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
        client.newCall(request).execute()
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
     * Obtém playlist do totem
     */
    suspend fun getPlaylist(): PlaylistResponse? {
        return try {
            val response = request("/api/player/playlist")
            if (response.isSuccessful) {
                gson.fromJson(response.body?.string(), PlaylistResponse::class.java)
            } else {
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
}


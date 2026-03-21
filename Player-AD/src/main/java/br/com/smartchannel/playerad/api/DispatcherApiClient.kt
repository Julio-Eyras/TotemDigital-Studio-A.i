package br.com.smartchannel.playerad.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.IOException

/**
 * Cliente mínimo para integrar com o Dispatcher / API de player:
 * - POST /api/player/heartbeat
 * - GET  /api/player/dispatch
 *
 * Implementação simplificada (sem tratar todos erros HTTP),
 * serve como base para o Player-AD.
 */
class DispatcherApiClient(
    val baseUrl: String,
    val uin: String,
    val deviceId: String
 ) {
    private var currentToken: String? = null

    private fun openConnection(url: URL, method: String): HttpURLConnection {
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 8000
        }
    }

    private fun encode(v: String): String = java.net.URLEncoder.encode(v, "UTF-8")

    suspend fun getToken(): String = withContext(Dispatchers.IO) {
        val url = URL(
            "$baseUrl/api/player/token?uin=${encode(uin)}&deviceId=${encode(deviceId)}"
        )
        val conn = openConnection(url, "GET")

        val responseCode = try { conn.responseCode } catch (_: Exception) { -1 }
        val responseBody = try {
            conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (e: Exception) {
            val errBody = conn.errorStream?.use { it.readBytes().toString(Charsets.UTF_8) }
                ?: e.message
            throw IOException("HTTP token falhou: code=$responseCode body=$errBody", e)
        }

        if (responseCode !in 200..299) {
            throw IOException("HTTP token falhou: code=$responseCode body=$responseBody")
        }

        val json = JSONObject(responseBody)
        val token = json.optString("token", "")
        if (token.isBlank()) {
            throw IOException("Token vazio em /api/player/token: body=$responseBody")
        }
        currentToken = token
        token
    }

    suspend fun heartbeat(): String = withContext(Dispatchers.IO) {
        val token = currentToken ?: getToken()
        val url = URL(
            "$baseUrl/api/player/heartbeat?uin=${encode(uin)}&token=${encode(token)}&deviceId=${encode(deviceId)}"
        )
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }

        val body = JSONObject(
            mapOf(
                "uin" to uin,
                "deviceId" to deviceId
            )
        ).toString()

        conn.outputStream.use { it.write(body.toByteArray()) }

        val responseCode = try { conn.responseCode } catch (_: Exception) { -1 }
        val responseBody = try {
            conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (e: Exception) {
            val errBody = conn.errorStream?.use { it.readBytes().toString(Charsets.UTF_8) }
                ?: e.message
            throw IOException("HTTP heartbeat falhou: code=$responseCode body=$errBody", e)
        }

        if (responseCode !in 200..299) {
            throw IOException("HTTP heartbeat falhou: code=$responseCode body=$responseBody")
        }

        val json = JSONObject(responseBody)
        val newToken = json.optString("token", token)
        currentToken = newToken
        newToken
    }

    suspend fun getDispatchPlan(token: String): JSONObject = withContext(Dispatchers.IO) {
        val url = URL(
            "$baseUrl/api/player/dispatch?uin=${encode(uin)}&token=${encode(token)}"
        )
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
        }
        val responseCode = try { conn.responseCode } catch (_: Exception) { -1 }
        val responseBody = try {
            conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (e: Exception) {
            val errBody = conn.errorStream?.use { it.readBytes().toString(Charsets.UTF_8) }
                ?: e.message
            throw IOException("HTTP dispatch falhou: code=$responseCode body=$errBody", e)
        }

        if (responseCode !in 200..299) {
            throw IOException("HTTP dispatch falhou: code=$responseCode body=$responseBody")
        }

        JSONObject(responseBody)
    }

    /**
     * Resolve uma URL relativa vinda do DispatchPlan para absoluta.
     */
    fun resolveUrl(relativeOrAbsolute: String): String {
        if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
            return relativeOrAbsolute
        }
        val trimmedBase = baseUrl.trimEnd('/')
        val trimmedRel = if (relativeOrAbsolute.startsWith("/")) relativeOrAbsolute else "/$relativeOrAbsolute"
        return trimmedBase + trimmedRel
    }
}


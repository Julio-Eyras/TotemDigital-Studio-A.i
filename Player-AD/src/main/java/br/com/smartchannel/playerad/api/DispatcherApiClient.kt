package br.com.smartchannel.playerad.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.TimeZone

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
    data class PendingCommand(
        val id: String,
        val type: String,
        val data: JSONObject?
    )

    data class HeartbeatResult(
        val token: String,
        val pendingCommands: List<PendingCommand>
    )

    private var currentToken: String? = null

    /** Último token conhecido (atualizado por heartbeat, getToken ou retry em dispatch). */
    fun cachedToken(): String? = currentToken

    private fun openConnection(url: URL, method: String): HttpURLConnection {
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 8000
        }
    }

    private fun encode(v: String): String = java.net.URLEncoder.encode(v, "UTF-8")

    private fun performTokenGet(): Pair<Int, String> {
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
        return responseCode to responseBody
    }

    suspend fun getToken(): String = withContext(Dispatchers.IO) {
        var (responseCode, responseBody) = performTokenGet()
        if (responseCode == 401) {
            delay(400L)
            val second = performTokenGet()
            responseCode = second.first
            responseBody = second.second
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

    private fun performHeartbeatRequest(token: String): Pair<Int, String> {
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
        return responseCode to responseBody
    }

    suspend fun heartbeatWithCommands(): HeartbeatResult = withContext(Dispatchers.IO) {
        var tkn = currentToken ?: getToken()
        var (responseCode, responseBody) = performHeartbeatRequest(tkn)
        if (responseCode == 401) {
            currentToken = null
            tkn = getToken()
            currentToken = tkn
            val second = performHeartbeatRequest(tkn)
            responseCode = second.first
            responseBody = second.second
        }

        if (responseCode !in 200..299) {
            throw IOException("HTTP heartbeat falhou: code=$responseCode body=$responseBody")
        }

        val json = JSONObject(responseBody)
        val data = json.optJSONObject("data")
        val payload = data ?: json
        val newToken = payload.optString("token", tkn)
        currentToken = newToken
        val commandsArray =
            payload.optJSONArray("pendingCommands")
                ?: payload.optJSONArray("pending_commands")
        val pendingCommands = mutableListOf<PendingCommand>()
        if (commandsArray != null) {
            for (i in 0 until commandsArray.length()) {
                val obj = commandsArray.optJSONObject(i) ?: continue
                val id = obj.opt("id")?.toString() ?: continue
                val type = obj.optString("type", "").trim()
                if (type.isBlank()) continue
                val dataObj = obj.optJSONObject("data")
                    ?: obj.optJSONObject("command_data")
                pendingCommands += PendingCommand(
                    id = id,
                    type = type,
                    data = dataObj
                )
            }
        }

        HeartbeatResult(newToken, pendingCommands)
    }

    suspend fun heartbeat(): String = withContext(Dispatchers.IO) {
        heartbeatWithCommands().token
    }

    suspend fun getDispatchPlan(token: String): JSONObject = withContext(Dispatchers.IO) {
        fun fetchOnce(tkn: String): Pair<Int, String> {
            val tz = encode(TimeZone.getDefault().id)
            val url = URL(
                "$baseUrl/api/player/dispatch?uin=${encode(uin)}&token=${encode(tkn)}&deviceId=${encode(deviceId)}&timezone=$tz"
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
            return responseCode to responseBody
        }

        var tkn = token
        var (responseCode, responseBody) = fetchOnce(tkn)
        if (responseCode == 401) {
            currentToken = null
            tkn = getToken()
            currentToken = tkn
            val second = fetchOnce(tkn)
            responseCode = second.first
            responseBody = second.second
        }

        if (responseCode !in 200..299) {
            throw IOException("HTTP dispatch falhou: code=$responseCode body=$responseBody")
        }

        JSONObject(responseBody)
    }

    suspend fun reportCommandResult(
        token: String,
        requestId: String,
        status: String,
        result: JSONObject? = null,
        error: String? = null
    ): String = withContext(Dispatchers.IO) {
        fun postOnce(tkn: String): Int {
            val url = URL("$baseUrl/api/player/command-result")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Content-Type", "application/json")
            }
            val body = JSONObject().apply {
                put("uin", uin)
                put("token", tkn)
                put("requestId", requestId)
                put("status", status)
                if (result != null) put("result", result)
                if (!error.isNullOrBlank()) put("error", error)
            }.toString()
            return try {
                conn.outputStream.use { it.write(body.toByteArray()) }
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
            tkn = heartbeat()
            code = postOnce(tkn)
        }
        if (code == 401) {
            tkn = getToken()
            postOnce(tkn)
        }
        tkn
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


package br.com.smartchannel.smartsignagead.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.TimeZone

class DispatcherApiClient(
    val baseUrl: String,
    val uin: String,
    deviceId: String
) {
    val deviceId: String =
        br.com.smartchannel.smartsignagead.config.AppConfigLoader.normalizeDeviceId(deviceId)

    private var currentToken: String? = null

    fun cachedToken(): String? = currentToken

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun openConnection(url: URL, method: String): HttpURLConnection {
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 8000
        }
    }

    suspend fun getToken(): String = withContext(Dispatchers.IO) {
        val url = URL("${baseUrl.trimEnd('/')}/api/player/token?uin=${encode(uin)}&deviceId=${encode(deviceId)}")
        val conn = openConnection(url, "GET")
        val code = try { conn.responseCode } catch (_: Exception) { -1 }
        val body = try {
            conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (e: Exception) {
            val err = conn.errorStream?.use { it.readBytes().toString(Charsets.UTF_8) } ?: e.message
            throw IOException("token falhou: code=$code body=$err", e)
        }
        if (code !in 200..299) throw IOException("token falhou: code=$code body=$body")
        val json = JSONObject(body)
        val token = json.optString("token", "")
        if (token.isBlank()) throw IOException("token vazio: $body")
        currentToken = token
        token
    }

    suspend fun heartbeat(): String = withContext(Dispatchers.IO) {
        var token = currentToken ?: getToken()
        val result = postHeartbeatOnce(token)
        var code = result.first
        var body = result.second
        if (code == 401) {
            currentToken = null
            token = getToken()
            val retry = postHeartbeatOnce(token)
            code = retry.first
            body = retry.second
        }
        if (code !in 200..299) throw IOException("heartbeat falhou: code=$code body=$body")
        val json = JSONObject(body)
        val next = json.optString("token", token)
        currentToken = next
        next
    }

    private fun postHeartbeatOnce(token: String): Pair<Int, String> {
        val url = URL("${baseUrl.trimEnd('/')}/api/player/heartbeat?uin=${encode(uin)}&token=${encode(token)}&deviceId=${encode(deviceId)}")
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        val req = JSONObject(mapOf("uin" to uin, "deviceId" to deviceId)).toString()
        conn.outputStream.use { it.write(req.toByteArray()) }
        val code = try { conn.responseCode } catch (_: Exception) { -1 }
        val body = try {
            (if (code in 200..299) conn.inputStream else conn.errorStream).use {
                it?.readBytes()?.toString(Charsets.UTF_8).orEmpty()
            }
        } catch (_: Exception) {
            ""
        }
        return code to body
    }

    suspend fun getDispatchPlan(token: String): JSONObject = withContext(Dispatchers.IO) {
        var tkn = token
        var result = getDispatchOnce(tkn)
        if (result.first == 401) {
            currentToken = null
            tkn = getToken()
            result = getDispatchOnce(tkn)
        }
        val code = result.first
        val body = result.second
        if (code !in 200..299) throw IOException("dispatch falhou: code=$code body=$body")
        JSONObject(body)
    }

    private fun getDispatchOnce(token: String): Pair<Int, String> {
        val tz = encode(TimeZone.getDefault().id)
        val url = URL("${baseUrl.trimEnd('/')}/api/player/dispatch?uin=${encode(uin)}&token=${encode(token)}&deviceId=${encode(deviceId)}&timezone=$tz")
        val conn = openConnection(url, "GET")
        val code = try { conn.responseCode } catch (_: Exception) { -1 }
        val body = try {
            (if (code in 200..299) conn.inputStream else conn.errorStream).use {
                it?.readBytes()?.toString(Charsets.UTF_8).orEmpty()
            }
        } catch (_: Exception) {
            ""
        }
        return code to body
    }

    fun resolveUrl(relativeOrAbsolute: String): String {
        if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) return relativeOrAbsolute
        val base = baseUrl.trimEnd('/')
        val rel = if (relativeOrAbsolute.startsWith("/")) relativeOrAbsolute else "/$relativeOrAbsolute"
        return base + rel
    }
}

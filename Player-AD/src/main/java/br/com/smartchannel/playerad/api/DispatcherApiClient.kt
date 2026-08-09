package br.com.smartchannel.playerad.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.TimeZone
import java.util.UUID

/**
 * Cliente mínimo para integrar com o Dispatcher / API de player:
 * - POST /api/player/heartbeat
 * - GET  /api/player/dispatch
 *
 * Em HTTP 429 lança [ApiHttpException] com Retry-After quando o servidor envia o header.
 */
class DispatcherApiClient(
    val baseUrl: String,
    val uin: String,
    deviceId: String,
    val appVersion: String = "1.0.0"
 ) {
    val deviceId: String =
        br.com.smartchannel.playerad.config.PlayerConfigLoader.normalizeDeviceId(deviceId)

    data class PendingCommand(
        val id: String,
        val type: String,
        val data: JSONObject?
    )

    data class HeartbeatResult(
        val token: String,
        val pendingCommands: List<PendingCommand>,
        val otaUpdate: JSONObject? = null,
        val displaySchedule: JSONObject? = null,
        val pollAdaptive: JSONObject? = null,
        /** Fingerprint do plano no servidor (null = desconhecido). */
        val planVersion: String? = null,
        /** true = player deve chamar GET /dispatch. */
        val needsDispatch: Boolean = true,
        /** false = backend antigo sem contrato planVersion (usar poll periódico). */
        val supportsPlanVersion: Boolean = false,
        /** Janela opcional para amostragem detalhada; ausente mantém somente transições. */
        val telemetryObservation: TelemetryObservation? = null,
    )

    data class TelemetryObservation(
        val active: Boolean,
        val expiresAt: String?,
        val expiresAtEpochMs: Long?,
        val intervalSeconds: Int,
    ) {
        fun isExpired(nowMs: Long = System.currentTimeMillis()): Boolean =
            expiresAtEpochMs?.let { nowMs >= it } ?: false
    }

    private data class HttpTextResponse(
        val code: Int,
        val body: String,
        val retryAfterSeconds: Long?,
    )

    private var currentToken: String? = null
    @Volatile
    private var syncHeartbeatUnsupportedUntilMs: Long = 0L

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

    private fun parseRetryAfterSeconds(conn: HttpURLConnection): Long? {
        val raw = conn.getHeaderField("Retry-After")?.trim().orEmpty()
        if (raw.isBlank()) return null
        return raw.toLongOrNull()?.takeIf { it >= 0 }
    }

    private fun readHttpText(conn: HttpURLConnection): HttpTextResponse {
        val code = try {
            conn.responseCode
        } catch (e: Exception) {
            val detail = "${e.javaClass.simpleName}: ${e.message ?: "sem mensagem"}"
            return HttpTextResponse(-1, detail, null)
        }
        val retryAfter = try {
            parseRetryAfterSeconds(conn)
        } catch (_: Exception) {
            null
        }
        val stream = try {
            if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
        } catch (_: Exception) {
            null
        }
        val body = try {
            stream?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()
        } catch (e: Exception) {
            e.message.orEmpty()
        }
        return HttpTextResponse(code, body, retryAfter)
    }

    private fun parseRetryFromBody(body: String): Long? {
        if (body.isBlank()) return null
        return try {
            val json = JSONObject(body)
            val seconds = json.optLong("retryAfterSeconds", -1L)
            if (seconds >= 0) return seconds
            when (val raw = json.opt("retryAfter")) {
                is Number -> raw.toLong()
                is String -> raw.toLongOrNull()
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun throwHttp(label: String, response: HttpTextResponse): Nothing {
        throw ApiHttpException(
            code = response.code,
            message = "HTTP $label falhou: code=${response.code} body=${response.body}",
            retryAfterSeconds = response.retryAfterSeconds ?: parseRetryFromBody(response.body),
        )
    }

    private fun performTokenGet(): HttpTextResponse {
        val url = URL(
            "$baseUrl/api/player/token?uin=${encode(uin)}&deviceId=${encode(deviceId)}"
        )
        val conn = openConnection(url, "GET")
        return try {
            readHttpText(conn)
        } finally {
            conn.disconnect()
        }
    }

    suspend fun getToken(): String = withContext(Dispatchers.IO) {
        var response = performTokenGet()
        if (response.code == 401) {
            delay(400L)
            response = performTokenGet()
        }

        if (response.code !in 200..299) {
            throwHttp("token", response)
        }

        val json = JSONObject(response.body)
        val token = json.optString("token", "")
        if (token.isBlank()) {
            throw IOException("Token vazio em /api/player/token: body=${response.body}")
        }
        currentToken = token
        token
    }

    private fun heartbeatPayload(metrics: JSONObject? = null): JSONObject = JSONObject().apply {
        put("uin", uin)
        put("deviceId", deviceId)
        put("status", "online")
        put("platform", "android")
        put("version", appVersion)
        put("appVersion", appVersion)
        if (metrics != null) put("metrics", metrics)
    }

    private fun performHeartbeatRequest(token: String, metrics: JSONObject? = null): HttpTextResponse {
        val url = URL(
            "$baseUrl/api/player/heartbeat?uin=${encode(uin)}&token=${encode(token)}&deviceId=${encode(deviceId)}"
        )
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }

        val body = heartbeatPayload(metrics).toString()

        return try {
            conn.outputStream.use { it.write(body.toByteArray()) }
            readHttpText(conn)
        } finally {
            conn.disconnect()
        }
    }

    private fun performSyncHeartbeatRequest(
        token: String,
        metrics: JSONObject?,
        knownPlanVersion: String?,
    ): HttpTextResponse {
        val url = URL(
            "$baseUrl/api/player/sync?uin=${encode(uin)}&token=${encode(token)}&deviceId=${encode(deviceId)}"
        )
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        val body = JSONObject().apply {
            put("schemaVersion", 1)
            put("syncId", UUID.randomUUID().toString())
            put("heartbeat", heartbeatPayload(metrics))
            knownPlanVersion?.takeIf { it.isNotBlank() }?.let {
                put("knownPlanVersion", it)
            }
        }.toString()
        return try {
            conn.outputStream.use { it.write(body.toByteArray()) }
            readHttpText(conn)
        } finally {
            conn.disconnect()
        }
    }

    private fun performPreferredHeartbeatRequest(
        token: String,
        metrics: JSONObject?,
        knownPlanVersion: String?,
    ): HttpTextResponse {
        if (System.currentTimeMillis() >= syncHeartbeatUnsupportedUntilMs) {
            val syncResponse = performSyncHeartbeatRequest(token, metrics, knownPlanVersion)
            if (syncResponse.code != 404 && syncResponse.code != 405) return syncResponse
            syncHeartbeatUnsupportedUntilMs =
                System.currentTimeMillis() + SYNC_HEARTBEAT_REPROBE_INTERVAL_MS
        }
        return performHeartbeatRequest(token, metrics)
    }

    suspend fun heartbeatWithCommands(
        metrics: JSONObject? = null,
        knownPlanVersion: String? = null,
    ): HeartbeatResult = withContext(Dispatchers.IO) {
        var tkn = currentToken ?: getToken()
        var response = performPreferredHeartbeatRequest(tkn, metrics, knownPlanVersion)
        if (response.code == 401) {
            currentToken = null
            tkn = getToken()
            currentToken = tkn
            response = performPreferredHeartbeatRequest(tkn, metrics, knownPlanVersion)
        }

        if (response.code !in 200..299) {
            throwHttp("heartbeat", response)
        }

        val json = JSONObject(response.body)
        val data = json.optJSONObject("data")
        val container = data ?: json
        val payload = container.optJSONObject("heartbeat") ?: container
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

        val otaUpdate = payload.optJSONObject("otaUpdate")
            ?: payload.optJSONObject("ota_update")

        val displaySchedule = payload.optJSONObject("displaySchedule")
            ?: payload.optJSONObject("display_schedule")

        val pollAdaptive = payload.optJSONObject("pollAdaptive")
            ?: payload.optJSONObject("poll_adaptive")

        val planVersion = payload.optString("planVersion", "")
            .ifBlank { payload.optString("plan_version", "") }
            .trim()
            .ifBlank { null }

        val supportsPlanVersion =
            payload.has("needsDispatch") || payload.has("needs_dispatch") ||
                payload.has("planVersion") || payload.has("plan_version")

        val needsDispatch = when {
            payload.has("needsDispatch") -> payload.optBoolean("needsDispatch", true)
            payload.has("needs_dispatch") -> payload.optBoolean("needs_dispatch", true)
            else -> false // backend legado: não forçar dispatch a cada heartbeat
        }

        val observationJson = payload.optJSONObject("telemetryObservation")
            ?: payload.optJSONObject("telemetry_observation")
        val telemetryObservation = observationJson?.let { observation ->
            val expiresAt = observation.optString("expiresAt", "")
                .ifBlank { observation.optString("expires_at", "") }
                .ifBlank { null }
            TelemetryObservation(
                active = observation.optBoolean("active", false),
                expiresAt = expiresAt,
                expiresAtEpochMs = expiresAt?.let(::parseIsoUtcMillis),
                intervalSeconds = observation.optInt(
                    "intervalSeconds",
                    observation.optInt("interval_seconds", 30),
                ).coerceIn(2, 3600),
            )
        }

        HeartbeatResult(
            newToken,
            pendingCommands,
            otaUpdate,
            displaySchedule,
            pollAdaptive,
            planVersion,
            needsDispatch,
            supportsPlanVersion,
            telemetryObservation,
        )
    }

    suspend fun reportOtaStatus(
        currentVersion: String,
        updateStatus: String,
        availableVersion: String? = null,
        error: String? = null
    ) = withContext(Dispatchers.IO) {
        var tkn = currentToken ?: getToken()
        val url = URL("$baseUrl/api/player/ota-status")
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        val body = JSONObject().apply {
            put("uin", uin)
            put("token", tkn)
            put("currentVersion", currentVersion)
            put("updateStatus", updateStatus)
            if (!availableVersion.isNullOrBlank()) put("availableVersion", availableVersion)
            if (!error.isNullOrBlank()) put("error", error)
        }.toString()
        try {
            conn.outputStream.use { it.write(body.toByteArray()) }
            val response = readHttpText(conn)
            if (response.code !in 200..299) {
                throwHttp("ota-status", response)
            }
        } finally {
            conn.disconnect()
        }
    }

    suspend fun heartbeat(): String = withContext(Dispatchers.IO) {
        heartbeatWithCommands().token
    }

    suspend fun registerActivation(hardware: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val url = URL("$baseUrl/api/player/register")
        val conn = openConnection(url, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }

        val body = JSONObject().apply {
            put("uin", uin)
            put("hardware", hardware)
        }.toString()

        try {
            conn.outputStream.use { it.write(body.toByteArray()) }
            val response = readHttpText(conn)
            if (response.code !in 200..299) {
                throwHttp("register", response)
            }
            val json = JSONObject(response.body)
            val token = json.optString("token", "")
            if (token.isNotBlank()) currentToken = token
            json
        } finally {
            conn.disconnect()
        }
    }

    suspend fun getDispatchPlan(token: String): JSONObject = withContext(Dispatchers.IO) {
        fun fetchOnce(tkn: String): HttpTextResponse {
            val tz = encode(TimeZone.getDefault().id)
            val url = URL(
                "$baseUrl/api/player/dispatch?uin=${encode(uin)}&token=${encode(tkn)}&deviceId=${encode(deviceId)}&timezone=$tz"
            )
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
            }
            return try {
                readHttpText(conn)
            } finally {
                conn.disconnect()
            }
        }

        var tkn = token
        var response = fetchOnce(tkn)
        if (response.code == 401) {
            currentToken = null
            tkn = getToken()
            currentToken = tkn
            response = fetchOnce(tkn)
        }

        if (response.code !in 200..299) {
            throwHttp("dispatch", response)
        }

        JSONObject(response.body)
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
                connectTimeout = 15000
                readTimeout = 60000
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

    private fun parseIsoUtcMillis(value: String): Long? {
        val patterns = arrayOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
        )
        for (pattern in patterns) {
            val parsed = runCatching {
                java.text.SimpleDateFormat(pattern, java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                    isLenient = false
                }.parse(value)?.time
            }.getOrNull()
            if (parsed != null) return parsed
        }
        return null
    }

    private companion object {
        const val SYNC_HEARTBEAT_REPROBE_INTERVAL_MS = 6L * 60L * 60L * 1000L
    }
}


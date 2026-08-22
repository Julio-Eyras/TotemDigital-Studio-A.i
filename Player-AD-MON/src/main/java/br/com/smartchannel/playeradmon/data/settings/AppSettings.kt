package br.com.smartchannel.playeradmon.data.settings

import android.content.Context
import android.content.SharedPreferences
import java.net.URI

/**
 * Preferências não-secretas. Tokens ficam em [br.com.smartchannel.playeradmon.data.auth.SecureTokenStore].
 */
class AppSettings(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trim()).apply()

    /** Intervalo base de poll REST (10–30 s). O serviço usa 10 s offline / 15 s com WS. */
    var pollIntervalSeconds: Double
        get() {
            val stored = prefs.getFloat(KEY_POLL, 12f).toDouble()
            return if (stored in 10.0..30.0) stored else 12.0
        }
        set(value) {
            val clamped = value.coerceIn(10.0, 30.0)
            prefs.edit().putFloat(KEY_POLL, clamped.toFloat()).apply()
        }

    /** URL base sem barra final (ex.: `https://host:3000`). */
    fun normalizedServerUrl(): String? {
        var raw = serverUrl.trim()
        if (raw.isEmpty()) return null
        if (!raw.contains("://")) raw = "https://$raw"
        while (raw.endsWith("/")) raw = raw.dropLast(1)
        return try {
            URI(raw).toString().trimEnd('/')
        } catch (_: Exception) {
            null
        }
    }

    fun apiUrl(path: String): String {
        val base = normalizedServerUrl()
            ?: throw ApiException.MissingServerUrl
        val cleaned = if (path.startsWith("/")) path else "/$path"
        return "$base$cleaned"
    }

    fun webSocketUrl(token: String): String {
        val base = normalizedServerUrl()
            ?: throw ApiException.MissingServerUrl
        val uri = URI(base)
        val scheme = if (uri.scheme.equals("https", ignoreCase = true)) "wss" else "ws"
        val authority = uri.rawAuthority ?: uri.host
            ?: throw ApiException.InvalidUrl
        val encoded = java.net.URLEncoder.encode(token, Charsets.UTF_8.name())
        return "$scheme://$authority/ws?token=$encoded"
    }

    companion object {
        private const val PREFS = "player_ad_mon_settings"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_POLL = "poll_interval_seconds"
    }
}

sealed class ApiException(message: String) : Exception(message) {
    data object MissingServerUrl : ApiException("Defina a URL do servidor nas Definições.")
    data object InvalidUrl : ApiException("URL do servidor inválida.")
    data object Unauthorized : ApiException("Sessão expirada. Faça login novamente.")
    data object EmptyBody : ApiException("Resposta vazia do servidor.")
    class HttpStatus(val code: Int, detail: String?) :
        ApiException(detail?.takeIf { it.isNotBlank() } ?: "Erro HTTP $code")

    class Network(cause: Throwable) : ApiException("Rede: ${cause.message ?: cause.javaClass.simpleName}")
    class Decoding(detail: String) : ApiException("Resposta inválida: $detail")
}

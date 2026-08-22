package br.com.smartchannel.playeradmon.data.network

import br.com.smartchannel.playeradmon.data.auth.SecureTokenStore
import br.com.smartchannel.playeradmon.data.settings.ApiException
import br.com.smartchannel.playeradmon.data.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiClient(
    private val settings: AppSettings,
    private val tokenStore: SecureTokenStore,
) {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val refreshMutex = Mutex()
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun requestJson(
        method: String,
        path: String,
        body: JSONObject? = null,
        authorized: Boolean = true,
        retryOnUnauthorized: Boolean = true,
    ): Any = withContext(Dispatchers.IO) {
        val data = requestData(method, path, body, authorized, retryOnUnauthorized)
        if (data.isEmpty()) throw ApiException.EmptyBody
        parseJson(data)
    }

    suspend fun requestData(
        method: String,
        path: String,
        body: JSONObject?,
        authorized: Boolean,
        retryOnUnauthorized: Boolean,
    ): String = withContext(Dispatchers.IO) {
        val url = settings.apiUrl(path)
        val builder = Request.Builder()
            .url(url)
            .header("Accept", "application/json")

        if (authorized) {
            val token = tokenStore.accessToken
            if (!token.isNullOrBlank()) {
                builder.header("Authorization", "Bearer $token")
            }
        }

        when (method.uppercase()) {
            "GET", "DELETE" -> {
                builder.method(method.uppercase(), null)
            }
            else -> {
                val payload = (body ?: JSONObject()).toString()
                builder.header("Content-Type", "application/json")
                builder.method(method.uppercase(), payload.toRequestBody(jsonMedia))
            }
        }

        val response = try {
            http.newCall(builder.build()).execute()
        } catch (e: Exception) {
            throw ApiException.Network(e)
        }

        val text = response.body?.string().orEmpty()
        if (response.code == 401 && authorized && retryOnUnauthorized) {
            response.close()
            val refreshed = refreshTokensIfPossible()
            if (refreshed) {
                return@withContext requestData(method, path, body, authorized = true, retryOnUnauthorized = false)
            }
            throw ApiException.Unauthorized
        }

        if (response.code !in 200..299) {
            val message = extractErrorMessage(text)
            throw ApiException.HttpStatus(response.code, message)
        }
        text
    }

    private suspend fun refreshTokensIfPossible(): Boolean = refreshMutex.withLock {
        val refresh = tokenStore.refreshToken ?: return false
        return try {
            val body = JSONObject().put("refreshToken", refresh)
            val raw = requestData(
                method = "POST",
                path = "/api/auth/refresh",
                body = body,
                authorized = false,
                retryOnUnauthorized = false,
            )
            val obj = JSONObject(raw)
            val token = obj.optString("token", "")
            val newRefresh = obj.optString("refreshToken", "")
            if (token.isBlank() || newRefresh.isBlank()) {
                tokenStore.clearSession()
                false
            } else {
                tokenStore.accessToken = token
                tokenStore.refreshToken = newRefresh
                true
            }
        } catch (_: Exception) {
            tokenStore.clearSession()
            false
        }
    }

    private fun parseJson(text: String): Any {
        val trimmed = text.trim()
        return try {
            when {
                trimmed.startsWith("{") -> JSONObject(trimmed)
                trimmed.startsWith("[") -> org.json.JSONArray(trimmed)
                else -> trimmed
            }
        } catch (e: Exception) {
            throw ApiException.Decoding(e.message ?: e.javaClass.simpleName)
        }
    }

    private fun extractErrorMessage(text: String): String? {
        return try {
            val obj = JSONObject(text)
            obj.optString("error").takeIf { it.isNotBlank() }
                ?: obj.optString("message").takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }
}

package br.com.smartchannel.playeradmon.data.auth

import br.com.smartchannel.playeradmon.data.network.ApiClient
import br.com.smartchannel.playeradmon.data.settings.ApiException
import br.com.smartchannel.playeradmon.model.AuthUser
import br.com.smartchannel.playeradmon.model.LoginResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

class AuthRepository(
    private val api: ApiClient,
    private val tokenStore: SecureTokenStore,
) {
    private val _isAuthenticated = MutableStateFlow(tokenStore.hasSession)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUser = MutableStateFlow(tokenStore.user)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    private val _pendingTwoFactorUser = MutableStateFlow<AuthUser?>(null)
    val pendingTwoFactorUser: StateFlow<AuthUser?> = _pendingTwoFactorUser.asStateFlow()

    suspend fun login(username: String, password: String) {
        val body = JSONObject()
            .put("username", username)
            .put("password", password)
        val raw = api.requestJson("POST", "/api/auth/login", body, authorized = false)
        val result = parseLogin(raw)
        if (result.requiresTwoFactor) {
            _pendingTwoFactorUser.value = result.user
            return
        }
        val token = result.token
        val refresh = result.refreshToken
        if (token.isNullOrBlank() || refresh.isNullOrBlank()) {
            throw ApiException.HttpStatus(401, result.error ?: "Resposta de login inválida")
        }
        tokenStore.persistSession(token, refresh, result.user)
        _currentUser.value = result.user
        _isAuthenticated.value = true
        _pendingTwoFactorUser.value = null
    }

    suspend fun verifyTwoFactor(code: String) {
        val user = _pendingTwoFactorUser.value
            ?: throw ApiException.HttpStatus(400, "Sessão 2FA inválida. Faça login novamente.")
        val body = JSONObject()
            .put("userId", user.id)
            .put("code", code)
        val raw = api.requestJson("POST", "/api/auth/2fa/verify", body, authorized = false)
        val result = parseLogin(raw)
        val token = result.token
        val refresh = result.refreshToken
        if (token.isNullOrBlank() || refresh.isNullOrBlank()) {
            throw ApiException.HttpStatus(401, result.error ?: "Código 2FA inválido")
        }
        tokenStore.persistSession(token, refresh, result.user ?: user)
        _currentUser.value = result.user ?: user
        _isAuthenticated.value = true
        _pendingTwoFactorUser.value = null
    }

    fun cancelTwoFactor() {
        _pendingTwoFactorUser.value = null
    }

    suspend fun logout() {
        if (tokenStore.hasSession) {
            try {
                api.requestJson(
                    method = "POST",
                    path = "/api/auth/logout",
                    body = null,
                    authorized = true,
                    retryOnUnauthorized = false,
                )
            } catch (_: Exception) {
            }
        }
        tokenStore.clearSession()
        _isAuthenticated.value = false
        _currentUser.value = null
        _pendingTwoFactorUser.value = null
    }

    private fun parseLogin(raw: Any): LoginResult {
        val obj = raw as? JSONObject
            ?: throw ApiException.Decoding("Login não é JSON object")
        val requires = obj.optBoolean("requiresTwoFactor", false)
        val userObj = obj.optJSONObject("user")
        val user = userObj?.let { SecureTokenStore.parseUser(it) }
        return LoginResult(
            requiresTwoFactor = requires,
            token = obj.optString("token").takeIf { it.isNotBlank() },
            refreshToken = obj.optString("refreshToken").takeIf { it.isNotBlank() },
            user = user,
            error = obj.optString("error").takeIf { it.isNotBlank() },
        )
    }
}

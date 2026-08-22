package br.com.smartchannel.playeradmon.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import br.com.smartchannel.playeradmon.model.AuthUser
import org.json.JSONObject

/**
 * Armazenamento seguro de JWT / refresh / utilizador (EncryptedSharedPreferences).
 */
class SecureTokenStore(context: Context) {
    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS, null)?.takeIf { it.isNotBlank() }
        set(value) {
            prefs.edit().apply {
                if (value.isNullOrBlank()) remove(KEY_ACCESS) else putString(KEY_ACCESS, value)
            }.apply()
        }

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH, null)?.takeIf { it.isNotBlank() }
        set(value) {
            prefs.edit().apply {
                if (value.isNullOrBlank()) remove(KEY_REFRESH) else putString(KEY_REFRESH, value)
            }.apply()
        }

    var user: AuthUser?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try {
                parseUser(JSONObject(json))
            } catch (_: Exception) {
                null
            }
        }
        set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_USER)
                else putString(KEY_USER, userToJson(value).toString())
            }.apply()
        }

    val hasSession: Boolean get() = !accessToken.isNullOrBlank()

    fun clearSession() {
        prefs.edit()
            .remove(KEY_ACCESS)
            .remove(KEY_REFRESH)
            .remove(KEY_USER)
            .apply()
    }

    fun persistSession(token: String, refresh: String, user: AuthUser?) {
        accessToken = token
        refreshToken = refresh
        this.user = user
    }

    companion object {
        private const val PREFS_NAME = "player_ad_mon_secure"
        private const val KEY_ACCESS = "access_token"
        private const val KEY_REFRESH = "refresh_token"
        private const val KEY_USER = "user_json"

        fun parseUser(obj: JSONObject): AuthUser = AuthUser(
            id = obj.optInt("id", 0),
            username = obj.optStringOrNull("username"),
            name = obj.optStringOrNull("name"),
            email = obj.optStringOrNull("email"),
            role = obj.optStringOrNull("role"),
            subscriberId = obj.optIntOrNull("subscriberId") ?: obj.optIntOrNull("subscriber_id"),
            publisherId = obj.optIntOrNull("publisherId") ?: obj.optIntOrNull("publisher_id"),
        )

        private fun userToJson(user: AuthUser): JSONObject = JSONObject().apply {
            put("id", user.id)
            putOpt("username", user.username)
            putOpt("name", user.name)
            putOpt("email", user.email)
            putOpt("role", user.role)
            putOpt("subscriberId", user.subscriberId)
            putOpt("publisherId", user.publisherId)
        }

        private fun JSONObject.optStringOrNull(key: String): String? {
            if (!has(key) || isNull(key)) return null
            val v = optString(key, "")
            return v.takeIf { it.isNotBlank() }
        }

        private fun JSONObject.optIntOrNull(key: String): Int? {
            if (!has(key) || isNull(key)) return null
            val v = optInt(key, Int.MIN_VALUE)
            return if (v == Int.MIN_VALUE) null else v
        }
    }
}

package br.com.smartchannel.playeradmon.model

data class AuthUser(
    val id: Int,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    val role: String? = null,
    val subscriberId: Int? = null,
    val publisherId: Int? = null,
) {
    val displayName: String
        get() {
            val raw = name?.trim().orEmpty()
            if (raw.isNotEmpty()) return raw
            val user = username?.trim().orEmpty()
            if (user.isNotEmpty()) return user
            return email ?: "Utilizador #$id"
        }
}

data class LoginResult(
    val requiresTwoFactor: Boolean,
    val token: String? = null,
    val refreshToken: String? = null,
    val user: AuthUser? = null,
    val error: String? = null,
)

package br.com.smartchannel.playerad.api

import java.io.IOException

/**
 * Erro HTTP da API do player (token/heartbeat/dispatch/eventos).
 * [retryAfterSeconds] vem do header Retry-After quando o servidor envia 429.
 */
class ApiHttpException(
    val code: Int,
    message: String,
    val retryAfterSeconds: Long? = null,
) : IOException(message) {
    val isRateLimited: Boolean get() = code == 429
}

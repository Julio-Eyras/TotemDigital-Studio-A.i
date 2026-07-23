package br.com.smartchannel.playerad.util

/**
 * Intervalo adaptativo para polls ao servidor (heartbeat / dispatch).
 * Em sucesso regressa gradualmente à base; em falha (sobretudo 429) aumenta até um teto.
 */
class AdaptivePollScheduler(
    private val name: String,
    private val baseIntervalMs: Long,
    private val maxIntervalMs: Long,
) {
    private var currentIntervalMs: Long = baseIntervalMs.coerceAtLeast(1_000L)
    private var lastAttemptAtMs: Long = 0L
    private var failureStreak: Int = 0

    fun currentIntervalMs(): Long = currentIntervalMs

    fun failureStreak(): Int = failureStreak

    fun markAttempted(nowMs: Long = System.currentTimeMillis()) {
        lastAttemptAtMs = nowMs
    }

    fun due(nowMs: Long = System.currentTimeMillis()): Boolean {
        if (lastAttemptAtMs <= 0L) return true
        return nowMs - lastAttemptAtMs >= currentIntervalMs
    }

    fun onSuccess() {
        val previous = currentIntervalMs
        failureStreak = 0
        currentIntervalMs = if (currentIntervalMs > baseIntervalMs) {
            (currentIntervalMs / 2L).coerceAtLeast(baseIntervalMs)
        } else {
            baseIntervalMs
        }
        if (previous != currentIntervalMs) {
            PlayerAdLogger.i(
                "POLL",
                "$name OK — intervalo ${previous}ms → ${currentIntervalMs}ms (base=${baseIntervalMs}ms)"
            )
        }
    }

    fun onFailure(httpCode: Int? = null, retryAfterSeconds: Long? = null) {
        failureStreak += 1
        val previous = currentIntervalMs
        val doubled = (currentIntervalMs * 2L).coerceAtMost(maxIntervalMs)
        val fromHeaderMs = retryAfterSeconds
            ?.takeIf { it > 0 }
            ?.times(1_000L)
        currentIntervalMs = when {
            fromHeaderMs != null -> maxOf(doubled, fromHeaderMs).coerceAtMost(
                maxOf(maxIntervalMs, fromHeaderMs)
            )
            httpCode == 429 -> maxOf(doubled, 60_000L).coerceAtMost(maxIntervalMs)
            else -> doubled
        }
        PlayerAdLogger.w(
            "POLL",
            "$name falha#$failureStreak code=$httpCode retryAfter=${retryAfterSeconds}s — " +
                "intervalo ${previous}ms → ${currentIntervalMs}ms"
        )
    }
}

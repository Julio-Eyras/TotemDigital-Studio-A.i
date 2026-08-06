package br.com.smartchannel.playerad.util

/**
 * Intervalo adaptativo para polls ao servidor (heartbeat / dispatch).
 *
 * - Falha (429/rede): dobra até [maxIntervalMs], respeita Retry-After.
 * - Sucesso com mudança: volta à base do perfil atual (ativo ou idle).
 * - Sucesso sem mudança (sonolência): após [unchangedBeforeSleep] iguais, cresce
 *   por [sleepGrowthFactor] até o teto.
 * - Perfil idle (fora do horário de tela): usa [idleBaseIntervalMs] como base.
 */
class AdaptivePollScheduler(
    private val name: String,
    private var activeBaseIntervalMs: Long,
    private val maxIntervalMs: Long,
    private var idleBaseIntervalMs: Long = activeBaseIntervalMs,
    private val unchangedBeforeSleep: Int = 2,
    private val sleepGrowthFactor: Double = 2.0,
    private val sleepEnabled: Boolean = true,
) {
    private var currentIntervalMs: Long = activeBaseIntervalMs.coerceAtLeast(1_000L)
    private var lastAttemptAtMs: Long = 0L
    private var failureStreak: Int = 0
    private var unchangedStreak: Int = 0
    private var idleMode: Boolean = false

    fun currentIntervalMs(): Long = currentIntervalMs

    fun failureStreak(): Int = failureStreak

    fun unchangedStreak(): Int = unchangedStreak

    fun isIdleMode(): Boolean = idleMode

    /** Actualiza a base activa em runtime (ex.: soft-apply de batimentoCardiaco). */
    fun setActiveBaseIntervalMs(ms: Long) {
        val next = ms.coerceAtLeast(1_000L)
        if (next == activeBaseIntervalMs) return
        activeBaseIntervalMs = next
        if (!idleMode) {
            currentIntervalMs = currentIntervalMs.coerceAtLeast(next).coerceAtMost(
                maxIntervalMs.coerceAtLeast(next),
            )
            // Se estava na base antiga, desce à nova base
            if (failureStreak == 0 && unchangedStreak == 0) {
                currentIntervalMs = next
            }
        }
        PlayerAdLogger.i("POLL", "$name base activa → ${activeBaseIntervalMs}ms")
    }

    fun setIdleBaseIntervalMs(ms: Long) {
        idleBaseIntervalMs = ms.coerceAtLeast(1_000L)
    }

    fun markAttempted(nowMs: Long = System.currentTimeMillis()) {
        lastAttemptAtMs = nowMs
    }

    fun due(nowMs: Long = System.currentTimeMillis()): Boolean {
        if (lastAttemptAtMs <= 0L) return true
        return nowMs - lastAttemptAtMs >= currentIntervalMs
    }

    /** Fora do horário de tela: base maior; ao voltar, acorda. */
    fun setIdleMode(idle: Boolean) {
        if (idleMode == idle) return
        val previous = currentIntervalMs
        idleMode = idle
        if (idle) {
            val idleBase = effectiveBaseMs()
            if (currentIntervalMs < idleBase) {
                currentIntervalMs = idleBase
            }
        } else {
            wakeToBase()
        }
        if (previous != currentIntervalMs) {
            PlayerAdLogger.i(
                "POLL",
                "$name perfil=${if (idle) "idle" else "ativo"} — intervalo ${previous}ms → ${currentIntervalMs}ms"
            )
        }
    }

    /** Sucesso com conteúdo/comando novo — acorda. */
    fun onBusySuccess() {
        val previous = currentIntervalMs
        failureStreak = 0
        unchangedStreak = 0
        currentIntervalMs = effectiveBaseMs()
        if (previous != currentIntervalMs) {
            PlayerAdLogger.i(
                "POLL",
                "$name mudança — intervalo ${previous}ms → ${currentIntervalMs}ms (base=${effectiveBaseMs()}ms)"
            )
        }
    }

    /** Sucesso sem diferença — sonolência progressiva. */
    fun onQuietSuccess() {
        val previous = currentIntervalMs
        failureStreak = 0
        if (!sleepEnabled) {
            unchangedStreak = 0
            currentIntervalMs = effectiveBaseMs()
            return
        }
        unchangedStreak += 1
        if (unchangedStreak >= unchangedBeforeSleep.coerceAtLeast(1)) {
            val factor = sleepGrowthFactor.coerceAtLeast(1.1)
            val grown = (currentIntervalMs.toDouble() * factor).toLong()
                .coerceAtLeast(effectiveBaseMs())
                .coerceAtMost(maxIntervalMs.coerceAtLeast(effectiveBaseMs()))
            currentIntervalMs = grown
        } else {
            currentIntervalMs = effectiveBaseMs()
        }
        if (previous != currentIntervalMs) {
            PlayerAdLogger.i(
                "POLL",
                "$name sonolência#$unchangedStreak — intervalo ${previous}ms → ${currentIntervalMs}ms " +
                    "(teto=${maxIntervalMs}ms idle=$idleMode)"
            )
        }
    }

    /**
     * Compat: sucesso genérico (ex. após falha) — desce gradualmente à base.
     * Preferir [onBusySuccess] / [onQuietSuccess] no loop principal.
     */
    fun onSuccess() {
        val previous = currentIntervalMs
        failureStreak = 0
        unchangedStreak = 0
        val base = effectiveBaseMs()
        currentIntervalMs = if (currentIntervalMs > base) {
            (currentIntervalMs / 2L).coerceAtLeast(base)
        } else {
            base
        }
        if (previous != currentIntervalMs) {
            PlayerAdLogger.i(
                "POLL",
                "$name OK — intervalo ${previous}ms → ${currentIntervalMs}ms (base=${base}ms)"
            )
        }
    }

    fun onFailure(httpCode: Int? = null, retryAfterSeconds: Long? = null) {
        failureStreak += 1
        unchangedStreak = 0
        val previous = currentIntervalMs
        val cap = maxIntervalMs.coerceAtLeast(effectiveBaseMs())
        val doubled = (currentIntervalMs * 2L).coerceAtMost(cap)
        val fromHeaderMs = retryAfterSeconds
            ?.takeIf { it > 0 }
            ?.times(1_000L)
        currentIntervalMs = when {
            fromHeaderMs != null -> maxOf(doubled, fromHeaderMs).coerceAtMost(
                maxOf(cap, fromHeaderMs)
            )
            httpCode == 429 -> maxOf(doubled, 60_000L).coerceAtMost(cap)
            else -> doubled
        }
        PlayerAdLogger.w(
            "POLL",
            "$name falha#$failureStreak code=$httpCode retryAfter=${retryAfterSeconds}s — " +
                "intervalo ${previous}ms → ${currentIntervalMs}ms"
        )
    }

    private fun effectiveBaseMs(): Long {
        val active = activeBaseIntervalMs.coerceAtLeast(1_000L)
        val idle = idleBaseIntervalMs.coerceAtLeast(active)
        return if (idleMode) idle else active
    }

    private fun wakeToBase() {
        unchangedStreak = 0
        failureStreak = 0
        currentIntervalMs = effectiveBaseMs()
    }
}

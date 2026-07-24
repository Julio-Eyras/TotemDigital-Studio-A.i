package br.com.smartchannel.playerad.config

import org.json.JSONObject

/**
 * Parâmetros de sonolência / backoff do batimento e do dispatch.
 * Também pode vir do servidor em `player_settings.pollAdaptive` (heartbeat).
 */
data class PollAdaptiveConfig(
    /** Se false, mantém só o intervalo base (sem crescer em respostas iguais). */
    val enabled: Boolean = true,
    /** Quantos sucessos iguais antes de começar a aumentar o intervalo. */
    val unchangedStreakBeforeSleep: Int = 2,
    /** Fator de crescimento a cada sucesso quieto após o limiar (ex.: 2.0 = dobra). */
    val sleepGrowthFactor: Double = 2.0,
    /** Teto do heartbeat em segundos (ativo ou idle). */
    val maxHeartbeatSeconds: Int = 600,
    /** Teto do dispatch em segundos. */
    val maxDispatchSeconds: Int = 1800,
    /**
     * Base do heartbeat quando a tela está em idle (fora do horário).
     * Deve ser >= batimentoCardiaco tipicamente.
     */
    val idleHeartbeatSeconds: Int = 120,
    /** Base do dispatch em idle. */
    val idleDispatchSeconds: Int = 600,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("enabled", enabled)
        put("unchangedStreakBeforeSleep", unchangedStreakBeforeSleep)
        put("sleepGrowthFactor", sleepGrowthFactor)
        put("maxHeartbeatSeconds", maxHeartbeatSeconds)
        put("maxDispatchSeconds", maxDispatchSeconds)
        put("idleHeartbeatSeconds", idleHeartbeatSeconds)
        put("idleDispatchSeconds", idleDispatchSeconds)
    }

    companion object {
        val DEFAULT = PollAdaptiveConfig()

        fun fromJson(raw: JSONObject?): PollAdaptiveConfig {
            if (raw == null) return DEFAULT
            return PollAdaptiveConfig(
                enabled = raw.optBoolean("enabled", true),
                unchangedStreakBeforeSleep = raw.optInt("unchangedStreakBeforeSleep", 2)
                    .coerceIn(1, 20),
                sleepGrowthFactor = raw.optDouble("sleepGrowthFactor", 2.0)
                    .coerceIn(1.1, 4.0),
                maxHeartbeatSeconds = raw.optInt("maxHeartbeatSeconds", 600)
                    .coerceIn(60, 3600),
                maxDispatchSeconds = raw.optInt("maxDispatchSeconds", 1800)
                    .coerceIn(120, 7200),
                idleHeartbeatSeconds = raw.optInt("idleHeartbeatSeconds", 120)
                    .coerceIn(30, 3600),
                idleDispatchSeconds = raw.optInt("idleDispatchSeconds", 600)
                    .coerceIn(60, 7200),
            )
        }
    }
}

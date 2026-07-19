package br.com.smartchannel.playerad.util

import java.io.File

/**
 * Verifica presença e autorização do binário `su` antes de aplicar kiosk/rotação do SO.
 *
 * Importante: cada chamada a [probeSuRoot] pode reabrir o diálogo do gerenciador root na TV box.
 * Use intervalos longos entre tentativas e nunca faça probe no Application.onCreate.
 */
object SuAccessHelper {

    fun suBinaryPresent(): Boolean {
        return SU_PATHS.any { File(it).exists() }
    }

    /** Dispositivo com `su` instalado precisa aguardar autorização antes do modo kiosk. */
    fun requiresSuGate(): Boolean = suBinaryPresent()

    /**
     * Executa `su -c id` e confirma uid=0.
     * [probeTimeoutMs] deve ser longo na primeira tentativa para o operador tocar em Permitir.
     */
    fun isSuAuthorized(probeTimeoutMs: Long = DEFAULT_PROBE_TIMEOUT_MS): Boolean {
        if (!suBinaryPresent()) return true
        return probeSuRoot(probeTimeoutMs)
    }

    private fun probeSuRoot(timeoutMs: Long): Boolean {
        return try {
            val proc = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
            val output = StringBuilder()
            val reader = Thread {
                try {
                    proc.inputStream.bufferedReader().forEachLine { line ->
                        output.appendLine(line)
                    }
                } catch (_: Exception) {
                }
            }
            reader.start()
            val waiter = Thread { proc.waitFor() }
            waiter.start()
            waiter.join(timeoutMs)
            if (waiter.isAlive) {
                // Não destruir o processo imediatamente — o operador pode estar no diálogo do SU.
                return false
            }
            output.toString().contains("uid=0")
        } catch (_: Exception) {
            false
        }
    }

    private val SU_PATHS = listOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/vendor/bin/su"
    )

    const val DEFAULT_PROBE_TIMEOUT_MS = 8_000L
    /** Primeira janela: tempo para ler a mensagem e mover o cursor até Permitir. */
    const val FIRST_PROBE_TIMEOUT_MS = 120_000L
    /** Entre tentativas: evita reabrir o diálogo SU a cada poucos segundos. */
    const val RETRY_PROBE_TIMEOUT_MS = 45_000L
    const val RETRY_INTERVAL_MS = 50_000L
    const val MAX_PROBE_ATTEMPTS = 8
}

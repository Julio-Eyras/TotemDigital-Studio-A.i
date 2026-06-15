package br.com.smartchannel.playerad.util

import java.io.File

/**
 * Verifica presença e autorização do binário `su` antes de aplicar kiosk/rotação do SO.
 * O diálogo do gerenciador root (Magisk/SuperSU) só aparece na primeira vez por app,
 * se o operador marcar "Sempre permitir".
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
                proc.destroy()
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

    private const val DEFAULT_PROBE_TIMEOUT_MS = 8_000L
}

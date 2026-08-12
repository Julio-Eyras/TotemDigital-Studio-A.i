package br.com.smartchannel.instalaplayer

import java.io.File

object RootShell {
    private val SU_PATHS = listOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/vendor/bin/su",
    )

    fun suPresent(): Boolean = SU_PATHS.any { File(it).exists() }

    fun isAuthorized(timeoutMs: Long = 20_000L): Boolean {
        if (!suPresent()) return false
        return exec("id", timeoutMs).output.contains("uid=0")
    }

    fun exec(command: String, timeoutMs: Long = 45_000L): Result {
        return try {
            val proc = Runtime.getRuntime().exec(arrayOf("su", "-c", command))
            val stdout = StringBuilder()
            val stderr = StringBuilder()
            val outThread = Thread {
                try {
                    proc.inputStream.bufferedReader().forEachLine { stdout.appendLine(it) }
                } catch (_: Exception) {
                }
            }
            val errThread = Thread {
                try {
                    proc.errorStream.bufferedReader().forEachLine { stderr.appendLine(it) }
                } catch (_: Exception) {
                }
            }
            outThread.start()
            errThread.start()
            val waiter = Thread { proc.waitFor() }
            waiter.start()
            waiter.join(timeoutMs)
            if (waiter.isAlive) {
                return Result(-1, stdout.toString(), "timeout")
            }
            outThread.join(2_000)
            errThread.join(2_000)
            Result(proc.exitValue(), stdout.toString().trim(), stderr.toString().trim())
        } catch (e: Exception) {
            Result(-1, "", e.message ?: "erro su")
        }
    }

    data class Result(val code: Int, val output: String, val error: String) {
        val ok: Boolean get() = code == 0
        val combined: String
            get() = listOf(output, error).filter { it.isNotBlank() }.joinToString("\n")
    }
}

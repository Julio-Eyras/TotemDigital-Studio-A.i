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

    /**
     * Copia o script para `/data/local/tmp` (executável) e corre-o no mount
     * namespace do init (`su -mm`). Sem `-mm` a SuperSU fica noutro namespace:
     * remount de `/system` parece funcionar mas não persiste.
     */
    fun runScript(workDir: File, script: String, timeoutMs: Long = 45_000L): Result {
        workDir.mkdirs()
        val local = File(workDir, "su-local.sh")
        local.writeText(script.replace("\r\n", "\n").trim() + "\n")
        val remote = "/data/local/tmp/td-su.sh"
        val staged = exec(
            "cp '${local.absolutePath}' '$remote' && chmod 755 '$remote'",
            20_000L,
        )
        if (!staged.ok) {
            val piped = execStdin(script.replace("\r\n", "\n").trim() + "\n", timeoutMs)
            if (piped.combined.isNotBlank() || piped.ok) return piped
            return staged
        }
        return exec("sh '$remote'", timeoutMs)
    }

    fun exec(command: String, timeoutMs: Long = 45_000L): Result {
        val master = runProcess(arrayOf("su", "-mm", "-c", command), timeoutMs)
        if (master.ok || master.combined.isNotBlank()) return master
        return runProcess(arrayOf("su", "-c", command), timeoutMs)
    }

    private fun execStdin(script: String, timeoutMs: Long): Result {
        val master = execStdinArgs(arrayOf("su", "-mm"), script, timeoutMs)
        if (master.ok || master.combined.isNotBlank()) return master
        return execStdinArgs(arrayOf("su"), script, timeoutMs)
    }

    private fun execStdinArgs(su: Array<String>, script: String, timeoutMs: Long): Result {
        return try {
            val proc = Runtime.getRuntime().exec(su)
            val writer = Thread {
                try {
                    proc.outputStream.use { out ->
                        out.write(script.toByteArray(Charsets.UTF_8))
                        if (!script.endsWith("\n")) out.write('\n'.code)
                        out.write("exit\n".toByteArray(Charsets.UTF_8))
                        out.flush()
                    }
                } catch (_: Exception) {
                }
            }
            writer.start()
            val result = drain(proc, timeoutMs)
            writer.join(2_000)
            result
        } catch (e: Exception) {
            Result(-1, "", e.message ?: "erro su stdin")
        }
    }

    private fun runProcess(args: Array<String>, timeoutMs: Long): Result {
        return try {
            drain(Runtime.getRuntime().exec(args), timeoutMs)
        } catch (e: Exception) {
            Result(-1, "", e.message ?: "erro su")
        }
    }

    private fun drain(proc: Process, timeoutMs: Long): Result {
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
            proc.destroy()
            return Result(-1, stdout.toString(), "timeout")
        }
        outThread.join(2_000)
        errThread.join(2_000)
        return Result(proc.exitValue(), stdout.toString().trim(), stderr.toString().trim())
    }

    data class Result(val code: Int, val output: String, val error: String) {
        val ok: Boolean get() = code == 0
        val combined: String
            get() = listOf(output, error).filter { it.isNotBlank() }.joinToString("\n")
    }
}

package br.com.smartchannel.playerad.util

import android.app.Application
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Registro operacional do Player-AD: ações, erros e recebimento de DispatchPlan (data/hora).
 *
 * Persistência: [Application.getFilesDir]/[LOG_FILE_NAME] (privado ao app).
 * Também espelha linhas relevantes em Logcat com tag [LOGCAT_TAG].
 */
object PlayerAdLogger {

    const val LOG_FILE_NAME = "player-ad-operations.log"
    private const val LOGCAT_TAG = "Player-AD"
    /** Limite aproximado do ficheiro antes de truncar linhas antigas. */
    private const val MAX_FILE_BYTES = 512 * 1024L
    private const val TRIM_KEEP_LINES = 1500

    @Volatile
    private var application: Application? = null

    fun init(app: Application) {
        application = app
    }

    private fun timestamp(): String =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date())

    @Synchronized
    fun append(level: String, category: String, message: String) {
        val line = "${timestamp()} [$level] [$category] $message"
        when (level) {
            "E" -> Log.e(LOGCAT_TAG, line)
            "W" -> Log.w(LOGCAT_TAG, line)
            else -> Log.i(LOGCAT_TAG, line)
        }
        val ctx = application ?: return
        try {
            val f = File(ctx.filesDir, LOG_FILE_NAME)
            f.appendText(line + "\n", Charsets.UTF_8)
            trimIfNeeded(f)
        } catch (_: Exception) {
            // não bloquear playback
        }
    }

    fun i(category: String, message: String) = append("I", category, message)
    fun w(category: String, message: String) = append("W", category, message)
    fun e(category: String, message: String, t: Throwable? = null) {
        val msg = if (t != null) {
            "$message | ${t.javaClass.simpleName}: ${t.message}"
        } else {
            message
        }
        append("E", category, msg)
    }

    /** Plano recebido do Dispatcher (playlist + contagem + instante). */
    fun logDispatchPlanReceived(playlistId: Long, playlistName: String, itemCount: Int, campaignId: Long?) {
        i(
            "DISPATCH",
            "DispatchPlan recebido — playlist=\"$playlistName\" id=$playlistId itens=$itemCount campaignId=${campaignId ?: "-"}"
        )
    }

    fun logPlaybackStart(kind: String, mediaId: Any, playlistName: String, playlistId: Long) {
        i("PLAYBACK", "Início $kind mediaId=$mediaId playlist=\"$playlistName\" id=$playlistId")
    }

    fun logPlaybackEnd(kind: String, mediaId: Any, durationSeconds: Long?) {
        i("PLAYBACK", "Fim $kind mediaId=$mediaId duração_s=${durationSeconds ?: "-"}")
    }

    fun logFallbackActivated(reason: String) {
        w("FALLBACK", "Ativado — $reason")
    }

    fun logDownloadFailed(mediaId: Long, urlHint: String, err: Throwable?) {
        e("CACHE", "Download falhou mediaId=$mediaId url=${urlHint.take(80)}…", err)
    }

    private fun trimIfNeeded(f: File) {
        if (f.length() <= MAX_FILE_BYTES) return
        try {
            val lines = f.readLines()
            val keep = lines.takeLast(TRIM_KEEP_LINES)
            f.writeText(keep.joinToString("\n") + "\n", Charsets.UTF_8)
            Log.w(LOGCAT_TAG, "${timestamp()} [W] [LOG] Ficheiro operacional truncado (>${MAX_FILE_BYTES} bytes)")
        } catch (_: Exception) { }
    }

    /**
     * Últimas [maxLines] linhas do ficheiro + cabeçalho com caminho absoluto.
     */
    fun readTail(maxLines: Int = 600): String {
        val ctx = application ?: return "(logger não inicializado — reinicie a app)"
        return try {
            val f = File(ctx.filesDir, LOG_FILE_NAME)
            if (!f.exists()) {
                return "(ainda sem linhas)\n\nFicheiro: ${f.absolutePath}"
            }
            val lines = f.readLines()
            val tail = lines.takeLast(maxLines)
            buildString {
                append("Ficheiro: ${f.absolutePath}\n")
                append("Total de linhas: ${lines.size} (a mostrar: ${tail.size})\n")
                append("---\n")
                append(tail.joinToString("\n"))
            }
        } catch (e: Exception) {
            "Erro ao ler registo: ${e.message}"
        }
    }

    fun absoluteLogPath(): String {
        val ctx = application ?: return ""
        return File(ctx.filesDir, LOG_FILE_NAME).absolutePath
    }

    fun clearFile(): Boolean {
        val ctx = application ?: return false
        return try {
            val f = File(ctx.filesDir, LOG_FILE_NAME)
            if (f.exists()) f.delete()
            append("I", "LOG", "Registo operacional limpo pelo utilizador (debug)")
            true
        } catch (_: Exception) {
            false
        }
    }
}

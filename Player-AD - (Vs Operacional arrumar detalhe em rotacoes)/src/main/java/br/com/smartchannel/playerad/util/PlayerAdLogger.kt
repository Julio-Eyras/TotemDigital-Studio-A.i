package br.com.smartchannel.playerad.util

import android.app.Application
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

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

    /**
     * Resumo compacto do DispatchPlan + caminho do JSON completo em disco (opção B de debug).
     * [sequenceEntries]: `order:mediaId,type,dur_s,label` separados por ` | ` na linha de log.
     */
    fun logDispatchPlanDetail(
        source: String,
        playlistId: Long,
        playlistName: String,
        campaignId: Long?,
        sequenceEntries: List<String>,
        savedJsonPath: String?
    ) {
        logDispatchPlanReceived(playlistId, playlistName, sequenceEntries.size, campaignId)
        if (sequenceEntries.isNotEmpty()) {
            i("DISPATCH", "[$source] Sequencia: ${sequenceEntries.joinToString(" | ")}")
        }
        savedJsonPath?.takeIf { it.isNotBlank() }?.let { path ->
            i("DISPATCH", "[$source] JSON completo persistido em: $path")
        }
    }

    /** Extrai sequência e metadados do JSON bruto de dispatch (ecrã debug / testes). */
    fun logDispatchPlanDetailFromJson(source: String, json: JSONObject, savedJsonPath: String?) {
        val planObj = extractPlanObject(json)
        val playlistId = planObj.optLong("playlistId", planObj.optLong("playlist_id", 0L))
        val playlistName = planObj.optString("playlistName", planObj.optString("playlist_name", "DispatchPlan"))
            .ifBlank { "(sem nome)" }
        val campaignId = planObj.optLong("campaignId", planObj.optLong("campaign_id", 0L)).takeIf { it > 0L }
        val itemsArray = planObj.optJSONArray("mediaItems")
            ?: planObj.optJSONArray("media_items")
            ?: JSONArray()
        val entries = buildSequenceEntriesFromJsonArray(itemsArray)
        logDispatchPlanDetail(source, playlistId, playlistName, campaignId, entries, savedJsonPath)
    }

    private fun extractPlanObject(json: JSONObject): JSONObject {
        json.optJSONObject("plan")?.let { return it }
        json.optJSONObject("data")?.optJSONObject("plan")?.let { return it }
        return JSONObject()
    }

    private fun buildSequenceEntriesFromJsonArray(itemsArray: JSONArray): List<String> {
        val entries = mutableListOf<String>()
        for (i in 0 until itemsArray.length()) {
            val obj = itemsArray.optJSONObject(i) ?: continue
            val mediaId = firstPositiveLong(obj, "mediaId", "media_id") ?: continue
            val order = firstPositiveLong(obj, "order")?.toInt() ?: (i + 1)
            val type = firstNonBlankString(obj, "mediaType", "media_type", "mimeType", "mime_type")
                .ifBlank { "-" }
            val duration = firstPositiveLong(obj, "duration", "display_seconds", "displaySeconds")
            val durLabel = duration?.let { "${it}s" } ?: "-"
            val url = firstNonBlankString(obj, "url", "file_path", "filePath", "src")
            val label = firstNonBlankString(
                obj,
                "mediaName",
                "media_name",
                "title",
                "name",
                "fileName",
                "file_name",
            ).ifBlank {
                url.substringAfterLast('/').substringBefore('?').ifBlank { "-" }
            }
            entries += "$order:$mediaId,$type,$durLabel,$label"
        }
        return entries
    }

    private fun firstNonBlankString(obj: JSONObject, vararg keys: String): String {
        for (key in keys) {
            val v = obj.optString(key, "").trim()
            if (v.isNotBlank()) return v
        }
        return ""
    }

    private fun firstPositiveLong(obj: JSONObject, vararg keys: String): Long? {
        for (key in keys) {
            if (!obj.has(key)) continue
            val parsed = try {
                when (val v = obj.get(key)) {
                    is Number -> v.toLong()
                    is String -> v.trim().toLongOrNull()
                    else -> null
                }
            } catch (_: Exception) {
                obj.optString(key, "").trim().toLongOrNull()
            }
            if (parsed != null && parsed > 0L) return parsed
        }
        return null
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

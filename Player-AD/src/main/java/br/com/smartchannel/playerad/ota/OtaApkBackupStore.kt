package br.com.smartchannel.playerad.ota

import android.content.Context
import br.com.smartchannel.playerad.util.PlayerAdLogger
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Backup local de APKs OTA (máx. [MAX_BACKUPS] versões).
 * Pasta: getExternalFilesDir(null)/OTA  →
 *   …/Android/data/br.com.smartchannel.playerad/files/OTA/
 *
 * Na 1.ª iteração: API pronta; instalação/rollback completo fica para Fase E.
 */
object OtaApkBackupStore {
    const val MAX_BACKUPS = 3
    private const val DIR_NAME = "OTA"
    private const val HISTORY_FILE = "ota-history.json"

    fun otaDir(context: Context): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        return File(base, DIR_NAME).apply { if (!exists()) mkdirs() }
    }

    fun historyFile(context: Context): File = File(otaDir(context), HISTORY_FILE)

    /**
     * Regista um evento OTA no histórico local (mock-friendly).
     */
    fun appendHistory(
        context: Context,
        version: String,
        status: String,
        note: String? = null,
        apkPath: String? = null,
    ) {
        try {
            val file = historyFile(context)
            val arr = if (file.exists()) {
                JSONArray(file.readText())
            } else {
                JSONArray()
            }
            arr.put(
                JSONObject().apply {
                    put("at", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US).format(Date()))
                    put("version", version)
                    put("status", status)
                    if (!note.isNullOrBlank()) put("note", note)
                    if (!apkPath.isNullOrBlank()) put("apkPath", apkPath)
                },
            )
            // Manter últimos ~30 eventos
            while (arr.length() > 30) {
                arr.remove(0)
            }
            file.writeText(arr.toString(2))
        } catch (e: Exception) {
            PlayerAdLogger.e("OTA", "Falha ao gravar ota-history.json", e)
        }
    }

    /**
     * Roda a lista de backups: backup-1 ← novo, desloca 2→3, apaga o mais antigo.
     * [sourceApk] deve existir. Retorna path do backup-1 ou null.
     */
    fun pushBackup(context: Context, sourceApk: File, versionLabel: String): File? {
        if (!sourceApk.exists() || sourceApk.length() <= 0L) return null
        val dir = otaDir(context)
        try {
            val b3 = File(dir, "backup-3.apk")
            val b2 = File(dir, "backup-2.apk")
            val b1 = File(dir, "backup-1.apk")
            if (b3.exists()) b3.delete()
            if (b2.exists()) b2.renameTo(b3)
            if (b1.exists()) b1.renameTo(b2)
            val dest = File(dir, "backup-1.apk")
            sourceApk.copyTo(dest, overwrite = true)
            // Metadado simples ao lado
            File(dir, "backup-1.meta.json").writeText(
                JSONObject()
                    .put("version", versionLabel)
                    .put("savedAt", System.currentTimeMillis())
                    .put("bytes", dest.length())
                    .toString(),
            )
            appendHistory(context, versionLabel, "backup_saved", apkPath = dest.absolutePath)
            PlayerAdLogger.i("OTA", "Backup OTA guardado: ${dest.absolutePath} (máx $MAX_BACKUPS)")
            return dest
        } catch (e: Exception) {
            PlayerAdLogger.e("OTA", "Falha ao rodar backups OTA", e)
            return null
        }
    }

    /** Path do backup mais recente (para rollback futuro). */
    fun latestBackup(context: Context): File? {
        val f = File(otaDir(context), "backup-1.apk")
        return f.takeIf { it.exists() && it.length() > 0L }
    }

    /**
     * Mock de rollback: devolve path do backup-1 sem instalar.
     * Instalação real exige PackageInstaller / intent — Fase E.
     */
    fun mockPrepareRollback(context: Context): JSONObject {
        val backup = latestBackup(context)
        appendHistory(
            context,
            version = backup?.nameWithoutExtension ?: "unknown",
            status = if (backup != null) "rollback_ready_mock" else "rollback_unavailable",
            note = "Rollback mock — instalação não executada nesta build",
            apkPath = backup?.absolutePath,
        )
        return JSONObject().apply {
            put("mock", true)
            put("available", backup != null)
            put("backupPath", backup?.absolutePath ?: JSONObject.NULL)
            put("maxBackups", MAX_BACKUPS)
            put("otaDir", otaDir(context).absolutePath)
        }
    }
}

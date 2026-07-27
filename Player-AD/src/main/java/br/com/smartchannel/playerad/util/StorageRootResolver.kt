package br.com.smartchannel.playerad.util

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.storage.StorageManager
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.config.PlayerStorageMode
import java.io.File

/**
 * Resolve o diretório raiz (ficheiros do player: propagandas/, vinhetas/, last-dispatch-plan.json).
 *
 * - **Interno** vs **SD / USB**: usa [Context.getExternalFilesDirs] e, em API 30+,
 *   [StorageManager] para volumes removíveis não primários.
 */
object StorageRootResolver {

    fun resolve(context: Context, config: PlayerConfig): File {
        val appContext = context.applicationContext
        val root = when (config.storageMode) {
            PlayerStorageMode.INTERNAL ->
                appContext.filesDir

            PlayerStorageMode.EXTERNAL_PRIMARY ->
                appContext.getExternalFilesDir(null) ?: appContext.filesDir

            PlayerStorageMode.SD_CARD ->
                firstNonPrimaryExternalFilesDir(appContext)
                    ?: firstRemovableExternalFilesDir(appContext)
                    ?: removableNonPrimaryVolumeDirApi30(appContext)
                    ?: appContext.getExternalFilesDir(null)
                    ?: appContext.filesDir

            PlayerStorageMode.REMOVABLE_PREFERRED ->
                firstRemovableExternalFilesDir(appContext)
                    ?: removableNonPrimaryVolumeDirApi30(appContext)
                    ?: firstNonPrimaryExternalFilesDir(appContext)
                    ?: appContext.getExternalFilesDir(null)
                    ?: appContext.filesDir

            PlayerStorageMode.AUTO ->
                firstRemovableExternalFilesDir(appContext)
                    ?: firstNonPrimaryExternalFilesDir(appContext)
                    ?: removableNonPrimaryVolumeDirApi30(appContext)
                    ?: appContext.getExternalFilesDir(null)
                    ?: appContext.filesDir

            PlayerStorageMode.PATH_OVERRIDE ->
                resolvePathOverride(appContext, config.storagePathOverride)
        }

        if (!root.exists()) {
            root.mkdirs()
        }
        return root
    }

    private fun resolvePathOverride(context: Context, path: String?): File {
        val trimmed = path?.trim().orEmpty()
        if (trimmed.isEmpty()) {
            PlayerAdLogger.w(
                "STORAGE",
                "storage=path_override sem storagePathOverride válido — a usar externo primário"
            )
            return context.getExternalFilesDir(null) ?: context.filesDir
        }
        val dir = File(trimmed)
        try {
            if (!dir.exists()) {
                dir.mkdirs()
            }
            if (dir.isDirectory && probeWritableDirectory(dir)) {
                return dir
            }
        } catch (e: Exception) {
            PlayerAdLogger.e("STORAGE", "Falha ao usar storagePathOverride=$trimmed", e)
        }
        PlayerAdLogger.w(
            "STORAGE",
            "storagePathOverride inválido ou sem escrita: $trimmed — fallback externo primário"
        )
        return context.getExternalFilesDir(null) ?: context.filesDir
    }

    /**
     * Primeiro [Context.getExternalFilesDirs] removível (USB / SD quando o SO marca como removível).
     */
    private fun firstRemovableExternalFilesDir(context: Context): File? {
        for (dir in externalFilesDirsSafe(context)) {
            if (!isDirUsable(dir)) continue
            try {
                if (Environment.isExternalStorageRemovable(dir)) {
                    return dir
                }
            } catch (_: Exception) {
                // ignorar
            }
        }
        return null
    }

    /**
     * Primeiro diretório de app em volume **secundário** (não o mesmo path que [getExternalFilesDir(null)]).
     * Típico para microSD com `Android/data/<package>/files`.
     */
    private fun firstNonPrimaryExternalFilesDir(context: Context): File? {
        val primary = context.getExternalFilesDir(null) ?: return null
        val primaryPath = canonicalPathSafe(primary) ?: return null
        for (dir in externalFilesDirsSafe(context)) {
            if (!isDirUsable(dir)) continue
            val p = canonicalPathSafe(dir) ?: continue
            if (p != primaryPath) {
                return dir
            }
        }
        return null
    }

    /**
     * API 30+: diretório de volume removível e não primário (USB/SD exposto via [StorageVolume.getDirectory]).
     */
    private fun removableNonPrimaryVolumeDirApi30(context: Context): File? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val sm = context.getSystemService(Context.STORAGE_SERVICE) as? StorageManager ?: return null
        return try {
            val volumes = sm.storageVolumes
            for (vol in volumes) {
                try {
                    if (vol.isPrimary || !vol.isRemovable) continue
                    val dir = vol.directory ?: continue
                    if (isDirUsable(dir)) return dir
                } catch (_: Exception) {
                    // ignorar volume
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    /** Elementos nulos (volume indisponível) são ignorados. */
    private fun externalFilesDirsSafe(context: Context): List<File> =
        try {
            context.getExternalFilesDirs(null)?.filterNotNull() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }

    private fun canonicalPathSafe(dir: File): String? =
        try {
            dir.canonicalFile.absolutePath
        } catch (_: Exception) {
            try {
                dir.absolutePath
            } catch (_: Exception) {
                null
            }
        }

    private fun isDirUsable(dir: File): Boolean = probeWritableDirectory(dir)

    /**
     * Confirma escrita real (criar + apagar ficheiro probe), não só [File.canWrite].
     */
    fun probeWritableDirectory(dir: File): Boolean {
        try {
            if (!dir.exists() && !dir.mkdirs()) return false
            if (!dir.isDirectory) return false
            val probe = File(dir, ".playerad_write_probe")
            try {
                probe.writeText("ok", Charsets.UTF_8)
                if (!probe.exists() || probe.length() <= 0L) return false
            } finally {
                try {
                    probe.delete()
                } catch (_: Exception) {
                    // ignore
                }
            }
            return true
        } catch (_: Exception) {
            return false
        }
    }
}


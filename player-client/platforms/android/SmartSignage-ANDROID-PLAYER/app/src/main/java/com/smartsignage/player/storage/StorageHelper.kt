package com.smartsignage.player.storage

import android.content.Context
import android.os.Build
import android.os.Environment
import android.util.Log
import java.io.File

/**
 * StorageHelper - Storage externo por defeito, configurável (opção administrativa)
 *
 * Regras (design):
 * - Por defeito: usar storage EXTERNO (USB/volumes externos) para não comprometer espaço do dispositivo.
 * - Configurável: preferência pode ser alterada pela opção administrativa (externo apenas, interno apenas, ou ordem).
 * - Path base interno = getFilesDir(); externo = getExternalFilesDirs() (índices 1+ = SD/USB).
 * - Pasta de mídias sempre: {pathBase}/propagandas/
 */
class StorageHelper(private val context: Context) {

    companion object {
        private const val TAG = "StorageHelper"
        const val PROPAGANDAS_DIR = "propagandas"
        /** Por defeito usar storage externo (configurável na opção administrativa) */
        const val DEFAULT_USE_EXTERNAL_FIRST = true
    }

    /** Preferir storage externo (true = default). Definir false para usar apenas interno. Pode ser atualizado pela config administrativa. */
    @Volatile
    var useExternalFirst: Boolean = DEFAULT_USE_EXTERNAL_FIRST
        set(value) { field = value }

    /** Path base interno (app private) */
    val internalPathBase: File
        get() = context.filesDir

    /** Volumes externos (USB/SD) - getExternalFilesDirs()[1+] */
    private fun getExternalRoots(): List<File> {
        val list = mutableListOf<File>()
        val externalDirs = context.getExternalFilesDirs(null) ?: return list
        for (i in 1 until externalDirs.size) {
            val dir = externalDirs[i]
            if (dir != null && Environment.MEDIA_MOUNTED == Environment.getStorageState(dir)) {
                list.add(dir)
            }
        }
        return list
    }

    /**
     * Ordem de roots para gravar/ler: por defeito [externo primeiro, depois interno]; se useExternalFirst=false então [interno apenas] ou [interno, externo].
     */
    fun getStorageRoots(): List<File> {
        val internal = internalPathBase
        val external = getExternalRoots()
        return if (useExternalFirst && external.isNotEmpty()) {
            external + listOf(internal)
        } else {
            listOf(internal) + external
        }
    }

    /** Diretório propagandas no storage interno */
    fun getInternalPropagandasDir(): File {
        val dir = File(internalPathBase, PROPAGANDAS_DIR)
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    /** Primeiro volume externo (para propagandas) ou null */
    fun getExternalPropagandasDir(): File? {
        val roots = getExternalRoots()
        if (roots.isEmpty()) return null
        val dir = File(roots[0], PROPAGANDAS_DIR)
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private val defaultExtensions = listOf("mp4", "webm", "jpg", "jpeg", "png", "gif", "webp", "mov", "bin")

    /**
     * Resolve path do ficheiro para reprodução (ordem = getStorageRoots: por defeito externo primeiro).
     */
    fun resolveMediaPath(mediaId: String, extension: String? = null): String? {
        val exts = if (!extension.isNullOrBlank()) listOf(extension) else defaultExtensions
        for (root in getStorageRoots()) {
            val propDir = File(root, PROPAGANDAS_DIR)
            for (ext in exts) {
                val file = File(propDir, "$mediaId.$ext")
                if (file.exists()) return file.absolutePath
            }
        }
        return null
    }

    /**
     * Garante que a pasta propagandas existe em todos os roots (interno + externos).
     * Deve ser chamado ao arranque do player.
     */
    fun ensurePropagandasDirs() {
        for (root in getStorageRoots()) {
            val dir = File(root, PROPAGANDAS_DIR)
            if (!dir.exists()) dir.mkdirs()
        }
    }

    /**
     * Path onde gravar: por defeito storage EXTERNO (quando disponível), senão interno.
     * Respeita useExternalFirst (configurável na opção administrativa).
     */
    fun getWritePropagandasDir(): File {
        if (useExternalFirst) {
            getExternalPropagandasDir()?.let { return it }
        }
        return getInternalPropagandasDir()
    }

    /** Espaço livre num diretório (aproximado) */
    fun getFreeSpaceBytes(dir: File): Long {
        return try {
            dir.freeSpace
        } catch (e: Exception) {
            Log.e(TAG, "getFreeSpace error", e)
            0L
        }
    }

    /** Lista ficheiros em propagandas num root */
    fun listPropagandasFiles(root: File): List<String> {
        val propagandas = File(root, PROPAGANDAS_DIR)
        if (!propagandas.exists()) return emptyList()
        return propagandas.list()?.toList() ?: emptyList()
    }

    /**
     * Info para o painel de debug: storages em uso, ordem, contagem, espaço livre
     */
    fun getDebugStorageInfo(): DebugStorageInfo {
        val roots = getStorageRoots()
        val externalRoots = getExternalRoots()
        val entries = roots.mapIndexed { index, root ->
            val propagandas = File(root, PROPAGANDAS_DIR)
            val files = if (propagandas.exists()) propagandas.list()?.toList() ?: emptyList() else emptyList()
            val label = when {
                root == internalPathBase -> "Interno"
                root in externalRoots -> "Externo/USB${externalRoots.indexOf(root) + 1}"
                else -> "Storage${index + 1}"
            }
            StorageEntry(
                label = label,
                path = root.absolutePath,
                freeSpaceBytes = getFreeSpaceBytes(root),
                fileCount = files.size,
                fileNames = files.take(20)
            )
        }
        val orderDesc = if (useExternalFirst && getExternalRoots().isNotEmpty()) "externo → interno" else "interno → externo"
        return DebugStorageInfo(
            resolutionOrder = orderDesc,
            entries = entries
        )
    }

    data class DebugStorageInfo(
        val resolutionOrder: String,
        val entries: List<StorageEntry>
    )

    data class StorageEntry(
        val label: String,
        val path: String,
        val freeSpaceBytes: Long,
        val fileCount: Int,
        val fileNames: List<String>
    )
}
